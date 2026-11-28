"""Nervi periferici e cranici (Z-Anatomy, CC BY-SA 4.0) come tubicini, aggiunti ai corpi già fatti (strato "nerve").

In Z-Anatomy i nervi sono curve con un raggio (non maglie): si estraggono da Startup.blend con
za_nerve_curves.py (cache /tmp/za_nerve_curves.pkl: polilinee, raggi, matrice dell'oggetto),
si portano sulle ossa di BodyParts3D con lo stesso campo di za_fit2.py e si fanno tubi di poche facce. Il raggio
vero (0,15-1 mm) sul telefono non si vedrebbe: si tiene tra 0,7 e 2,2 mm, i tronchi più grossi. Ogni punto segue
i due segmenti con le ossa più vicine, scelti tra quelli della sua regione (braccio, gamba, testa e collo, busto),
come i muscoli.

    BP3D_MODELS=<human-atlas>/public/models/ python3 add_nerves.py ../../public/anatomia/corpo:0.010:6 ../../public/anatomia/corpo-leggero:0.022:4 ../../public/anatomia/corpo-hd:0.006:8

(base:passo in metri:lati del tubo; ripeterlo non aggiunge due volte: il segno "nervi" in `ritocchi`)
"""
import gzip
import json
import os
import pickle
import re
import sys

import numpy as np
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from za_fit2 import YUP, bone_field  # noqa: E402

CURVES = os.environ.get('ZA_NERVES', '/tmp/za_nerve_curves.pkl')
SIG = 0.022
ARM = re.compile(r"median|ulnar|radial|musculocutaneous|axillary|antebrachial|brachial cutaneous|palmar|interosseous nerve of forearm|thenar|digital branches of (median|ulnar|radial)", re.I)
SHOULDER = re.compile(r"brachial plexus|suprascapular|subscapular|thoracodorsal|pectoral nerve|long thoracic|dorsal scapular|cord of", re.I)
LEG = re.compile(r"sciatic|tibial|fibular|sural|saphenous|femoral|obturator|plantar|gluteal|cutaneous nerve of thigh|crural|genitofemoral|pudendal|quadratus femoris|piriformis|calcaneal|interdigital|cutaneous nerve of foot|lumbosacral", re.I)
HEAD = re.compile(r"\((I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\)|mandibular|maxillary|ophthalmic|lingual|buccal|mental|alveolar|auriculotemporal|facial|trigeminal|cochlear|vestibular|optic|olfactory|orbital|lacrimal|nasociliary|zygomatic|chorda|occipital|auricular|cervical|phrenic|mylohyoid|masseteric|temporal|hypoglossal|ansa", re.I)


def side_of(name):
    if re.search(r"\.l$", name):
        return 'L'
    if re.search(r"\.r$", name):
        return 'R'
    return None


def candidates(name, segs):
    s = side_of(name)
    sides = [s] if s else ['L', 'R']
    seg = lambda *ns: [segs.index(f'{n}_{sd}') if n not in ('bacino', 'torace', 'testa') else segs.index(n) for n in ns for sd in sides]
    if ARM.search(name):
        return seg('clav', 'omero', 'avambr', 'mano', 'dita', 'pollice')
    if SHOULDER.search(name):
        return seg('torace', 'clav', 'omero', 'testa')
    if LEG.search(name):
        return seg('bacino', 'coscia', 'gamba', 'piede')
    if HEAD.search(name):
        return seg('testa', 'torace', 'clav')
    return seg('bacino', 'torace', 'testa')


def bone_trees(raw, meta):
    st, lo, hi = meta['stride'], np.array(meta['lo']), np.array(meta['hi'])
    pts, sg = [], []
    for b in meta['batches']:
        if b['layer'] != 'bone':
            continue
        blk = raw[b['vOffset']:b['vOffset'] + b['vertices'] * st].reshape(-1, st)
        p = lo + blk[:, 0:6].copy().view(np.uint16).reshape(-1, 3).astype(np.float64) / 65535 * (hi - lo)
        one = blk[:, 9] == blk[:, 10]
        pts.append(p[one])
        sg.append(blk[one, 9])
    P, S = np.vstack(pts), np.concatenate(sg)
    return {int(s): cKDTree(P[S == s]) for s in np.unique(S)}


def resample(pts, rad, step):
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    if d[-1] < 1e-4:
        return None, None
    n = max(2, int(np.ceil(d[-1] / step)) + 1)
    t = np.linspace(0, d[-1], n)
    return np.stack([np.interp(t, d, pts[:, k]) for k in range(3)], 1), np.interp(t, d, rad)


def tube(C, R, sides):
    """anelli di 'sides' punti attorno alla polilinea C (n x 3), raggi R; tappi piatti alle due estremità"""
    n = len(C)
    T = np.gradient(C, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None] + 1e-12
    # cornice che scorre senza girare (trasporto parallelo)
    a = np.array([0.0, 1.0, 0.0]) if abs(T[0][1]) < 0.9 else np.array([1.0, 0.0, 0.0])
    U = np.zeros((n, 3))
    U[0] = np.cross(T[0], a)
    U[0] /= np.linalg.norm(U[0])
    for i in range(1, n):
        u = U[i - 1] - T[i] * np.dot(U[i - 1], T[i])
        l = np.linalg.norm(u)
        U[i] = u / l if l > 1e-9 else U[i - 1]
    Vv = np.cross(T, U)
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    N = (np.cos(ang)[None, :, None] * U[:, None, :] + np.sin(ang)[None, :, None] * Vv[:, None, :])
    P = C[:, None, :] + N * R[:, None, None]
    P, N = P.reshape(-1, 3), N.reshape(-1, 3)
    I = []
    for i in range(n - 1):
        for k in range(sides):
            a0, a1 = i * sides + k, i * sides + (k + 1) % sides
            b0, b1 = a0 + sides, a1 + sides
            I += [[a0, a1, b1], [a0, b1, b0]]
    t = np.repeat(np.linspace(0, 1, n), sides)
    w = np.tile(np.arange(sides) / sides, n)
    return P, N, np.array(I, np.int64), t, w


