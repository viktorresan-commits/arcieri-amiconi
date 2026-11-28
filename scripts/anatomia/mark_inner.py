"""Segna la parete interna della pelle dell'atlante (fondo scuro sotto i muscoli).

La pelle di BodyParts3D è un guscio spesso 2-3 cm: una superficie esterna (normali verso l'aria) e una interna
(normali verso l'interno del corpo, dove stanno muscoli e ossa). Per ogni vertice della pelle si cammina lungo la
normale: dalla parete interna muscoli o ossa si incontrano entro 2 cm (di solito subito: in parte attraversano il
guscio), dalla parete esterna si va nell'aria e non si incontra nulla (nelle pieghe, braccio contro busto, solo più
lontano). Le etichette si rendono omogenee con qualche passata a maggioranza sui vicini.

La parete interna va nel canale "tendine" del vertice (byte 15, inutilizzato per la pelle): 255 = parete interna.
Nell'app si disegna, con le facce posteriori scartate, solo la parete interna lontana: sta dietro i muscoli e si
vede soltanto dove tra un muscolo e l'altro resta uno spiraglio (carne in ombra invece del fondo dello studio).

    python3 mark_inner.py ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero ../../public/anatomia/corpo-hd

(dopo fix_orient.py; per ogni nome: `.json` e `.bin` e/o `.bin.gz`)
"""
import gzip
import json
import os
import sys

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

HIT = 0.004  # m: un punto della camminata "tocca" muscolo o osso entro questa distanza
STEPS = np.arange(0.002, 0.09, 0.002)
NO_SEG = [2, 6, 10, 13, 16, 17, 18, 19, 20]  # testa, mani, piedi, dita
NEAR = 0.02  # m: tessuto entro questa distanza lungo la normale = parete interna


def decode(raw, b, st, lo, hi):
    nv = b['vertices']
    blk = raw[b['vOffset']:b['vOffset'] + nv * st].reshape(nv, st)
    p = lo + blk[:, 0:6].copy().view(np.uint16).reshape(-1, 3).astype(np.float64) / 65535 * (hi - lo)
    n = blk[:, 6:9].copy().view(np.int8).astype(np.float64) / 127
    n /= np.linalg.norm(n, axis=1)[:, None] + 1e-9
    idx = raw[b['iOffset']:b['iOffset'] + b['indices'] * 2].copy().view(np.uint16).astype(np.int64).reshape(-1, 3)
    return blk, p, n, idx


def first_hit(tree, p, d):
    t = np.full(len(p), np.inf)
    for s in STEPS[::-1]:
        dist, _ = tree.query(p + d * s, distance_upper_bound=HIT)
        t[np.isfinite(dist)] = s
    return t


def main(base):
    meta = json.load(open(base + '.json'))
    plain, packed = base + '.bin', base + '.bin.gz'
    raw = np.fromfile(plain, dtype=np.uint8).copy() if os.path.exists(plain) else np.frombuffer(gzip.open(packed).read(), dtype=np.uint8).copy()
    st, lo, hi = meta['stride'], np.array(meta['lo']), np.array(meta['hi'])
    tissue = []
    for b in meta['batches']:
        if b['layer'] in ('muscle', 'bone'):
            _, p, _, idx = decode(raw, b, st, lo, hi)
            tissue += [p, p[idx].mean(1)]
    tree = cKDTree(np.vstack(tissue))
    for b in meta['batches']:
        if b['layer'] != 'skin':
            continue
        blk, p, n, idx = decode(raw, b, st, lo, hi)
        tin = first_hit(tree, p, n)
        # +1 parete interna, -1 esterna, 0 non si sa (tessuto tra 2 e 9 cm: piega o parete interna lontana)
        lab = np.where(tin <= NEAR, 1.0, np.where(np.isinf(tin), -1.0, 0.0))
        nv = len(p)
        r = np.concatenate([idx[:, 0], idx[:, 1], idx[:, 2], idx[:, 1], idx[:, 2], idx[:, 0]])
        c = np.concatenate([idx[:, 1], idx[:, 2], idx[:, 0], idx[:, 0], idx[:, 1], idx[:, 2]])
        A = coo_matrix((np.ones(len(r)), (r, c)), shape=(nv, nv)).tocsr()
        A.data[:] = 1
        for _ in range(6):
            s = A @ lab + lab
            lab = np.where(s > 0, 1.0, np.where(s < 0, -1.0, lab))
        inner = lab > 0
        # solo la parete interna principale (busto, braccia, gambe tutta d'un pezzo): le isole sono pieghe della pelle
        # esterna vicine ai muscoli (ascelle, inguine, dita) e si vedrebbero davanti ai muscoli
        e = np.concatenate([idx[:, [0, 1]], idx[:, [1, 2]], idx[:, [2, 0]]])
        e = e[inner[e[:, 0]] & inner[e[:, 1]]]
        _, reg = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(nv, nv)), directed=False)
        reg = np.where(inner, reg, -1)
        inner &= reg == np.bincount(reg[inner]).argmax()
        # niente fondo in testa (vuota: dentro si vedrebbe il viso rovesciato), mani, piedi e dita
        seg = np.where(blk[:, 11] >= 128, blk[:, 9], blk[:, 10])
        inner &= ~np.isin(seg, NO_SEG)
        blk[:, 15] = np.where(inner, 255, 0).astype(np.uint8)
        raw[b['vOffset']:b['vOffset'] + nv * st] = blk.reshape(-1)
        print(os.path.basename(base), 'pelle: vertici', nv, 'parete interna %.1f%%' % (inner.mean() * 100),
              'incerti prima %.1f%%' % (np.mean(np.isfinite(tin) & (tin > NEAR)) * 100))
    # segno nella descrizione: la sua impronta è la versione del corpo salvato nei telefoni (così si riscarica)
    if 'pelle-interna' not in meta.setdefault('ritocchi', []):
        meta['ritocchi'].append('pelle-interna')
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
