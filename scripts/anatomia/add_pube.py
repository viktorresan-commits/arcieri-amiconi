"""Copertura del pube e dell'inguine, come nelle tavole anatomiche per tutti (anche per i minori).

Tra il legamento inguinale e l'interno delle cosce l'atlante lasciava un vuoto: l'osso del pube scoperto, i
nervi e i vasi del triangolo femorale e, in mezzo alle cosce, il fondo scuro. Nelle tavole quella parte è il
basso ventre senza organi: il retto dell'addome (e il piramidale) scende rosso fino al pube restringendosi a
«V», con una fascia color crema stretta lungo il legamento inguinale ai due lati e un piccolo tratto crema
arrotondato sul pube. Una fascia tutta bianca, larga, sembrava una mutanda.

La superficie non viene da nessun modello del corpo: è costruita qui, appena davanti a muscoli e ossa visti di
fronte, con una palla di 5 cm fatta rotolare sopra (copre solchi e fessure come una membrana tesa), poi levigata.
In basso, tra le cosce, si ripiega indietro e si arrotonda. Ogni punto segue i segmenti del muscolo più vicino
(bacino e cosce): si muove con il corpo. Nei dati è un muscolo del gruppo «addome»: rosso con le fibre che
scendono verso il pube nel mezzo, canale dei tendini pieno (crema) lungo i lati, sul pube e sulla linea alba.

    python3 add_pube.py ../../public/anatomia/corpo-hd ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero

(il primo corpo, il più fitto, dà la forma; tutti ricevono la stessa copertura). Con --rifai si toglie prima
quella già aggiunta (l'ultimo pezzo dei dati) e la si rifà.
"""
import gzip
import json
import os
import sys

import numpy as np
from matplotlib.path import Path as MPath
from scipy.ndimage import gaussian_filter, map_coordinates
from scipy.spatial import cKDTree

H = 0.004  # m, passo della griglia
X0, X1, Y0, Y1 = -0.15, 0.15, 0.74, 1.01
# contorno visto di fronte (x verso la sinistra della persona): la «V» del legamento inguinale in alto, i lati
# lungo l'interno delle cosce fino all'inforcatura
OUTLINE = [(-0.118, 0.982), (0.0, 0.897), (0.118, 0.982), (0.034, 0.776), (0.0, 0.762), (-0.034, 0.776)]
BALL = 0.05
LIFT = 0.0025  # davanti ai muscoli


def load(base):
    meta = json.load(open(base + '.json'))
    plain, packed = base + '.bin', base + '.bin.gz'
    raw = np.fromfile(plain, dtype=np.uint8).copy() if os.path.exists(plain) else np.frombuffer(gzip.open(packed).read(), dtype=np.uint8).copy()
    return meta, raw[:meta['bytes']]


def verts(meta, raw, b):
    st, lo, hi = meta['stride'], np.array(meta['lo']), np.array(meta['hi'])
    nv = b['vertices']
    blk = raw[b['vOffset']:b['vOffset'] + nv * st].reshape(nv, st)
    p = lo + blk[:, 0:6].copy().view(np.uint16).reshape(-1, 3).astype(np.float64) / 65535 * (hi - lo)
    return p, blk


