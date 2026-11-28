"""
Strato di grasso sotto la pelle vera: la pelle era stesa direttamente su muscoli e ossa dell'atlante (wrap_skin.py),
senza il grasso che nel corpo vero c'è sopra i muscoli. Ne venivano una vita troppo stretta (75 cm di giro su un
uomo di 1,72 m), fianchi e glutei piccoli e contorni che seguivano ogni muscolo. Qui la pelle a riposo si sposta in
fuori, lungo la normale di una forma levigata, dello spessore del grasso di un fisico normale (uomo sportivo, circa
15 % di grasso): più su pancia, fianchi e glutei, meno su petto, schiena, braccia e gambe; niente su mani, piedi e
testa. Dove due parti del corpo sono vicine (cosce tra loro, braccio contro il fianco) lo spessore si limita, così
non si compenetrano. Lo spessore si leviga sulla pelle (niente gradini); le normali si rifanno.

Sopra il grasso un poco di massa muscolare in più (MUSCLE): l'atlante è un corpo da tavola anatomica, magro; con
il solo grasso l'avambraccio era quasi grosso come il braccio e spalle e petto restavano piatti.

Uso: python3 scripts/anatomia/add_fat.py <pelle.json> <pelle.bin> [scala del grasso=1] [uscita.bin]
(dopo: cloth_mask.py, perché il bordo dei pantaloncini segue la forma)
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

# spessore del grasso sul busto per altezza (metri sul riposo dell'atlante, uomo di 1,72 m): petto sottile,
# pancia e fianchi di più, glutei e anche il massimo
TORSO_Y = [(1.50, 0.003), (1.38, 0.004), (1.28, 0.006), (1.18, 0.011), (1.10, 0.016), (1.03, 0.019), (0.97, 0.020), (0.90, 0.019), (0.84, 0.014)]
# gambe per altezza: coscia alta piena, ginocchio sottile, polpaccio poco, caviglia quasi niente
LEG_Y = [(0.92, 0.016), (0.80, 0.011), (0.66, 0.008), (0.52, 0.004), (0.40, 0.004), (0.20, 0.0025), (0.10, 0.0015)]
SEG_T = {"clav_L": 0.004, "clav_R": 0.004, "omero_L": 0.004, "omero_R": 0.004, "avambr_L": 0.0008, "avambr_R": 0.0008}
# massa muscolare di un arciere sportivo sopra quella dell'atlante (che è un corpo da tavola, magro): spalle,
# braccia, petto, schiena e cosce più piene, l'avambraccio che si assottiglia verso il polso. In metri, al massimo
MUSCLE = {"deltoide": 0.007, "braccio": 0.004, "avambraccio": 0.0008, "petto": 0.005, "dorso": 0.004, "trapezio": 0.004, "coscia": 0.004}
NONE = {"testa", "mano_L", "mano_R", "piede_L", "piede_R", "dita_L", "dita_R", "pollice_L", "pollice_R"}


def interp(y: np.ndarray, table) -> np.ndarray:
    ys = np.array([a for a, _ in table])[::-1]
    ts = np.array([b for _, b in table])[::-1]
    return np.interp(y, ys, ts)


def main() -> None:
    js_p, bin_p = Path(sys.argv[1]), Path(sys.argv[2])
    scale = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    out_p = Path(sys.argv[4]) if len(sys.argv) > 4 else bin_p
    js = json.loads(js_p.read_text())
    raw = bytearray(bin_p.read_bytes())
    st = js["stride"]
    m = js["meshes"]["corpo"]
    n = m["n"]
    rec = np.frombuffer(bytes(raw[m["vOffset"] : m["vOffset"] + n * st]), dtype=np.uint8).reshape(n, st).copy()
    pos = rec[:, 0:12].copy().view(np.float32).reshape(n, 3).astype(np.float64)
    nrm = rec[:, 12:15].view(np.int8).astype(np.float64) / 127.0
    jo = rec[:, 19:23].astype(np.int64)
    wt = rec[:, 23:27].astype(np.float64) / 255.0
    idx = np.frombuffer(bytes(raw[m["iOffset"] : m["iOffset"] + m["indices"] * 2]), dtype=np.uint16).astype(np.int64)
    hs = m.get("headStart") or len(idx)
    tri = idx[:hs].reshape(-1, 3)
    segs = js["segments"]
    ns = len(segs)

    # punti saldati e vicini
    key = np.round(pos * 4000).astype(np.int64)
    _, of = np.unique(key, axis=0, return_inverse=True)
    of = of.reshape(-1)
    W = of.max() + 1
    P = np.zeros((W, 3))
    cnt = np.zeros(W)
    np.add.at(P, of, pos)
    np.add.at(cnt, of, 1)
    P /= cnt[:, None]
    NW = np.zeros((W, 3))
    np.add.at(NW, of, nrm)
    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    e = of[e]
    e = e[e[:, 0] != e[:, 1]]
    e = np.unique(np.sort(e, 1), axis=0)
    a, b = e[:, 0], e[:, 1]
    deg = np.maximum(np.bincount(a, minlength=W) + np.bincount(b, minlength=W), 1)

    def avg(X: np.ndarray) -> np.ndarray:
        acc = np.zeros_like(X)
        np.add.at(acc, a, X[b])
        np.add.at(acc, b, X[a])
        return acc / (deg[:, None] if X.ndim == 2 else deg)

    # normali di una forma molto levigata: il grasso riempie i solchi tra i muscoli invece di seguirli
    Ns = NW / np.maximum(np.linalg.norm(NW, axis=1, keepdims=True), 1e-12)
    for _ in range(25):
        Ns = 0.5 * Ns + 0.5 * avg(Ns)
        Ns /= np.maximum(np.linalg.norm(Ns, axis=1, keepdims=True), 1e-12)

    # spessore per vertice: somma pesata per segmento
    body_v = np.zeros(n, bool)
    body_v[tri.reshape(-1)] = True
    y = pos[:, 1]
    t = np.zeros(n)
    # busto: davanti e sui fianchi più che sulla schiena (lungo la colonna il grasso è sottile)
    cz = np.median(pos[body_v & (np.abs(pos[:, 0]) < 0.05), 2])
    front = np.clip((pos[:, 2] - cz) / 0.08, -1, 1)
    side = np.clip(np.abs(pos[:, 0]) / 0.14, 0, 1)
    waist = np.clip(1 - np.abs(y - 1.05) / 0.12, 0, 1)
    torso_t = interp(y, TORSO_Y) * (1 + waist * (0.15 * front + 0.15 * side - 0.35 * np.clip(-front, 0, 1) * (1 - side)))
    leg_t = interp(y, LEG_Y)
    for k in range(4):
        s = np.clip(jo[:, k], 0, 255)
        w = wt[:, k]
        names = np.array([segs[i] if i < ns else "mano" for i in s])
        tk = np.zeros(n)
        is_torso = np.isin(names, ["bacino", "torace"])
        is_leg = np.isin(names, ["coscia_L", "coscia_R", "gamba_L", "gamba_R"])
        tk[is_torso] = torso_t[is_torso]
        tk[is_leg] = leg_t[is_leg]
        for nm, v in SEG_T.items():
            tk[names == nm] = v
        tk[np.isin(names, list(NONE)) | (s >= ns)] = 0.0
        t += w * tk
    t[~body_v] = 0
    # dietro il braccio (tricipite) un poco di più
    arm = np.isin(np.array([segs[i] if i < ns else "" for i in jo[np.arange(n), wt.argmax(1)]]), ["omero_L", "omero_R"])
    t[arm & (front < 0)] *= 1.3

    t *= scale

    # massa muscolare (non scala con il grasso)
    dname = np.array([segs[i] if i < ns else "" for i in jo[np.arange(n), wt.argmax(1)]])
    rest = json.loads((js_p.parent / "corpo.json").read_text())["rest"] if (js_p.parent / "corpo.json").exists() else None
    mus = np.zeros(n)
    if rest is not None:
        sm = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
        for sd, sh, el, wr in (("L", "11", "13", "15"), ("R", "12", "14", "16")):
            S, E, Wr = (np.array(rest[k]) for k in (sh, el, wr))
            # deltoide: attorno alla spalla, sul lato di fuori
            ds = np.linalg.norm(pos - S, axis=1)
            outw = np.clip((pos[:, 0] - S[0]) * np.sign(S[0]) / 0.03 + 0.6, 0, 1)
            on = np.isin(dname, [f"omero_{sd}", f"clav_{sd}"])
            mus += on * MUSCLE["deltoide"] * (1 - sm(0.05, 0.13, ds)) * outw
            # braccio: pieno a metà, meno verso il gomito
            ax = (E - S) / np.linalg.norm(E - S)
            u = np.clip((pos - S) @ ax / np.linalg.norm(E - S), 0, 1)
            mus += (dname == f"omero_{sd}") * MUSCLE["braccio"] * np.sin(np.pi * np.clip(u * 0.9 + 0.1, 0, 1))
            # avambraccio: i muscoli sotto il gomito, niente al polso
            ax = (Wr - E) / np.linalg.norm(Wr - E)
            u = np.clip((pos - E) @ ax / np.linalg.norm(Wr - E), 0, 1)
            mus += (dname == f"avambr_{sd}") * MUSCLE["avambraccio"] * (1 - sm(0.2, 0.75, u))
        tor = np.isin(dname, ["torace", "clav_L", "clav_R"])
        ax_ = np.abs(pos[:, 0])
        # petto: davanti, tra le spalle e sotto le clavicole
        mus += tor * MUSCLE["petto"] * np.clip(front, 0, 1) * (1 - sm(0.06, 0.11, np.abs(y - 1.31))) * (1 - sm(0.13, 0.19, ax_)) * sm(0.0, 0.03, ax_)
        # dorso (gran dorsale e scapole): dietro, più sui lati
        mus += tor * MUSCLE["dorso"] * np.clip(-front, 0, 1) * (1 - sm(0.1, 0.17, np.abs(y - 1.27))) * sm(0.02, 0.09, ax_)
        # trapezio: tra collo e spalle
        mus += tor * MUSCLE["trapezio"] * sm(1.38, 1.43, y) * (1 - sm(1.47, 1.52, y)) * sm(0.03, 0.06, ax_) * (1 - sm(0.12, 0.16, ax_))
        # cosce: davanti (quadricipite) più che dietro
        th = np.isin(dname, ["coscia_L", "coscia_R"])
        mus += th * MUSCLE["coscia"] * (0.8 + 0.4 * np.clip(front, 0, 1)) * sm(0.48, 0.6, y) * (1 - sm(0.8, 0.9, y))
    mus[~body_v] = 0
    t += mus

    # dove due parti sono vicine (cosce tra loro, braccio e fianco) lo spessore resta sotto il 40 % dello spazio
    dom = jo[np.arange(n), wt.argmax(1)]
    group = np.full(n, -1)
    for gi, names in enumerate((["bacino", "torace", "clav_L", "clav_R"], ["omero_L", "avambr_L", "mano_L", "dita_L", "pollice_L"], ["omero_R", "avambr_R", "mano_R", "dita_R", "pollice_R"], ["coscia_L", "gamba_L", "piede_L"], ["coscia_R", "gamba_R", "piede_R"])):
        for nm in names:
            if nm in segs:
                group[dom == segs.index(nm)] = gi
    pairs = [(1, 0), (2, 0), (3, 4)]
    gap = np.full(n, np.inf)
    for g1, g2 in pairs:
        for ga, gb in ((g1, g2), (g2, g1)):
            sa = np.where((group == ga) & body_v)[0]
            sb = np.where((group == gb) & body_v)[0]
            if not len(sa) or not len(sb):
                continue
            d, _ = cKDTree(pos[sb]).query(pos[sa])
            # vicino al giunto (spalla, anca) le due parti si toccano di natura: lì non si limita
            gap[sa] = np.minimum(gap[sa], np.where(d > 0.012, d, np.inf))
    t = np.minimum(t, 0.4 * gap)

    # sui punti saldati, levigato
    T = np.zeros(W)
    np.maximum.at(T, of, t)
    tmin = np.full(W, np.inf)
    np.minimum.at(tmin, of, t)
    T = np.minimum(T, tmin)
    for _ in range(20):
        T = 0.5 * T + 0.5 * avg(T)

    Q = P + Ns * T[:, None]
    print(f"spessore medio {T[T > 0.0005].mean() * 1000:.1f} mm, massimo {T.max() * 1000:.1f} mm")

    # normali dalla forma nuova dove la pelle si è spostata
    newpos = Q[of]
    v0, v1, v2 = newpos[tri[:, 0]], newpos[tri[:, 1]], newpos[tri[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    NN = np.zeros((W, 3))
    for c in range(3):
        np.add.at(NN, of[tri[:, c]], fn)
    NN /= np.maximum(np.linalg.norm(NN, axis=1, keepdims=True), 1e-12)
    nn = NN[of]
    nn[(nn * nrm).sum(1) < 0] *= -1
    f = np.clip(T[of] / 0.002, 0, 1)[:, None]
    bl = nrm * (1 - f) + nn * f
    bl /= np.maximum(np.linalg.norm(bl, axis=1, keepdims=True), 1e-12)
    moved = body_v & (T[of] > 0)
    out_pos = np.where(moved[:, None], newpos, pos).astype(np.float32)
    rec[:, 0:12] = out_pos.view(np.uint8).reshape(n, 12)
    rec[:, 12:15] = np.round(np.clip(np.where(moved[:, None], bl, nrm), -1, 1) * 127).astype(np.int8).view(np.uint8)
    raw[m["vOffset"] : m["vOffset"] + n * st] = rec.tobytes()
    out_p.write_bytes(bytes(raw))
    print("scritto", out_p)


if __name__ == "__main__":
    main()
