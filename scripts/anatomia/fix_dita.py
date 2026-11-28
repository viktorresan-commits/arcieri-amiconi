"""Muscoli e tendini delle dita che si piegano con le dita.

I tendini dei flessori e degli estensori, i lombricali e gli interossei arrivano fino alle punte delle dita,
ma erano legati alla mano e all'avambraccio: la scheda grafica piega le dita (presa sulla corda e
sull'impugnatura) solo per i vertici legati al segmento delle dita, quindi con i muscoli accesi le ossa
delle dita si piegavano e i loro muscoli restavano dritti, come lame che attraversavano la corda.

Qui ogni vertice di muscolo nella mano prende i segmenti (e i pesi) del vertice di pelle più vicino quando
quella pelle segue le dita o il pollice: muscoli e tendini si piegano esattamente come la pelle che li copre.

    python3 fix_dita.py ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero ../../public/anatomia/corpo-hd
"""
import gzip
import json
import os
import sys

import numpy as np
from scipy.spatial import cKDTree


def positions(blk, lo, hi):
    q = blk[:, 0:6].copy().view(np.uint16).reshape(-1, 3).astype(np.float64)
    return lo + q / 65535 * (hi - lo)


def main(base):
    meta = json.load(open(base + '.json'))
    plain, packed = base + '.bin', base + '.bin.gz'
    raw = np.fromfile(plain, dtype=np.uint8).copy() if os.path.exists(plain) else np.frombuffer(gzip.open(packed).read(), dtype=np.uint8).copy()
    st, lo, hi = meta['stride'], np.array(meta['lo']), np.array(meta['hi'])
    segs = meta['segments']
    for side, wr in (('L', '15'), ('R', '16')):
        hand = {segs.index(f'mano_{side}'), segs.index(f'avambr_{side}')}
        fing = {segs.index(f'dita_{side}'), segs.index(f'pollice_{side}')}
        W = np.array(meta['rest'][wr])
        # pelle della mano: segmenti e pesi da copiare
        sp, sj = [], []
        for b in meta['batches']:
            if b['layer'] != 'skin':
                continue
            nv = b['vertices']
            blk = raw[b['vOffset']:b['vOffset'] + nv * st].reshape(nv, st)
            p = positions(blk, lo, hi)
            m = (np.linalg.norm(p - W, axis=1) < 0.26) & (np.isin(blk[:, 9], list(hand | fing)) | np.isin(blk[:, 10], list(hand | fing)))
            sp.append(p[m])
            sj.append(blk[m, 9:12].copy())
        if not sp:
            continue
        sp = np.concatenate(sp)
        sj = np.concatenate(sj)
        tree = cKDTree(sp)
        onFing = np.isin(sj[:, 0], list(fing)) | np.isin(sj[:, 1], list(fing))
        for bi, b in enumerate(meta['batches']):
            if b['layer'] != 'muscle':
                continue
            nv = b['vertices']
            blk = raw[b['vOffset']:b['vOffset'] + nv * st].reshape(nv, st)
            p = positions(blk, lo, hi)
            cand = (np.linalg.norm(p - W, axis=1) < 0.26) & np.isin(blk[:, 9], list(hand)) & np.isin(blk[:, 10], list(hand))
            if not cand.any():
                continue
            d, k = tree.query(p[cand])
            # solo dove la pelle sopra segue le dita (o il pollice) e non è lontana (lo stesso dito)
            ok = onFing[k] & (d < 0.02)
            idx = np.nonzero(cand)[0][ok]
            if not len(idx):
                continue
            blk[idx, 9:12] = sj[k[ok]]
            raw[b['vOffset']:b['vOffset'] + nv * st] = blk.reshape(-1)
            print(os.path.basename(base), side, 'gruppo', bi, 'vertici delle dita', len(idx))
    if 'dita-muscoli' not in meta.setdefault('ritocchi', []):
        meta['ritocchi'].append('dita-muscoli')
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