def surface(meta, raw):
    pts = []
    for b in meta['batches']:
        # anche i nervi: la fascia li copre (quelli del triangolo femorale restano sotto)
        if b['layer'] not in ('muscle', 'bone', 'nerve'):
            continue
        p, _ = verts(meta, raw, b)
        m = (p[:, 1] > Y0 - BALL) & (p[:, 1] < Y1 + BALL) & (np.abs(p[:, 0]) < X1 + BALL) & (p[:, 2] > -0.05)
        pts.append(p[m])
    P = np.concatenate(pts)
    nx = int(round((X1 - X0) / H)) + 1
    ny = int(round((Y1 - Y0) / H)) + 1
    pad = int(np.ceil(BALL / H))
    Z = np.full((ny + 2 * pad, nx + 2 * pad), -1.0)
    ix = np.round((P[:, 0] - X0) / H).astype(int) + pad
    iy = np.round((P[:, 1] - Y0) / H).astype(int) + pad
    ok = (ix >= 0) & (ix < Z.shape[1]) & (iy >= 0) & (iy < Z.shape[0])
    np.maximum.at(Z, (iy[ok], ix[ok]), P[ok, 2])
    # palla che rotola sul davanti: chiusura con una sfera (dilatazione, poi erosione)
    offs = [(dy, dx) for dy in range(-pad, pad + 1) for dx in range(-pad, pad + 1) if (dy * dy + dx * dx) * H * H <= BALL * BALL]
    sph = {o: np.sqrt(BALL * BALL - (o[0] ** 2 + o[1] ** 2) * H * H) - BALL for o in offs}
    D = np.full_like(Z, -1.0)
    for (dy, dx), s in sph.items():
        D = np.maximum(D, np.roll(np.roll(Z, dy, 0), dx, 1) + s)
    C = np.full_like(Z, 1.0)
    for (dy, dx), s in sph.items():
        C = np.minimum(C, np.roll(np.roll(D, dy, 0), dx, 1) - s)
    C = C[pad:-pad, pad:-pad]
    Zc = Z[pad:-pad, pad:-pad]
    # levigata come una membrana, mai dentro i muscoli
    S = gaussian_filter(C, 2.5)
    S = np.maximum(S, gaussian_filter(np.where(Zc > -0.5, Zc, C), 1.0) + 0.001) + LIFT
    xs = X0 + np.arange(nx) * H
    ys = Y0 + np.arange(ny) * H
    X, Y = np.meshgrid(xs, ys)
    # in basso, tra le cosce, la fascia si ripiega indietro (fino a 4 cm) e si arrotonda
    k = np.clip((0.805 - Y) / 0.043, 0, 1)
    S = S - 0.04 * k * k
    inside = MPath(OUTLINE).contains_points(np.c_[X.ravel(), Y.ravel()]).reshape(X.shape)
    # celle con i quattro angoli dentro il contorno
    cell = inside[:-1, :-1] & inside[1:, :-1] & inside[:-1, 1:] & inside[1:, 1:]
    used = np.zeros_like(inside)
    used[:-1, :-1] |= cell
    used[1:, :-1] |= cell
    used[:-1, 1:] |= cell
    used[1:, 1:] |= cell
    idx = -np.ones(X.shape, np.int64)
    idx[used] = np.arange(used.sum())
    V = np.c_[X[used], Y[used], S[used]]
    tris = []
    for j, i in zip(*np.nonzero(cell)):
        a, b_, c, d = idx[j, i], idx[j, i + 1], idx[j + 1, i + 1], idx[j + 1, i]
        # visti da davanti (+z) in senso antiorario
        tris += [(a, b_, c), (a, c, d)]
    I = np.array(tris, np.int64)
    # bordo liscio: i punti del bordo della griglia vanno sul contorno (niente gradini)
    e = np.sort(np.r_[I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]], axis=1)
    ue, cnt = np.unique(e, axis=0, return_counts=True)
    border = np.unique(ue[cnt == 1].ravel())
    O = np.array(OUTLINE + OUTLINE[:1])
    for v in border:
        p = V[v, :2]
        best, bd = p, 1e9
        for k_ in range(len(O) - 1):
            a_, b2 = O[k_], O[k_ + 1]
            ab = b2 - a_
            tt = np.clip(np.dot(p - a_, ab) / np.dot(ab, ab), 0, 1)
            c_ = a_ + ab * tt
            dd = np.linalg.norm(c_ - p)
            if dd < bd:
                best, bd = c_, dd
        if bd < 2.5 * H:
            V[v, :2] = best
    V[:, 2] = map_coordinates(S, [(V[:, 1] - Y0) / H, (V[:, 0] - X0) / H], order=1, mode='nearest')
    N = np.zeros_like(V)
    fn = np.cross(V[I[:, 1]] - V[I[:, 0]], V[I[:, 2]] - V[I[:, 0]])
    for k_ in range(3):
        np.add.at(N, I[:, k_], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    # fibre del basso ventre: scendono verso il pube e si stringono a «V» tra i due legamenti inguinali
    xs = np.clip(0.034 + (V[:, 1] - 0.776) * (0.084 / 0.206), 0.02, 0.118)
    t = np.clip((V[:, 1] - 0.77) / (0.985 - 0.77), 0, 1)
    a = np.clip((V[:, 0] + xs) / (2 * xs), 0, 1)
    # crema (fascia, tendine) dove serve: lungo i legamenti inguinali ai lati, sul pube in basso, la linea alba
    def seg_d(P, A, B):
        A, B = np.array(A), np.array(B)
        ab = B - A
        tt = np.clip(((P - A) @ ab) / (ab @ ab), 0, 1)
        return np.linalg.norm(P - (A + tt[:, None] * ab), axis=1)
    P2 = V[:, :2]
    side = np.minimum(seg_d(P2, OUTLINE[0], OUTLINE[5]), seg_d(P2, OUTLINE[2], OUTLINE[3]))
    sm = lambda e0, e1, x: np.clip((x - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((x - e0) / (e1 - e0), 0, 1))
    band = 1 - sm(0.016, 0.025, side)
    pubis = 1 - sm(0.79, 0.812, V[:, 1])
    alba = (1 - sm(0.0018, 0.0042, np.abs(V[:, 0]))) * sm(0.83, 0.86, V[:, 1]) * 0.85
    tend = np.clip(np.maximum(np.maximum(band, pubis), alba), 0, 1)
    print('copertura del pube: vertici', len(V), 'triangoli', len(I), 'crema', round(float((tend > 0.5).mean()), 2))
    return V, N, I, t, a, tend


ADDOME = 38  # gruppo «addome» (retto dell'addome): colore e lavoro dei muscoli come il resto del ventre


def drop_old(meta, raw):
    """toglie la copertura già aggiunta: è l'ultimo pezzo dei dati, un muscolo che arriva fino in fondo"""
    b = meta['batches'][-1]
    end = b['iOffset'] + b['indices'] * 2
    if b['layer'] != 'muscle' or end + 3 < meta['bytes'] - 3 or (b.get('parte') not in (None, 'pube')):
        raise SystemExit('la copertura del pube non è l\'ultimo pezzo dei dati: non la tolgo')
    meta['batches'].pop()
    meta['ritocchi'].remove('pube')
    meta['bytes'] = b['vOffset']
    return raw[:b['vOffset']]


def main(base, shape, redo=False):
    meta, raw = load(base)
    if 'pube' in meta.get('ritocchi', []):
        if not redo:
            print(os.path.basename(base), 'ha già la copertura del pube')
            return
        raw = drop_old(meta, raw)
    V, N, I, t, a, tend = shape
    lo, hi = np.array(meta['lo']), np.array(meta['hi'])
    # segmenti e gruppo dal muscolo più vicino
    mp, mj = [], []
    for b in meta['batches']:
        if b['layer'] != 'muscle':
            continue
        p, blk = verts(meta, raw, b)
        m = (p[:, 1] > Y0 - 0.06) & (p[:, 1] < Y1 + 0.06) & (np.abs(p[:, 0]) < X1 + 0.06)
        mp.append(p[m])
        mj.append(blk[m, 9:13].copy())
    mp = np.concatenate(mp)
    mj = np.concatenate(mj)
    _, k = cKDTree(mp).query(V)
    n = len(V)
    q = np.round(np.clip((V - lo) / (hi - lo), 0, 1) * 65535).astype(np.uint16)
    nq = np.round(np.clip(N, -1, 1) * 127).astype(np.int8)
    R = np.zeros((n, 16), np.uint8)
    R[:, 0:6] = np.ascontiguousarray(q).view(np.uint8).reshape(-1, 6)
    R[:, 6:9] = np.ascontiguousarray(nq).view(np.uint8).reshape(-1, 3)
    R[:, 9:13] = mj[k]
    R[:, 12] = ADDOME
    R[:, 13] = np.round(t * 255)
    R[:, 14] = np.round(a * 255)
    R[:, 15] = np.round(tend * 255)
    blob = bytearray(raw.tobytes())
    while len(blob) % 4:
        blob.append(0)
    vo = len(blob)
    blob.extend(R.tobytes())
    while len(blob) % 4:
        blob.append(0)
    io = len(blob)
    blob.extend(I.astype(np.uint16).tobytes())
    meta['batches'].append(dict(layer='muscle', vertices=int(n), indices=int(I.size), vOffset=vo, iOffset=io, parte='pube'))
    meta['bytes'] = len(blob)
    meta.setdefault('ritocchi', []).append('pube')
    print(os.path.basename(base), 'copertura del pube aggiunta')
    plain = base + '.bin'
    if os.path.exists(plain):
        open(plain, 'wb').write(blob)
    with gzip.GzipFile(base + '.bin.gz', 'wb', compresslevel=9, mtime=0) as f:
        f.write(bytes(blob))
    with open(base + '.json', 'w') as f:
        f.write(json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    redo = '--rifai' in sys.argv
    bases = [x for x in sys.argv[1:] if x != '--rifai']
    m0, r0 = load(bases[0])
    if redo and 'pube' in m0.get('ritocchi', []):
        r0 = drop_old(m0, r0)
    shape = surface(m0, r0)
    for base in bases:
        main(base, shape, redo)
