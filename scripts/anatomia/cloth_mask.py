"""
Pantaloncini della pelle vera con il bordo liscio: prima la stoffa veniva dall'immagine del corpo, punto per
punto (grigio = stoffa), e il bordo in vita e sulle cosce era a gradini come i pixel dell'immagine. Qui dai punti
dove l'immagine passa da stoffa a pelle si ricavano una vita liscia e due orli sulle cosce; ogni vertice del corpo
prende la sua distanza (con segno) da quel bordo, in un byte libero di pelle.bin (extra.cloth in pelle.json):
l'app traccia il bordo dove vale metà.

Uso: python3 scripts/anatomia/cloth_mask.py <pelle senza estensione> <immagine del corpo, pelle.jpg> <corpo atlante .json>
"""
import json
import sys

import numpy as np
from PIL import Image

base, tex_path = sys.argv[1], sys.argv[2]
js = json.load(open(base + ".json"))
buf = bytearray(open(base + ".bin", "rb").read())
st = js["stride"]
m = js["meshes"]["corpo"]
n = m["n"]
raw = np.frombuffer(bytes(buf), np.uint8, n * st, m["vOffset"]).reshape(n, st)
pos = raw[:, 0:12].copy().view("<f4").reshape(n, 3).astype(np.float64)
uv = raw[:, 15:19].copy().view("<u2").reshape(n, 2) / 65535.0
idx = np.frombuffer(bytes(buf), "<u2", m["indices"], m["iOffset"]).reshape(-1, 3).astype(np.int64)
hs = m.get("headStart")
body_tris = idx[: hs // 3] if hs is not None else idx
head = np.zeros(n, bool)
if hs is not None:
    head[idx[hs // 3 :].ravel()] = True

img = np.asarray(Image.open(tex_path).convert("RGB"), np.float64) / 255.0
H, W = img.shape[:2]


def sample(u, v):
    """bilineare, origine in alto a sinistra (come la tela caricata senza capovolgere)"""
    x = np.clip(u * W - 0.5, 0, W - 1.001)
    y = np.clip(v * H - 0.5, 0, H - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[:, None], (y - y0)[:, None]
    a = img[y0, x0] * (1 - fx) + img[y0, x0 + 1] * fx
    b = img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


# come nell'app: stoffa = colore senza saturazione (i pantaloncini grigi del personaggio)
c = sample(uv[:, 0], uv[:, 1])
mx, mn = c.max(1), c.min(1)
sat = (mx - mn) / np.maximum(mx, 1e-3)
t = np.clip((sat - 0.07) / (0.15 - 0.07), 0, 1)
cloth = 1 - t * t * (3 - 2 * t)
cloth[head] = 0

# Il bordo della stoffa come linea liscia: la vita (altezza che gira attorno al bacino) e i due orli sulle cosce
# (piani di traverso alla coscia), presi dai punti dove l'immagine passa da stoffa a pelle. Nei vertici va la
# distanza (con segno) dal bordo: l'app lo traccia dove vale zero, senza i gradini dei pixel né dei triangoli.
atlas = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else None
rest = atlas["rest"] if atlas else None
segs = js.get("segments") or []
jo = raw[:, 19:23].astype(np.int64)
wt = raw[:, 23:27].astype(np.float64)
dom = jo[np.arange(n), wt.argmax(1)]
# braccia e mani (le mani vere hanno le ossa del personaggio, dopo i segmenti dell'atlante)
arm = np.isin(dom, [segs.index(k) for k in segs if k.split("_")[0] in ("omero", "avambr", "mano", "dita", "pollice")]) | (dom >= len(segs))
key = np.round(pos * 2000).astype(np.int64)
_, grp = np.unique(key, axis=0, return_inverse=True)
grp = grp.ravel()
e = np.concatenate([body_tris[:, [0, 1]], body_tris[:, [1, 2]], body_tris[:, [2, 0]]])
edge = (cloth[e[:, 0]] - 0.5) * (cloth[e[:, 1]] - 0.5) < 0
ok_e = edge & ~arm[e[:, 0]] & ~arm[e[:, 1]] & ~head[e[:, 0]] & ~head[e[:, 1]]
ea, eb = e[ok_e, 0], e[ok_e, 1]
ta = (0.5 - cloth[ea]) / (cloth[eb] - cloth[ea])
bpts = pos[ea] + (pos[eb] - pos[ea]) * ta[:, None]
hipL, hipR = np.array(rest["23"]), np.array(rest["24"])
knL, knR = np.array(rest["25"]), np.array(rest["26"])
pel = (hipL + hipR) / 2
crotch = pel[1] - 0.06


def harm(ang, k):
    cols = [np.ones_like(ang)]
    for h in range(1, k + 1):
        cols += [np.cos(h * ang), np.sin(h * ang)]
    return np.stack(cols, 1)


# vita: i punti di passaggio sopra il cavallo, altezza in funzione dell'angolo attorno al bacino
wsel = bpts[:, 1] > crotch + 0.04
wang = np.arctan2(bpts[wsel, 2] - pel[2], bpts[wsel, 0] - pel[0])
cw, *_ = np.linalg.lstsq(harm(wang, 2), bpts[wsel, 1], rcond=None)
# orli delle cosce: lungo l'asse anca-ginocchio, in funzione dell'angolo attorno alla coscia
legs = []
for hp, kn, side in ((hipL, knL, 1), (hipR, knR, -1)):
    ax = (kn - hp) / np.linalg.norm(kn - hp)
    ref = np.cross(ax, [0, 0, 1.0])
    ref /= np.linalg.norm(ref)
    ref2 = np.cross(ax, ref)
    lsel = (bpts[:, 1] < crotch) & ((bpts[:, 0] - pel[0]) * side > 0)
    d = bpts[lsel] - hp
    t = d @ ax
    ang = np.arctan2(d @ ref2, d @ ref)
    cl, *_ = np.linalg.lstsq(harm(ang, 1), t, rcond=None)
    legs.append((hp, ax, ref, ref2, cl, side))
    print("orlo", "S" if side > 0 else "D", "a", round(float(cl[0]) * 100, 1), "cm dall'anca lungo la coscia; punti", int(lsel.sum()))
print("vita a", round(float(cw[0]) * 100, 1), "cm; punti", int(wsel.sum()))
ang_all = np.arctan2(pos[:, 2] - pel[2], pos[:, 0] - pel[0])
fw = harm(ang_all, 2) @ cw - pos[:, 1]
fl = np.full(n, 1.0)
for hp, ax, ref, ref2, cl, side in legs:
    d = pos - hp
    t = d @ ax
    ang = np.arctan2(d @ ref2, d @ ref)
    on = ((pos[:, 0] - pel[0]) * side > 0) & (pos[:, 1] < crotch + 0.02)
    fl = np.where(on, np.minimum(fl, harm(ang, 1) @ cl - t), fl)
fld = np.minimum(fw, fl)
# solo bacino e cosce: le braccia (a riposo accanto ai fianchi) e la testa mai stoffa
fld[arm | head] = -1
fld[pos[:, 1] < knL[1] + 0.05] = -1
out = np.clip(fld / 0.03 * 0.5 + 0.5, 0, 1)
OFF = 31
arr = np.frombuffer(buf, np.uint8, n * st, m["vOffset"]).reshape(n, st)
arr[:, OFF] = np.round(out * 255).astype(np.uint8)
open(base + ".bin", "wb").write(bytes(buf))
js.setdefault("extra", {})["cloth"] = OFF
json.dump(js, open(base + ".json", "w"), separators=(",", ":"))
print("stoffa: vertici dentro", int((out > 0.5).sum()), "su", n, "- accordo con l'immagine", round(float(((out > 0.5) == (cloth > 0.5))[~head].mean()) * 100, 1), "%")
