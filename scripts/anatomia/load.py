import json, numpy as np
import os
# cartella con atlas.json e body-*.bin (BodyParts3D semplificato, CC BY 4.0)
R=os.environ.get('BP3D_MODELS', 'human-atlas/public/models/')
A=json.load(open(R+'atlas.json'))
_bufs={}
def buf(c):
    if c not in _bufs: _bufs[c]=open(R+f'body-{c}.bin','rb').read()
    return _bufs[c]
def part(p):
    b=buf(p['chunk'])
    pos=np.frombuffer(b,np.float32,p['vertexCount']*3,p['positions']).reshape(-1,3)
    nor=np.frombuffer(b,np.int16,p['vertexCount']*3,p['normals']).reshape(-1,3).astype(np.float32)/32767
    idx=np.frombuffer(b,np.uint32,p['indexCount'],p['indices']).reshape(-1,3)
    return pos,nor,idx
def find(name):
    return [p for p in A['parts'] if p['name']==name]
