"""
Contorni lisci della pelle vera: la pelle stesa su muscoli e ossa dell'atlante (wrap_skin.py) ne seguiva ogni
bozzo, e di profilo il contorno di braccia, schiena e gambe veniva a gobbe e spigoli. Qui la forma a riposo si
leviga (Taubin: liscia senza restringersi) su busto, braccia e gambe; mani, piedi e testa restano com'erano.
Il rilievo dei muscoli che si vede resta: viene dalla normal map delle tavole (pelle-rilievo.jpg), dalla grana e
dall'ombra, non dai bozzi della forma. Le normali dei punti levigati si rifanno dalla forma nuova.

Uso: python3 scripts/anatomia/smooth_skin.py <pelle.json> <pelle.bin> [passate=20] [uscita.bin]
"""
import json
import sys
from pathlib import Path

import numpy as np

# segmenti dell'atlante che si levigano (busto, clavicole, braccia, cosce, gambe; non testa, mani, piedi)
SMOOTH = {"bacino", "torace", "clav_L", "omero_L", "avambr_L", "clav_R", "omero_R", "avambr_R", "coscia_L", "gamba_L", "coscia_R", "gamba_R"}


def main() -> None:
    js_p, bin_p = Path(sys.argv[1]), Path(sys.argv[2])
    passes = int(sys.argv[3]) if len(sys.argv) > 3 else 20
    out_p = Path(sys.argv[4]) if len(sys.argv) > 4 else bin_p
    js = json.loads(js_p.read_text())
    raw = bytearray(bin_p.read_bytes())
    st = js["stride"]
    m = js["meshes"]["corpo"]
    n = m["n"]
    rec = np.frombuffer(bytes(raw[m["vOffset"] : m["vOffset"] + n * st]), dtype=np.uint8).reshape(n, st)
    pos = rec[:, 0:12].copy().view(np.float32).reshape(n, 3).astype(np.float64)
    jo = rec[:, 19:23].astype(np.int64)
    wt = rec[:, 23:27].astype(np.float64) / 255.0
    idx = np.frombuffer(bytes(raw[m["iOffset"] : m["iOffset"] + m["indices"] * 2]), dtype=np.uint16).astype(np.int64)
    hs = m.get("headStart") or len(idx)
    tri = idx[:hs].reshape(-1, 3)

    # punti saldati (cuciture delle uv)
    key = np.round(pos * 4000).astype(np.int64)
    uniq, of = np.unique(key, axis=0, return_inverse=True)
    of = of.reshape(-1)
    W = len(uniq)
    P = np.zeros((W, 3))
    cnt = np.zeros(W)
    np.add.at(P, of, pos)
    np.add.at(cnt, of, 1)
    P /= cnt[:, None]

    # forza: peso sui segmenti da levigare; i vertici solo della testa nuova no
    segs = js["segments"]
    ok_seg = np.array([s in SMOOTH for s in segs] + [False] * 256)
    s_v = (wt * ok_seg[np.clip(jo, 0, len(ok_seg) - 1)]).sum(1)
    body_v = np.zeros(n, bool)
    body_v[tri.reshape(-1)] = True
    s_v[~body_v] = 0
    S = np.ones(W)
    np.minimum.at(S, of, s_v)  # un punto saldato si leviga solo quanto il suo vertice meno levigabile

    # vicini (lati dei triangoli del corpo, sui punti saldati)
    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    e = of[e]
    e = e[e[:, 0] != e[:, 1]]
    e = np.unique(np.sort(e, 1), axis=0)
    a, b = e[:, 0], e[:, 1]
    deg = np.bincount(a, minlength=W) + np.bincount(b, minlength=W)
    deg = np.maximum(deg, 1)

    # sfumatura della forza: due giri di media sui vicini (niente gradino tra levigato e no)
    for _ in range(2):
        acc = np.zeros(W)
        np.add.at(acc, a, S[b])
        np.add.at(acc, b, S[a])
        S = np.minimum(S, 0.5 * S + 0.5 * acc / deg)
    S = np.clip(S, 0, 1)

    def lap(X: np.ndarray) -> np.ndarray:
        acc = np.zeros_like(X)
        np.add.at(acc, a, X[b])
        np.add.at(acc, b, X[a])
        return acc / deg[:, None] - X

    Q = P.copy()
    for _ in range(passes):
        Q += (0.5 * S)[:, None] * lap(Q)
        Q += (-0.53 * S)[:, None] * lap(Q)
    # solo lungo la normale: il punto non scivola sulla pelle (uv, bordo dei pantaloncini e ombre restano dove sono)
    old_nw = np.zeros((W, 3))
    np.add.at(old_nw, of, rec[:, 12:15].view(np.int8).astype(np.float64) / 127.0)
    old_nw /= np.maximum(np.linalg.norm(old_nw, axis=1, keepdims=True), 1e-12)
    Q = P + ((Q - P) * old_nw).sum(1, keepdims=True) * old_nw
    move = np.linalg.norm(Q - P, axis=1)
    print(f"punti {W}, levigati {int((S > 0.01).sum())}, spostamento medio {move[S > 0.01].mean() * 1000:.1f} mm, massimo {move.max() * 1000:.1f} mm")

    # normali dalla forma nuova (per i punti levigati)
    newpos = Q[of]
    v0, v1, v2 = newpos[tri[:, 0]], newpos[tri[:, 1]], newpos[tri[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    NW = np.zeros((W, 3))
    for c in range(3):
        np.add.at(NW, of[tri[:, c]], fn)
    NW /= np.maximum(np.linalg.norm(NW, axis=1, keepdims=True), 1e-12)
    old_n = rec[:, 12:15].view(np.int8).astype(np.float64) / 127.0
    nn = NW[of]
    # verso come quello salvato
    flip = (nn * old_n).sum(1) < 0
    nn[flip] *= -1
    sv = S[of][:, None]
    blend = old_n * (1 - sv) + nn * sv
    blend /= np.maximum(np.linalg.norm(blend, axis=1, keepdims=True), 1e-12)

    out = rec.copy()
    mv = S[of] > 0.0
    newp = np.where(mv[:, None], newpos, pos).astype(np.float32)
    out[:, 0:12] = newp.view(np.uint8).reshape(n, 12)
    out[:, 12:15] = np.round(np.clip(blend, -1, 1) * 127).astype(np.int8).view(np.uint8)
    raw[m["vOffset"] : m["vOffset"] + n * st] = out.tobytes()
    out_p.write_bytes(bytes(raw))
    print("scritto", out_p)


if __name__ == "__main__":
    main()
