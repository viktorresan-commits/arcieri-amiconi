"""Parete dell'addome che si torce tutta insieme: retti, linea alba, obliqui ed erettori.

Ogni vertice dei muscoli tra bacino e torace seguiva l'osso più vicino con un passaggio stretto (2 cm), a
un'altezza diversa per ogni muscolo: torcendo il busto sul bacino (come in trazione) la linea alba
scivolava di traverso sui retti e l'addome si spezzava in una piega. Qui il peso verso il torace
dipende solo dall'altezza, uguale per tutti: 0 sotto la cresta iliaca, 1 sotto l'arcata delle costole,
in mezzo una curva morbida. La torsione si distribuisce lungo l'addome come in un corpo vero, gli attacchi
sul pube e sulle costole restano fermi sulle loro ossa.

    python3 fix_abs.py ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero ../../public/anatomia/corpo-hd
"""
import gzip
import json
import os
import sys

import numpy as np

Y0, Y1 = 0.96, 1.22  # m, a riposo: cresta iliaca e arcata costale


def main(base):
    meta = json.load(open(base + '.json'))
    plain, packed = base + '.bin', base + '.bin.gz'
    raw = np.fromfile(plain, dtype=np.uint8).copy() if os.path.exists(plain) else np.frombuffer(gzip.open(packed).read(), dtype=np.uint8).copy()
    st, lo, hi = meta['stride'], np.array(meta['lo']), np.array(meta['hi'])
    segs = meta['segments']
    B, T = segs.index('bacino'), segs.index('torace')
    for bi, b in enumerate(meta['batches']):
        if b['layer'] != 'muscle':
            continue
        nv = b['vertices']
        blk = raw[b['vOffset']:b['vOffset'] + nv * st].reshape(nv, st)
        y = lo[1] + blk[:, 2:4].copy().view(np.uint16)[:, 0].astype(np.float64) / 65535 * (hi[1] - lo[1])
        pair = ((blk[:, 9] == B) & (blk[:, 10] == T)) | ((blk[:, 9] == T) & (blk[:, 10] == B)) | ((blk[:, 9] == T) & (blk[:, 10] == T) & (y < Y1)) | ((blk[:, 9] == B) & (blk[:, 10] == B) & (y > Y0))
        if not pair.any():
            continue
        t = np.clip((y[pair] - Y0) / (Y1 - Y0), 0, 1)
        w = t * t * (3 - 2 * t)
        blk[pair, 9] = T
        blk[pair, 10] = B
        blk[pair, 11] = np.round(w * 255).astype(np.uint8)
        raw[b['vOffset']:b['vOffset'] + nv * st] = blk.reshape(-1)
        print(os.path.basename(base), 'gruppo', bi, 'vertici addome', int(pair.sum()))
    if 'addome' not in meta.setdefault('ritocchi', []):
        meta['ritocchi'].append('addome')
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
