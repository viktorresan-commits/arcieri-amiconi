"""Muscoli del viso e dell'occhio (Z-Anatomy, CC BY-SA 4.0) aggiunti ai corpi già fatti, e bianco degli occhi segnato.

build.py li lasciava fuori (non servivano all'analisi del gesto): senza, la testa dei muscoli era vuota. Qui si
prendono da Z-Anatomy (stessa sorgente degli altri muscoli: Startup.blend letto da za_blend.py, cache in
/tmp/za_blend2.pkl), si portano sulle ossa di BodyParts3D con lo stesso campo di za_fit2.py, si girano verso
l'esterno (le copie di sinistra sono specchiate) e si aggiungono come un blocco di muscoli in più:
- mimici, masticatori, galea (aponeurosi dell'epicranio, chiara come un tendine), pavimento della bocca;
- muscoli dell'occhio dentro l'orbita (retti, obliqui, elevatore della palpebra);
- il platisma passa dalla testa al torace lungo il collo.
Seguono la testa (il platisma anche il torace). Il bianco degli occhi (sclera) prende il valore 0,5 nel canale
dei tendini delle ossa (l'iride ha già 1): nell'app diventa bianco lucido con iride e pupilla.

    BP3D_MODELS=<human-atlas>/public/models/ python3 add_face.py ../../public/anatomia/corpo:0.3 ../../public/anatomia/corpo-leggero:0.15 ../../public/anatomia/corpo-hd:0.7

(il numero è quanta parte dei triangoli tenere; ripeterlo non aggiunge due volte: il segno "viso" in `ritocchi`)
"""
import gzip
import json
import os
import re
import sys

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decimate import recompute_normals  # noqa: E402
from qem import simplify as qem_simplify  # noqa: E402
from za_blend import load as za_load  # noqa: E402
from za_fit2 import bone_field, world as za_world  # noqa: E402

FACE = re.compile(r"frontalis|occipitalis|temporalis muscle|temporoparietalis|epicranial aponeurosis|orbicularis|zygomaticus|risorius|depressor|levator labii|levator anguli|levator nasolabialis|nasalis|procerus|mentalis|corrugator|bucinator|masseter|platysma|digastric|mylohyoid|stylohyoid|levator palpebrae|(superior|inferior|lateral|medial) rectus muscle|(superior|inferior) oblique muscle|trochlea of superior oblique", re.I)
WHITE = re.compile(r"aponeurosis|intermediate tendon|trochlea", re.I)
NECK = re.compile(r"platysma", re.I)


def weld(P, I):
    key = np.round(P / 0.00002).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    I = inv[I]
    I = I[(I[:, 0] != I[:, 1]) & (I[:, 1] != I[:, 2]) & (I[:, 0] != I[:, 2])]
    used = np.unique(I)
    remap = np.full(len(first), -1)
    remap[used] = np.arange(len(used))
    return P[first][used], remap[I]


def outward(P, I):
    """gira i pezzi chiusi rovesciati (volume con segno negativo)"""
    n = len(P)
    r = np.concatenate([I[:, 0], I[:, 1], I[:, 2]])
    c = np.concatenate([I[:, 1], I[:, 2], I[:, 0]])
    nc, lab = connected_components(coo_matrix((np.ones(len(r)), (r, c)), shape=(n, n)), directed=False)
    fl = lab[I[:, 0]]
    for k in range(nc):
        fs = np.where(fl == k)[0]
        if not len(fs):
            continue
        a, b, cc = P[I[fs, 0]], P[I[fs, 1]], P[I[fs, 2]]
        cen = (a + b + cc).mean(0) / 3
        area = np.linalg.norm(np.cross(b - a, cc - a), axis=1).sum() / 2
        vol = np.einsum('ij,ij->i', a - cen, np.cross(b - cen, cc - cen)).sum() / 6
        if area > 0 and vol / area ** 1.5 < -0.02:
            I[fs] = I[fs][:, [0, 2, 1]]
    return I


def face_parts(keep, warp):
    out = []
    for z in za_load():
        nm = z['name']
        if z['cat'] != 'Muscular system' or z['mods'] or not FACE.search(nm):
            continue
        P, I = weld(za_world(z), z['I'])
        if np.linalg.det(z['M'][:3, :3]) < 0:
            I = I[:, [0, 2, 1]]
        if len(I) < 20:
            continue
        if keep < 1 and len(I) > 200:
            P, I, _ = qem_simplify(P, I, max(160, int(len(I) * keep)))
            P, I = weld(P, I)
        P = warp(P)
        I = outward(P, I)
        out.append(dict(name=nm, P=P, I=I, N=recompute_normals(P, I)))
    return out


