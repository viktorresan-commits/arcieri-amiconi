"""
Attacco tra testa e collo della pelle vera. La testa (con la foto del viso) e il corpo sono due pezzi che si toccano
lungo un anello sotto la nuca e la mandibola; stendendo la pelle sull'atlante (wrap_skin.py) l'orlo del collo era
rimasto spiegazzato: un triangolo su dieci a meno di un centimetro dall'anello era ribaltato. In posa l'orlo si
vedeva come una frangia a denti tra capelli e collo, e sotto la mandibola.

Qui i punti dei due pezzi sull'anello diventano uno solo (stessa posizione: nell'app si saldano e si muovono
insieme) e la pelle attorno, per 3,5 cm, si distende (Taubin, piena vicino all'anello e sempre meno lontano) finché
non resta nessun triangolo ribaltato. Le uv restano (la grana scorre di qualche millimetro).

Uso: python3 scripts/anatomia/fix_neck.py <pelle.json> <pelle.bin> [uscita.bin]
(dopo fit_feet.py, prima di cloth_mask.py)
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

R_FULL = 0.012
R_OUT = 0.035
RING_IT = 25
RELAX_IT = 12
TAUBIN_IT = 20


def smoothstep(a: float, b: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def main() -> None:
    js_p, bin_p = Path(sys.argv[1]), Path(sys.argv[2])
    out_p = Path(sys.argv[3]) if len(sys.argv) > 3 else bin_p
    js = json.loads(js_p.read_text())
    raw = bytearray(bin_p.read_bytes())
    st = js["stride"]
    m = js["meshes"]["corpo"]
    n = m["n"]
    rec = np.frombuffer(bytes(raw[m["vOffset"] : m["vOffset"] + n * st]), dtype=np.uint8).reshape(n, st).copy()
    pos = rec[:, 0:12].copy().view(np.float32).reshape(n, 3).astype(np.float64)
    nrm = rec[:, 12:15].view(np.int8).astype(np.float64) / 127.0
    idx = np.frombuffer(bytes(raw[m["iOffset"] : m["iOffset"] + m["indices"] * 2]), dtype=np.uint16).astype(np.int64)
    hs = m["headStart"]
    tri = idx.reshape(-1, 3)
    nb = hs // 3
    used = np.unique(tri)

    # saldatura per vicinanza (0,6 mm): anche i punti dei due pezzi sull'anello
    parent = np.arange(n)

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b in cKDTree(pos[used]).query_pairs(0.0006):
        ra, rb = find(used[a]), find(used[b])
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)
    root = np.array([find(i) for i in range(n)])
    _, of = np.unique(root, return_inverse=True)
    W = of.max() + 1
    P = np.zeros((W, 3))
    cnt = np.zeros(W)
    np.add.at(P, of[used], pos[used])
    np.add.at(cnt, of[used], 1)
    P /= np.maximum(cnt, 1)[:, None]

    def bnd(T: np.ndarray) -> np.ndarray:
        e = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
        e = of[e]
        e = e[e[:, 0] != e[:, 1]]
        s = np.sort(e, 1)
        u, c = np.unique(s, axis=0, return_counts=True)
        return np.unique(u[c == 1])

    head_b = bnd(tri[nb:])
    body_b = bnd(tri[:nb])
    ring = np.intersect1d(head_b, body_b)
    print(f"anello testa-collo: {len(ring)} punti in comune (orli: testa {len(head_b)}, corpo {len(body_b)})")
    d, _ = cKDTree(P[ring]).query(P)
    w = 1 - smoothstep(R_FULL, R_OUT, d)
    w[cnt == 0] = 0

    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    e = of[e]
    e = e[e[:, 0] != e[:, 1]]
    e = np.unique(np.sort(e, 1), axis=0)
    a, b = e[:, 0], e[:, 1]
    deg = np.maximum(np.bincount(a, minlength=W) + np.bincount(b, minlength=W), 1)

    def lap(X: np.ndarray) -> np.ndarray:
        acc = np.zeros_like(X)
        np.add.at(acc, a, X[b])
        np.add.at(acc, b, X[a])
        return acc / deg[:, None] - X

    near = d < 0.012
    tri_w = of[tri]
    tri_near = near[tri_w].any(1)

    def flipped(Q: np.ndarray) -> int:
        f = np.cross(Q[tri_w[:, 1]] - Q[tri_w[:, 0]], Q[tri_w[:, 2]] - Q[tri_w[:, 0]])
        f /= np.maximum(np.linalg.norm(f, axis=1, keepdims=True), 1e-15)
        vn = np.zeros((W, 3))
        np.add.at(vn, of, nrm)
        vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
        ref = vn[tri_w].mean(1)
        return int(((f * ref).sum(1) < 0)[tri_near].sum())

    print("triangoli ribaltati vicino all'anello prima:", flipped(P))
    Q = P.copy()
    # 1) l'anello come una curva: in ordine attorno al collo, levigato (era a zig-zag di 3-8 mm)
    ce = Q[ring].mean(0)
    order = ring[np.argsort(np.arctan2(Q[ring, 0] - ce[0], Q[ring, 2] - ce[2]))]
    for _ in range(RING_IT):
        C = Q[order]
        Q[order] = C + 0.5 * (0.5 * (np.roll(C, 1, 0) + np.roll(C, -1, 0)) - C)
    fixed = np.zeros(W, bool)
    fixed[ring] = True
    # 2) attorno all'anello la pelle si distende (Laplaciano, anello fermo), poi Taubin per non restringere
    wf_ = np.where(fixed, 0.0, w)
    for _ in range(RELAX_IT):
        Q = Q + 0.6 * wf_[:, None] * lap(Q)
    for it in range(TAUBIN_IT):
        Q = Q + 0.5 * wf_[:, None] * lap(Q)
        Q = Q - 0.53 * wf_[:, None] * lap(Q)
    print("triangoli ribaltati vicino all'anello dopo:", flipped(Q))
    moved = w > 0
    print(f"spostamento medio {np.linalg.norm(Q - P, axis=1)[moved].mean() * 1000:.1f} mm, massimo {np.linalg.norm(Q - P, axis=1)[moved].max() * 1000:.1f} mm")

    # normali dalla forma nuova nella zona toccata
    v0, v1, v2 = Q[tri_w[:, 0]], Q[tri_w[:, 1]], Q[tri_w[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    NN = np.zeros((W, 3))
    for c in range(3):
        np.add.at(NN, tri_w[:, c], fn)
    NN /= np.maximum(np.linalg.norm(NN, axis=1, keepdims=True), 1e-12)
    vtx_moved = moved[of] & np.isin(np.arange(n), used)
    nn = NN[of]
    nn[(nn * nrm).sum(1) < 0] *= -1
    f = np.clip(w[of] / 0.3, 0, 1)[:, None]
    bl = nrm * (1 - f) + nn * f
    bl /= np.maximum(np.linalg.norm(bl, axis=1, keepdims=True), 1e-12)
    new = np.where(vtx_moved[:, None], Q[of], pos)
    # i punti saldati prendono la stessa posizione esatta (float32): nell'app si saldano
    rec[:, 0:12] = new.astype(np.float32).view(np.uint8).reshape(n, 12)
    rec[:, 12:15] = np.round(np.clip(np.where(vtx_moved[:, None], bl, nrm), -1, 1) * 127).astype(np.int8).view(np.uint8)
    raw[m["vOffset"] : m["vOffset"] + n * st] = rec.tobytes()
    out_p.write_bytes(bytes(raw))
    print("scritto", out_p)


if __name__ == "__main__":
    main()
