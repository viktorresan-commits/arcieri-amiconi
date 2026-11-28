"""
Piedi della pelle vera sulle ossa del piede dell'atlante. Il piede della pelle (dal personaggio Quaternius) era lungo
quasi 29 cm su un uomo di 1,72 m e le dita finivano 6-7 cm oltre le falangi dell'atlante: dita lunghe il doppio, a
pinna, con la punta sotto il pavimento. Qui, sul riposo, la parte davanti alle teste dei metatarsi si accorcia
lungo il piede fino a finire 1,2 cm oltre la punta delle ossa (le dita restano sopra le loro falangi), le dita si
stringono un poco e la loro pianta torna all'altezza di quella sotto la pianta del piede. Tallone, collo del piede e
caviglia restano come sono.

Uso: python3 scripts/anatomia/fit_feet.py <pelle.json> <pelle.bin> <corpo.json> [uscita.bin]
(corpo.bin accanto a corpo.json; dopo add_fat.py, prima di cloth_mask.py)
"""
import json
import sys
from pathlib import Path

import numpy as np

TIP = 0.012  # pelle oltre la punta delle falangi
TOES = 0.055  # dalle teste dei metatarsi alla punta delle ossa, circa
NARROW = 0.08  # le dita si stringono così (frazione)
SMOOTH = 20  # passate di levigatura su dita (piene) e resto del piede (a metà)


