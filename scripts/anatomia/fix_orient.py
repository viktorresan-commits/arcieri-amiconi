"""Gira verso l'esterno i muscoli (e le parti di Z-Anatomy tra le ossa) rovesciati.

In Z-Anatomy i muscoli di sinistra (".l") sono la copia specchiata di quelli di destra: la matrice
dell'oggetto ha determinante negativo, quindi i triangoli restano girati al contrario e la normale
punta dentro il muscolo. Con le facce posteriori scartate, di quei muscoli si vedeva solo la parete
interna dalla parte lontana: muscoli vuoti, "buchi" su metà corpo.

Per ogni pezzo chiuso (componente connessa per indici):
- se ha un gemello specchiato dall'altra parte del corpo e le normali non si specchiano, uno dei due è
  rovesciato: quello con volume con segno negativo (o, se entrambi sono fogli aperti, quello a sinistra, x > 0);
- senza gemello si gira solo se il volume con segno è chiaramente negativo.
Si invertono l'ordine dei vertici e le normali. Ripeterlo non cambia nulla (dopo il primo passaggio le coppie
concordano).

    python3 fix_orient.py ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero ../../public/anatomia/corpo-hd

(per ogni nome: `.json` e `.bin` e/o `.bin.gz`; si riscrivono i file presenti)
"""
import gzip
import json
import os
import sys

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

REL = 0.02  # |volume| / area^1.5 oltre il quale il segno del volume è affidabile


def fix_batch(raw, b, st, lo, hi):
    nv = b['vertices']
    blk = raw[b['vOffset']:b['vOffset'] + nv * st].reshape(nv, st)
    q = blk[:, 0:6].copy().view(np.uint16).reshape(-1, 3).astype(np.float64) / 65535
    p = lo + q * (hi - lo)
    iraw = raw[b['iOffset']:b['iOffset'] + b['indices'] * 2]
    idx = iraw.copy().view(np.uint16).astype(np.int64).reshape(-1, 3)
    r = np.concatenate([idx[:, 0], idx[:, 1], idx[:, 2]])
    c = np.concatenate([idx[:, 1], idx[:, 2], idx[:, 0]])
    nc, lab = connected_components(coo_matrix((np.ones(len(r)), (r, c)), shape=(nv, nv)), directed=False)
    fl = lab[idx[:, 0]]
    a, bb, cc = p[idx[:, 0]], p[idx[:, 1]], p[idx[:, 2]]
    fn = np.cross(bb - a, cc - a)
    area = np.linalg.norm(fn, axis=1) / 2
    fc = (a + bb + cc) / 3
    comps = []
    for k in np.unique(fl):
        fs = np.where(fl == k)[0]
        A = area[fs].sum()
        if A < 1e-7:
            continue
        cen = (fc[fs] * area[fs, None]).sum(0) / A
        vol = np.einsum('ij,ij->i', a[fs] - cen, np.cross(bb[fs] - cen, cc[fs] - cen)).sum() / 6
        comps.append(dict(fs=fs, A=A, cen=cen, rel=vol / A ** 1.5))
    cens = np.array([x['cen'] for x in comps])
    tree = cKDTree(cens)
    R = np.array([-1.0, 1.0, 1.0])
    wrong = set()
    done = set()
    for i, x in enumerate(comps):
        if i in done:
            continue
        twin = None
        if abs(x['cen'][0]) > 0.004:
            # il gemello: dall'altra parte, vicino al punto specchiato, di preferenza con gli stessi triangoli
            # (la copia specchiata ha la stessa maglia)
            ds, js = tree.query(x['cen'] * R, k=min(8, len(comps)))
            cand = [(len(comps[j]['fs']) != len(x['fs']), d, j) for d, j in zip(np.atleast_1d(ds), np.atleast_1d(js))
                    if j != i and j not in done and d < 0.03 and 0.7 < comps[j]['A'] / x['A'] < 1.4
                    and np.sign(comps[j]['cen'][0]) != np.sign(x['cen'][0])]
            if cand:
                twin = min(cand)[2]
        if twin is not None:
            done.update((i, twin))
            y = comps[twin]
            ty = cKDTree(fc[y['fs']])
            rng = np.random.default_rng(1)
            sel = x['fs'] if len(x['fs']) <= 400 else rng.choice(x['fs'], 400, replace=False)
            dd, jj = ty.query(fc[sel] * R)
            ny = fn[y['fs'][jj]] * R
            agree = np.sum(np.einsum('ij,ij->i', fn[sel], ny) * (dd < 0.01))
            if agree < 0:
                if max(abs(x['rel']), abs(y['rel'])) > REL:
                    wrong.add(i if x['rel'] < y['rel'] else twin)
                else:
                    wrong.add(i if x['cen'][0] > 0 else twin)
            else:
                # concordano: girati entrambi solo se sono chiusi e rovesciati tutti e due
                if x['rel'] < -REL and y['rel'] < -REL:
                    wrong.update((i, twin))
        elif x['rel'] < -REL:
            wrong.add(i)
    if not wrong:
        return 0, 0.0
    fs = np.concatenate([comps[i]['fs'] for i in wrong])
    idx[fs] = idx[fs][:, [0, 2, 1]]
    verts = np.unique(idx[fs])
    nrm = blk[verts, 6:9].copy().view(np.int8).astype(np.int16)
    blk[verts, 6:9] = np.clip(-nrm, -127, 127).astype(np.int8).view(np.uint8)
    raw[b['vOffset']:b['vOffset'] + nv * st] = blk.reshape(-1)
    raw[b['iOffset']:b['iOffset'] + b['indices'] * 2] = idx.astype(np.uint16).view(np.uint8).reshape(-1)
    return len(wrong), area[fs].sum() / area.sum()


def main(base):
    meta = json.load(open(base + '.json'))
    plain, packed = base + '.bin', base + '.bin.gz'
    if os.path.exists(plain):
        raw = np.fromfile(plain, dtype=np.uint8).copy()
    else:
        raw = np.frombuffer(gzip.open(packed).read(), dtype=np.uint8).copy()
    st, lo, hi = meta['stride'], np.array(meta['lo']), np.array(meta['hi'])
    for bi, b in enumerate(meta['batches']):
        if b['layer'] not in ('muscle', 'bone'):
            continue
        n, frac = fix_batch(raw, b, st, lo, hi)
        print(os.path.basename(base), 'gruppo', bi, b['layer'], 'pezzi girati', n, 'area %.1f%%' % (frac * 100))
    # segno nella descrizione: la sua impronta è la versione del corpo salvato nei telefoni (così si riscarica)
    if 'orientamento' not in meta.setdefault('ritocchi', []):
        meta['ritocchi'].append('orientamento')
        with open(base + '.json', 'w') as f:
            f.write(json.dumps(meta, ensure_ascii=False))
    if os.path.exists(plain):
        raw.tofile(plain)
    if os.path.exists(packed):
        with gzip.GzipFile(packed, 'wb', compresslevel=9, mtime=0) as f:
            f.write(raw.tobytes())


if __name__ == '__main__':
    for base in sys.argv[1:]:
        main(base)
