"""Curve dei nervi di Z-Anatomy (Startup.blend): polilinee con raggio, nello spazio dell'oggetto, e matrice."""
import sys, pickle, re, struct
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import numpy as np
import za_blend as Z
from blend import Blend
B = Blend(Z.SRC)
obcol, kids = Z.collections_tree(B)
cats = Z.under(kids, '7: Nervous system & Sense organs')
NV = re.compile(r"nerve|plexus|branch|trunk|cord of brachial|division of|root of|rami|cauda equina", re.I)
out = []
info = {}
for b in B.blocks:
    if b[0] != b'OB\x00\x00' or B.field(b, 'type') != 2: continue
    cols = obcol.get(b[2], [])
    if not any(c in cats for c in cols): continue
    name = B.field(b, 'id.name')[2:]
    if not NV.search(name): continue
    M = B.field(b, 'obmat').reshape(4, 4).astype(np.float64)
    cu = B.blk(B.field(b, 'data'))
    if cu is None or B.sname(cu) != 'Curve': continue
    ext2 = B.field(cu, 'ext2'); ext1 = B.field(cu, 'ext1')
    try: bev = B.field(cu, 'bevel_radius')
    except Exception: bev = None
    lines = []
    for nb in B.listbase(cu[5] + B.structs[cu[3]][1]['nurb']['off']):
        typ = B.read_field(nb[5], 'Nurb', 'type'); n = B.read_field(nb[5], 'Nurb', 'pntsu')
        res = max(2, B.read_field(nb[5], 'Nurb', 'resolu'))
        if typ == 1:
            bz = B.blk(B.read_field(nb[5], 'Nurb', 'bezt'))
            if bz is None: continue
            L = B.tlen[B.tidx['BezTriple']]
            V = []; R = []
            for i in range(n):
                o = bz[5] + i * L
                vo = o + B.structs[B.sbytype['BezTriple']][1]['vec']['off']
                v = np.frombuffer(B.buf, '<f4', 9, vo).reshape(3, 3).astype(np.float64)
                r = B.read_field(o, 'BezTriple', 'radius')
                V.append(v); R.append(r)
            pts, rad = [], []
            for i in range(n - 1):
                p0, p1, p2, p3 = V[i][1], V[i][2], V[i + 1][0], V[i + 1][1]
                for t in np.linspace(0, 1, min(res, 8), endpoint=False):
                    u = 1 - t
                    pts.append(u ** 3 * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t ** 3 * p3)
                    rad.append(R[i] * u + R[i + 1] * t)
            if n: pts.append(V[-1][1]); rad.append(R[-1])
        else:
            bp = B.blk(B.read_field(nb[5], 'Nurb', 'bp'))
            if bp is None: continue
            L = B.tlen[B.tidx['BPoint']]
            pts, rad = [], []
            for i in range(n):
                o = bp[5] + i * L
                vo = o + B.structs[B.sbytype['BPoint']][1]['vec']['off']
                v = np.frombuffer(B.buf, '<f4', 4, vo).astype(np.float64)
                pts.append(v[:3]); rad.append(B.read_field(o, 'BPoint', 'radius'))
        if len(pts) >= 2: lines.append((np.array(pts), np.array(rad), typ))
    if lines:
        out.append(dict(name=name, M=M, ext2=ext2, ext1=ext1, bev=bev, lines=lines))
print('nervi', len(out), 'polilinee', sum(len(x['lines']) for x in out))
print('ext2', sorted(set(round(x['ext2'], 4) for x in out))[:20], 'bev', sorted(set(round(x['bev'], 4) for x in out if x['bev'] is not None))[:10])
pickle.dump(out, open('/tmp/za_nerve_curves.pkl', 'wb'))
