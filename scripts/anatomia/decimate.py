import numpy as np
def cluster(pos, nor, idx, cell):
    """semplificazione per raggruppamento dei vertici su una griglia: ogni cella diventa un vertice (media)"""
    if cell <= 0: return pos, nor, idx
    o = pos.min(0)
    key = np.floor((pos - o) / cell).astype(np.int64)
    k = key[:,0] * 1_000_003 * 1_009 + key[:,1] * 1_000_003 + key[:,2]
    uniq, inv = np.unique(k, return_inverse=True)
    n = len(uniq)
    cnt = np.bincount(inv, minlength=n).astype(np.float32)
    P = np.stack([np.bincount(inv, pos[:,i], n) for i in range(3)], 1) / cnt[:,None]
    N = np.stack([np.bincount(inv, nor[:,i], n) for i in range(3)], 1)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-6)
    I = inv[idx]
    keep = (I[:,0] != I[:,1]) & (I[:,1] != I[:,2]) & (I[:,0] != I[:,2])
    I = I[keep]
    # triangoli doppi
    s = np.sort(I, 1); _, first = np.unique(s, axis=0, return_index=True)
    I = I[np.sort(first)]
    used = np.unique(I)
    remap = -np.ones(n, np.int64); remap[used] = np.arange(len(used))
    return P[used].astype(np.float32), N[used].astype(np.float32), remap[I].astype(np.int64)
def recompute_normals(P, I):
    N = np.zeros_like(P)
    f = np.cross(P[I[:,1]] - P[I[:,0]], P[I[:,2]] - P[I[:,0]])
    for k in range(3): np.add.at(N, I[:,k], f)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