def encode(parts, meta):
    lo, hi = np.array(meta['lo']), np.array(meta['hi'])
    segs = meta['segments']
    TE, TO = segs.index('testa'), segs.index('torace')
    rows, idx, off = [], [], 0
    for x in parts:
        P, N, I = x['P'], x['N'], x['I']
        n = len(P)
        Q = P - P.mean(0)
        _, _, vt = np.linalg.svd(Q, full_matrices=False)
        t = Q @ vt[0]
        t = (t - t.min()) / max(1e-6, t.max() - t.min())
        a = Q @ vt[1]
        a = (a - a.min()) / max(0.05, a.max() - a.min())
        J = np.full((n, 2), TE, np.uint8)
        W = np.ones(n)
        if NECK.search(x['name']):
            # collo: dalla mandibola (testa) alla clavicola (torace)
            J[:, 1] = TO
            s = np.clip((P[:, 1] - 1.43) / (1.52 - 1.43), 0, 1)
            W = s * s * (3 - 2 * s)
        TD = np.ones(n) if WHITE.search(x['name']) else np.zeros(n)
        q = np.round(np.clip((P - lo) / (hi - lo), 0, 1) * 65535).astype(np.uint16)
        nq = np.round(np.clip(N, -1, 1) * 127).astype(np.int8)
        V = np.zeros((n, 16), np.uint8)
        V[:, 0:6] = np.ascontiguousarray(q).view(np.uint8).reshape(-1, 6)
        V[:, 6:9] = np.ascontiguousarray(nq).view(np.uint8).reshape(-1, 3)
        V[:, 9:11] = J
        V[:, 11] = np.round(W * 255)
        V[:, 12] = 0
        V[:, 13] = np.round(t * 255)
        V[:, 14] = np.round(a * 255)
        V[:, 15] = np.round(TD * 255)
        rows.append(V)
        idx.append(I + off)
        off += n
    V = np.vstack(rows)
    I = np.vstack(idx)
    assert len(V) < 65536, len(V)
    return V, I.astype(np.uint16)


def mark_sclera(raw, meta):
    """bianco degli occhi: i pezzi chiusi delle ossa della testa vicini all'iride, 0,5 nel canale dei tendini"""
    st, lo, hi = meta['stride'], np.array(meta['lo']), np.array(meta['hi'])
    for b in meta['batches']:
        if b['layer'] != 'bone':
            continue
        nv = b['vertices']
        blk = raw[b['vOffset']:b['vOffset'] + nv * st].reshape(nv, st)
        iris = blk[:, 15] > 200
        if not iris.any():
            continue
        p = lo + blk[:, 0:6].copy().view(np.uint16).reshape(-1, 3).astype(np.float64) / 65535 * (hi - lo)
        I = raw[b['iOffset']:b['iOffset'] + b['indices'] * 2].copy().view(np.uint16).astype(np.int64).reshape(-1, 3)
        r = np.concatenate([I[:, 0], I[:, 1], I[:, 2]])
        c = np.concatenate([I[:, 1], I[:, 2], I[:, 0]])
        _, lab = connected_components(coo_matrix((np.ones(len(r)), (r, c)), shape=(nv, nv)), directed=False)
        n_sc = 0
        for s in (1, -1):
            sel = iris & (np.sign(p[:, 0]) == s)
            ec = p[sel].mean(0) - np.array([0, 0, 0.0115])
            near = np.linalg.norm(p - ec, axis=1) < 0.0175
            for k in np.unique(lab[near & ~iris]):
                comp = lab == k
                if (np.linalg.norm(p[comp] - ec, axis=1) < 0.0175).all() and not (comp & iris).any():
                    blk[comp, 15] = 128
                    n_sc += int(comp.sum())
        raw[b['vOffset']:b['vOffset'] + nv * st] = blk.reshape(-1)
        print('  sclera: vertici', n_sc)


def main(base, keep, warp):
    meta = json.load(open(base + '.json'))
    if 'viso' in meta.get('ritocchi', []):
        print(os.path.basename(base), 'ha già il viso')
        return
    plain, packed = base + '.bin', base + '.bin.gz'
    raw = np.fromfile(plain, dtype=np.uint8).copy() if os.path.exists(plain) else np.frombuffer(gzip.open(packed).read(), dtype=np.uint8).copy()
    raw = raw[:meta['bytes']]
    mark_sclera(raw, meta)
    parts = face_parts(keep, warp)
    V, I = encode(parts, meta)
    blob = bytearray(raw.tobytes())
    while len(blob) % 4:
        blob.append(0)
    vo = len(blob)
    blob.extend(V.tobytes())
    while len(blob) % 4:
        blob.append(0)
    io = len(blob)
    blob.extend(I.tobytes())
    meta['batches'].append(dict(layer='muscle', vertices=int(len(V)), indices=int(I.size), vOffset=vo, iOffset=io))
    meta['bytes'] = len(blob)
    meta.setdefault('ritocchi', []).append('viso')
    print(os.path.basename(base), 'viso: muscoli', len(parts), 'vertici', len(V), 'triangoli', len(I))
    if os.path.exists(plain):
        open(plain, 'wb').write(blob)
    with gzip.GzipFile(packed, 'wb', compresslevel=9, mtime=0) as f:
        f.write(bytes(blob))
    with open(base + '.json', 'w') as f:
        f.write(json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    warp, _, info = bone_field()
    print('ossa Z-Anatomy -> BodyParts3D, scarto mediano mm', round(info['err_mm'], 2))
    for arg in sys.argv[1:]:
        base, keep = arg.rsplit(':', 1)
        main(base, float(keep), warp)
