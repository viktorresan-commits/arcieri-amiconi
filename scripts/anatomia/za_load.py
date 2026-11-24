"""muscoli di Z-Anatomy (CC BY-SA 4.0) dal glb compresso: parti con nome, lato, posizioni in metri (Y in alto)"""
import json, struct, numpy as np, os, pickle
from meshopt_decode import decode_vertex_buffer, decode_index_buffer, octahedral_int8
ZA = os.environ.get('ZA_GLB', 'z-anatomy-muscles.glb')  # muscoli Z-Anatomy (CC BY-SA 4.0) in formato glb compresso
CACHE = '/tmp/za_parts.pkl'
def load():
    if os.path.exists(CACHE): return pickle.load(open(CACHE, 'rb'))
    b = open(ZA, 'rb').read()
    _, _, _, clen, _ = struct.unpack('<4sIIII', b[:20]); j = json.loads(b[20:20 + clen])
    off = 20 + clen; blen, _ = struct.unpack('<II', b[off:off + 8]); B = b[off + 8:off + 8 + blen]
    views = {}
    def view(i):
        if i in views: return views[i]
        e = j['bufferViews'][i]['extensions']['EXT_meshopt_compression']
        src = B[e['byteOffset']:e['byteOffset'] + e['byteLength']]
        if e['mode'] == 'TRIANGLES': v = decode_index_buffer(src, e['count'])
        else: v = decode_vertex_buffer(src, e['count'], e['byteStride'])
        views[i] = (v, e)
        return views[i]
    acc = j['accessors']
    parts = []
    for n in j['nodes']:
        if 'mesh' not in n: continue
        prim = j['meshes'][n['mesh']]['primitives'][0]
        ia = acc[prim['indices']]; I, _ = view(ia['bufferView'])
        idx = I[ia['byteOffset'] // 2: ia['byteOffset'] // 2 + ia['count']].astype(np.int64).reshape(-1, 3)
        pa = acc[prim['attributes']['POSITION']]; PV, pe = view(pa['bufferView'])
        q = PV[pa.get('byteOffset', 0) // pe['byteStride']:][:pa['count'], :6].copy().view(np.int16).astype(np.float64) / 32767.0
        s = np.array(n.get('scale', [1, 1, 1])); t = np.array(n.get('translation', [0, 0, 0]))
        if 'rotation' in n: raise ValueError('rotazione non prevista')
        P = (q * s + t) / 1000.0  # millimetri -> metri
        na = acc[prim['attributes']['NORMAL']]; NV, ne = view(na['bufferView'])
        N = octahedral_int8(NV[na.get('byteOffset', 0) // ne['byteStride']:][:na['count']])
        x = n.get('extras', {})
        parts.append(dict(name=x.get('concept', n['name']).strip('()'), side=x.get('side', ''), P=P, N=N, I=idx))
    pickle.dump(parts, open(CACHE, 'wb'))
    return parts
if __name__ == '__main__':
    import time; t0 = time.time()
    ps = load()
    print(len(ps), 'parti', sum(len(p['I']) for p in ps), 'triangoli', sum(len(p['P']) for p in ps), 'vertici', round(time.time() - t0, 1), 's')
    bad = [p['name'] for p in ps if p['I'].max() >= len(p['P']) or p['I'].min() < 0]
    print('indici fuori:', len(bad), bad[:5])
    allP = np.vstack([p['P'] for p in ps]); print('bbox', allP.min(0).round(3), allP.max(0).round(3))
    for p in ps[:6]: print(p['name'], p['side'], len(p['P']), len(p['I']), p['P'].mean(0).round(3))