def smoothstep(a: float, b: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def foot_bones(corpo_js: Path, seg: int) -> np.ndarray:
    m = json.loads(corpo_js.read_text())
    raw = np.fromfile(corpo_js.with_suffix(".bin"), dtype=np.uint8)
    lo, hi, st = np.array(m["lo"]), np.array(m["hi"]), m["stride"]
    out = []
    for b in m["batches"]:
        if b["layer"] != "bone":
            continue
        blk = raw[b["vOffset"] : b["vOffset"] + b["vertices"] * st].reshape(-1, st)
        q = blk[:, 0:6].copy().view(np.uint16).reshape(-1, 3).astype(np.float64) / 65535
        P = lo + q * (hi - lo)
        sel = (blk[:, 9] == seg) | (blk[:, 10] == seg)
        out.append(P[sel])
    return np.concatenate(out)


def main() -> None:
    js_p, bin_p, corpo_p = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    out_p = Path(sys.argv[4]) if len(sys.argv) > 4 else bin_p
    js = json.loads(js_p.read_text())
    rest = {k: np.array(v) for k, v in json.loads(corpo_p.read_text())["rest"].items()}
    corpo_segs = json.loads(corpo_p.read_text())["segments"]
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
    body_v = np.zeros(n, bool)
    body_v[tri.reshape(-1)] = True
    segs = js["segments"]
    new = pos.copy()
    moved = np.zeros(n, bool)
    toe_w = np.zeros(n)
    for sd, he, to in (("L", "29", "31"), ("R", "30", "32")):
        seg = segs.index(f"piede_{sd}")
        w = (wt * (jo == seg)).sum(1)
        bones = foot_bones(corpo_p, corpo_segs.index(f"piede_{sd}"))
        H = rest[he]
        d = rest[to] - H
        d[1] = 0
        d /= np.linalg.norm(d)
        side = np.cross([0.0, 1.0, 0.0], d)
        tb = (bones - H) @ d
        tip_b = tb.max()
        foot = body_v & (w > 0.02)
        t = (pos - H) @ d
        tip_s = t[foot & (w > 0.5)].max()
        t0 = tip_b - TOES
        t1 = t0 + 0.025
        target = tip_b + TIP
        # accorciamento morbido: la derivata scende da 1 a k tra t0 e t1, poi resta k
        grid = np.linspace(t0, max(tip_s, t1) + 0.02, 600)
        dg = grid[1] - grid[0]

        def mapping(k: float) -> np.ndarray:
            slope = 1 - (1 - k) * smoothstep(t0, t1, grid)
            return t0 + np.concatenate([[0], np.cumsum((slope[1:] + slope[:-1]) * 0.5 * dg)])

        lo_k, hi_k = 0.05, 1.0
        for _ in range(40):
            k = 0.5 * (lo_k + hi_k)
            if np.interp(tip_s, grid, mapping(k)) > target:
                hi_k = k
            else:
                lo_k = k
        f = mapping(0.5 * (lo_k + hi_k))
        tt = np.where(t > t0, np.interp(t, grid, f), t)
        s = smoothstep(t0, t1, t)
        # in largo: verso il centro delle falangi
        sb = (bones - H) @ side
        front = tb > t0
        c = 0.5 * (sb[front].min() + sb[front].max())
        lat = (pos - H) @ side
        lat2 = c + (lat - c) * (1 - NARROW * s)
        # pianta delle dita all'altezza della pianta sotto le teste dei metatarsi
        ball = foot & (np.abs(t - t0) < 0.012)
        y_ref = np.percentile(pos[ball, 1], 3)
        y = pos[:, 1]
        y2 = np.where(y < y_ref, y_ref - (y_ref - y) * (1 - 0.7 * s), y)
        P2 = pos + d[None, :] * (tt - t)[:, None] + side[None, :] * (lat2 - lat)[:, None]
        P2[:, 1] = y2
        wf = np.where(foot, np.clip(w, 0, 1), 0)[:, None]
        sel = foot & (t > t0 - 0.001)
        new[sel] = pos[sel] * (1 - wf[sel]) + P2[sel] * wf[sel]
        moved |= sel
        # dita del tutto; il resto del piede e la caviglia a metà (lo scalino dove la pelle dell'atlante finisce)
        toe_w = np.maximum(toe_w, np.where(foot, np.clip(w, 0, 1) * (0.6 + 0.4 * smoothstep(t0 - 0.01, t0 + 0.02, t)), 0))
        print(f"piede {sd}: pelle fino a {tip_s * 100:.1f} cm dal tallone, ossa {tip_b * 100:.1f}: ora {((new[foot] - H) @ d).max() * 100:.1f} cm")

    # piede levigato (Taubin, sui punti saldati): le dita accorciate restavano grumi e sul collo del piede c'era uno
    # scalino dove finisce la pelle dell'atlante
    key = np.round(pos * 4000).astype(np.int64)
    _, of = np.unique(key, axis=0, return_inverse=True)
    of = of.reshape(-1)
    Wn = of.max() + 1
    P = np.zeros((Wn, 3))
    cnt = np.zeros(Wn)
    np.add.at(P, of, new)
    np.add.at(cnt, of, 1)
    P /= cnt[:, None]
    lam = np.zeros(Wn)
    np.maximum.at(lam, of, toe_w)
    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    e = of[e]
    e = e[e[:, 0] != e[:, 1]]
    e = np.unique(np.sort(e, 1), axis=0)
    a, b = e[:, 0], e[:, 1]
    deg = np.maximum(np.bincount(a, minlength=Wn) + np.bincount(b, minlength=Wn), 1)

    def lap(X: np.ndarray) -> np.ndarray:
        acc = np.zeros_like(X)
        np.add.at(acc, a, X[b])
        np.add.at(acc, b, X[a])
        return acc / deg[:, None] - X

    for _ in range(SMOOTH):
        P = P + 0.5 * lam[:, None] * lap(P)
        P = P - 0.53 * lam[:, None] * lap(P)
    new = np.where((lam[of] > 0)[:, None], P[of], new)
    moved |= lam[of] > 0

    # normali dalla forma nuova dove la pelle si è spostata (anche sui punti saldati)
    v0, v1, v2 = new[tri[:, 0]], new[tri[:, 1]], new[tri[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    NN = np.zeros((of.max() + 1, 3))
    for c in range(3):
        np.add.at(NN, of[tri[:, c]], fn)
    NN /= np.maximum(np.linalg.norm(NN, axis=1, keepdims=True), 1e-12)
    nn = NN[of]
    nn[(nn * nrm).sum(1) < 0] *= -1
    mw = np.zeros(of.max() + 1, bool)
    mw[of[moved]] = True
    mv = mw[of]
    out_nrm = np.where(mv[:, None], nn, nrm)
    rec[:, 0:12] = new.astype(np.float32).view(np.uint8).reshape(n, 12)
    rec[:, 12:15] = np.round(np.clip(out_nrm, -1, 1) * 127).astype(np.int8).view(np.uint8)
    raw[m["vOffset"] : m["vOffset"] + n * st] = rec.tobytes()
    out_p.write_bytes(bytes(raw))
    print("scritto", out_p)


if __name__ == "__main__":
    main()
