"""estrae ossa, muscoli e pelle di Z-Anatomy (CC BY-SA 4.0) dal file Startup.blend"""
import sys, collections, struct, numpy as np, pickle, os
sys.path.insert(0, os.path.dirname(__file__))
from blend import Blend
SRC = os.environ.get('ZA_BLEND', '/tmp/ext/zam/Z-Anatomy/Startup.blend')
CACHE = '/tmp/za_blend.pkl'

def collections_tree(B):
    obcol = collections.defaultdict(list); kids = {}
    for b in B.blocks:
        if b[0] != b'GR\x00\x00': continue
        name = B.field(b, 'id.name')[2:]
        for co in B.listbase(B.read_field(b[5], 'Collection', 'gobject')):
            obcol[B.read_field(co[5], 'CollectionObject', 'ob')].append(name)
        ks = []
        for ch in B.listbase(B.read_field(b[5], 'Collection', 'children')):
            kb = B.blk(B.read_field(ch[5], 'CollectionChild', 'collection'))
            if kb: ks.append(B.field(kb, 'id.name')[2:])
        kids[name] = ks
    return obcol, kids

def under(kids, root):
    out = set(); st = [root]
    while st:
        n = st.pop()
        if n in out: continue
        out.add(n); st += kids.get(n, [])
    return out

def mesh_data(B, mptr):
    mb = B.blk(mptr)
    nv, np_, nl = B.field(mb, 'totvert'), B.field(mb, 'totpoly'), B.field(mb, 'totloop')
    L = B.tlen[B.tidx['CustomDataLayer']]
    def layer(cd, typ):
        o = B.read_field(mb[5], 'Mesh', cd); lb = B.blk(B.read_field(o, 'CustomData', 'layers'), mb)
        if lb is None: return None
        for i in range(B.read_field(o, 'CustomData', 'totlayer')):
            lo = lb[5] + i * L
            if B.read_field(lo, 'CustomDataLayer', 'type') == typ: return B.blk(B.read_field(lo, 'CustomDataLayer', 'data'), mb)
    vb = layer('vdata', 0)
    if vb is None: return None, None
    P = np.frombuffer(B.buf, dtype=np.uint8, count=vb[1], offset=vb[5]).reshape(-1, 16)[:, :12].copy().view('<f4').reshape(-1, 3).astype(np.float64)
    pb, lpb = layer('pdata', 25), layer('ldata', 26)
    poly = np.frombuffer(B.buf, dtype='<i4', count=pb[1] // 4, offset=pb[5]).reshape(-1, 3)[:, :2]
    loop = np.frombuffer(B.buf, dtype='<i4', count=lpb[1] // 4, offset=lpb[5]).reshape(-1, 2)[:, 0]
    tris = []
    ls, tlp = poly[:, 0], poly[:, 1]
    for k in (3, 4):
        sel = tlp == k
        if not sel.any(): continue
        L = loop[ls[sel][:, None] + np.arange(k)]
        tris.append(L[:, [0, 1, 2]])
        if k == 4: tris.append(L[:, [0, 2, 3]])
    for i in np.nonzero(tlp > 4)[0]:
        L = loop[ls[i]:ls[i] + tlp[i]]
        tris.append(np.stack([np.full(len(L) - 2, L[0]), L[1:-1], L[2:]], 1))
    I = np.vstack(tris) if tris else np.zeros((0, 3), int)
    return P, I

MOD = {5: 'mirror', 4: 'subsurf', 27: 'solidify', 23: 'shrinkwrap', 22: 'smooth', 25: 'triangulate', 3: 'curve', 9: 'armature', 19: 'displace', 13: 'decimate', 17: 'hook', 40: 'weld'}

def load(roots=('Skeletal system', 'Muscular system', 'Integument')):
    if os.path.exists(CACHE): return pickle.load(open(CACHE, 'rb'))
    B = Blend(SRC)
    obcol, kids = collections_tree(B)
    cats = {r: under(kids, r) for r in roots}
    parts = []
    for b in B.blocks:
        if b[0] != b'OB\x00\x00' or B.field(b, 'type') != 1: continue
        cols = obcol.get(b[2], [])
        cat = next((r for r in roots if any(c in cats[r] for c in cols)), None)
        if cat is None: continue
        name = B.field(b, 'id.name')[2:]
        M = B.field(b, 'obmat').reshape(4, 4).astype(np.float64)  # colonna-maggiore: M[i] = colonna i
        mods = []
        for md in B.listbase(B.read_field(b[5], 'Object', 'modifiers')):
            t = B.read_field(md[5], 'ModifierData', 'type'); mode = B.read_field(md[5], 'ModifierData', 'mode')
            info = dict(type=MOD.get(t, t), on=bool(mode & 1))
            if t == 5:
                info['axis'] = B.read_field(md[5], 'MirrorModifierData', 'flag') & 7
                mo = B.read_field(md[5], 'MirrorModifierData', 'mirror_ob')
                if mo and B.blk(mo): info['mob'] = B.field(B.blk(mo), 'obmat').reshape(4, 4).astype(np.float64)
            mods.append(info)
        try: P, I = mesh_data(B, B.field(b, 'data'))
        except Exception as e: print('salto', name, e); continue
        if I is not None and len(I) and I.max() >= len(P): print('indici fuori', name); continue
        if P is None or len(I) == 0: continue
        hidden = bool(B.field(b, 'visibility_flag') & 1) if 'visibility_flag' in B.structs[B.sbytype['Object']][1] else False
        parts.append(dict(name=name, cat=cat, cols=cols, M=M, mods=mods, P=P, I=I, hidden=hidden))
    pickle.dump(parts, open(CACHE, 'wb'))
    return parts

if __name__ == '__main__':
    ps = load()
    c = collections.Counter(p['cat'] for p in ps); print(c)
    mc = collections.Counter((p['cat'], tuple(m['type'] for m in p['mods'] if m['on'])) for p in ps); print(mc.most_common(20))
    for p in ps[:5]: print(p['name'], p['cols'], len(p['P']), len(p['I']), p['M'].round(3).tolist())
