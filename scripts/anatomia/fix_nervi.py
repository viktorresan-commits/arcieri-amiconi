"""Nervi attaccati ai muscoli.

I nervi (add_nerves.py) seguivano le ossa più vicine della loro regione. In posa (braccio alzato, busto girato) i
muscoli si muovono diversamente dalle ossa: i nervi del collo e della spalla restavano dov'erano e uscivano dalla
pelle, quelli del braccio si staccavano dai muscoli.

Qui ogni anello dei tubi dei nervi segue la carne che lo circonda: tra i 40 vertici di muscolo più vicini al centro
dell'anello si sommano i pesi per segmento e si tengono i due segmenti con più peso, nella loro proporzione. Il
campo che ne esce è liscio (spostandosi lungo il nervo i vicini cambiano piano): un nervo che passa dal busto al
braccio sotto l'ascella si piega con i muscoli invece di strapparsi. Tutti i punti di un anello hanno lo stesso peso
(l'anello non si apre).

    python3 fix_nervi.py ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero ../../public/anatomia/corpo-hd
"""
import gzip
import json
import os
import sys

import numpy as np
from scipy.spatial import cKDTree


def main(base):
    meta = json.load(open(base + '.json'))
    if 'nervi-muscoli' in meta.get('ritocchi', []):
        print(os.path.basename(base), 'nervi già attaccati ai muscoli')
        return
    plain, packed = base + '.bin', base + '.bin.gz'
    raw = np.fromfile(plain, dtype=np.uint8).copy() if os.path.exists(plain) else np.frombuffer(gzip.open(packed).read(), dtype=np.uint8).copy()
    st, lo, hi = meta['stride'], np.array(meta['lo']), np.array(meta['hi'])

    def block(b):
        nv = b['vertices']
        blk = raw[b['vOffset']:b['vOffset'] + nv * st].reshape(nv, st)
        p = lo + blk[:, 0:6].copy().view(np.uint16).reshape(-1, 3).astype(np.float64) / 65535 * (hi - lo)
        return blk, p

    mp, mj = [], []
    for b in meta['batches']:
        if b['layer'] == 'muscle':
            blk, p = block(b)
            mp.append(p)
            mj.append(blk[:, 9:12].astype(np.int64))
    mtree = cKDTree(np.concatenate(mp))
    mj = np.concatenate(mj)
    nseg = len(meta['segments'])
    total = 0
    for b in meta['batches']:
        if b['layer'] != 'nerve':
            continue
        blk, p = block(b)
        nv = len(p)
        z = np.nonzero(blk[1:, 14] == 0)[0]
        sides = int(z[0] + 1) if len(z) else nv
        rings = p.reshape(-1, sides, 3)
        c = rings.mean(1)
        _, k = mtree.query(c, k=40)
        A, B, Wm = mj[k, 0], mj[k, 1], mj[k, 2] / 255.0
        mass = np.zeros((len(c), nseg))
        rows = np.repeat(np.arange(len(c)), k.shape[1])
        np.add.at(mass, (rows, A.ravel()), Wm.ravel())
        np.add.at(mass, (rows, B.ravel()), 1 - Wm.ravel())
        top = np.argsort(-mass, axis=1)[:, :2]
        m1 = mass[np.arange(len(c)), top[:, 0]]
        m2 = mass[np.arange(len(c)), top[:, 1]]
        w = m1 / np.maximum(m1 + m2, 1e-9)
        J = np.zeros((len(c), 3), np.uint8)
        J[:, 0] = top[:, 0]
        J[:, 1] = np.where(m2 > 0, top[:, 1], top[:, 0])
        J[:, 2] = np.round(w * 255)
        blk[:, 9:12] = np.repeat(J, sides, axis=0)
        raw[b['vOffset']:b['vOffset'] + nv * st] = blk.reshape(-1)
        total += nv
    print(os.path.basename(base), 'nervi attaccati ai muscoli: punti', total)
    meta.setdefault('ritocchi', []).append('nervi-muscoli')
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