def build_nerves(meta, raw, warp, step, sides):
    segs = meta['segments']
    trees = bone_trees(raw, meta)
    parts = []
    for x in pickle.load(open(CURVES, 'rb')):
        cand = [c for c in candidates(x['name'], segs) if c in trees]
        for pts, rad, _ in x['lines']:
            W = (np.c_[pts, np.ones(len(pts))] @ x['M'])[:, :3] @ YUP.T
            C, R = resample(W, rad, step)
            if C is None:
                continue
            C = warp(C)
            R = np.clip(0.0009 * R, 0.0007, 0.0022)
            P, N, I, t, w = tube(C, R, sides)
            D = np.full((len(P), len(segs)), 9.0)
            for c in cand:
                D[:, c] = trees[c].query(P)[0]
            order = np.argsort(D, 1)[:, :2]
            d0 = np.take_along_axis(D, order[:, :1], 1)[:, 0]
            d1 = np.take_along_axis(D, order[:, 1:2], 1)[:, 0]
            w0 = 1 / (1 + np.exp(-(d1 - d0) / SIG * 2.2))
            parts.append(dict(P=P, N=N, I=I, J=order.astype(np.uint8), W=w0, T=t, A=w))
    return parts


def encode(parts, meta):
    lo, hi = np.array(meta['lo']), np.array(meta['hi'])
    chunks, cur, cnt = [], [], 0
    for x in parts:
        if cnt + len(x['P']) > 65000 and cur:
            chunks.append(cur)
            cur, cnt = [], 0
        cur.append(x)
        cnt += len(x['P'])
    if cur:
        chunks.append(cur)
    out = []
    for ch in chunks:
        P = np.vstack([x['P'] for x in ch])
        N = np.vstack([x['N'] for x in ch])
        off = np.cumsum([0] + [len(x['P']) for x in ch[:-1]])
        I = np.vstack([x['I'] + o for x, o in zip(ch, off)])
        V = np.zeros((len(P), 16), np.uint8)
        q = np.round(np.clip((P - lo) / (hi - lo), 0, 1) * 65535).astype(np.uint16)
        V[:, 0:6] = np.ascontiguousarray(q).view(np.uint8).reshape(-1, 6)
        V[:, 6:9] = np.ascontiguousarray(np.round(np.clip(N, -1, 1) * 127).astype(np.int8)).view(np.uint8).reshape(-1, 3)
        V[:, 9:11] = np.vstack([x['J'] for x in ch])
        V[:, 11] = np.round(np.concatenate([x['W'] for x in ch]) * 255)
        V[:, 13] = np.round(np.concatenate([x['T'] for x in ch]) * 255)
        V[:, 14] = np.round(np.concatenate([x['A'] for x in ch]) * 255)
        out.append((V, I.astype(np.uint16)))
    return out


def main(base, step, sides, warp):
    meta = json.load(open(base + '.json'))
    if 'nervi' in meta.get('ritocchi', []):
        print(os.path.basename(base), 'ha già i nervi')
        return
    plain, packed = base + '.bin', base + '.bin.gz'
    raw = np.fromfile(plain, dtype=np.uint8).copy() if os.path.exists(plain) else np.frombuffer(gzip.open(packed).read(), dtype=np.uint8).copy()
    raw = raw[:meta['bytes']]
    parts = build_nerves(meta, raw, warp, step, sides)
    blob = bytearray(raw.tobytes())
    nv = 0
    for V, I in encode(parts, meta):
        while len(blob) % 4:
            blob.append(0)
        vo = len(blob)
        blob.extend(V.tobytes())
        while len(blob) % 4:
            blob.append(0)
        io = len(blob)
        blob.extend(I.tobytes())
        meta['batches'].append(dict(layer='nerve', vertices=int(len(V)), indices=int(I.size), vOffset=vo, iOffset=io))
        nv += len(V)
    meta['bytes'] = len(blob)
    meta.setdefault('ritocchi', []).append('nervi')
    if 'nervi' not in meta['source']:
        meta['source'] += ' Nervi da Z-Anatomy (CC BY-SA 4.0), come tubi.'
    print(os.path.basename(base), 'nervi: tratti', len(parts), 'vertici', nv)
    if os.path.exists(plain):
        open(plain, 'wb').write(blob)
    with gzip.GzipFile(packed, 'wb', compresslevel=9, mtime=0) as f:
        f.write(bytes(blob))
    with open(base + '.json', 'w') as f:
        f.write(json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    warp, _, info = bone_field()
    for arg in sys.argv[1:]:
        base, step, sides = arg.rsplit(':', 2)
        main(base, float(step), int(sides), warp)
