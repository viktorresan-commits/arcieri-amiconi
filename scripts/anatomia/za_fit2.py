import sys, re, numpy as np; sys.path.insert(0, '.')
from za_blend import load as zb
from za_names import za2bp_bone
from load import A, part
from pick import classify
from scipy.spatial import cKDTree
YUP = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)  # blender Z-su -> Y-su, davanti +Z
def world(p):
    W = (np.c_[p['P'], np.ones(len(p['P']))] @ p['M'])[:, :3]
    return W @ YUP.T
def pairs():
    za = [p for p in zb() if p['cat'] == 'Skeletal system']
    bp = {p['name']: p for p in A['parts'] if classify(p) == 'bone'}
    out = []
    for z in za:
        k = za2bp_bone(z['name'])
        if k in bp:
            P, _, _ = part(bp[k]); out.append((z['name'], k, world(z), P.astype(np.float64)))
    return out
def sim(X, Y):
    mx, my = X.mean(0), Y.mean(0); Xc, Yc = X - mx, Y - my
    U, S, Vt = np.linalg.svd(Yc.T @ Xc / len(X)); D = np.eye(3)
    if np.linalg.det(U @ Vt) < 0: D[2, 2] = -1
    R = U @ D @ Vt; s = np.trace(np.diag(S) @ D) / (Xc ** 2).sum(1).mean(); return s, R, my - s * R @ mx
if __name__ == '__main__':
    pr = pairs(); print('coppie', len(pr))
    X = np.array([a.mean(0) for _, _, a, _ in pr]); Y = np.array([b.mean(0) for *_, b in pr])
    s, R, t = sim(X, Y)
    print('scala', round(s, 4), 'R diag', np.diag(R).round(4), 't', t.round(4))
    res = []
    for (zn, bn, a, b) in pr:
        a2 = (s * (R @ a.T)).T + t
        d = cKDTree(b).query(a2)[0]
        res.append((np.median(d) * 1000, np.linalg.norm(a2.mean(0) - b.mean(0)) * 1000, zn, bn))
    res.sort()
    for r in res[::8]: print([round(r[0], 1), round(r[1], 1), r[2], r[3]])
    print('mediana superficie mm', round(np.median([r[0] for r in res]), 1), 'centri', round(np.median([r[1] for r in res]), 1))

def icp(src, dst_tree, dst, iters=18):
    """allineamento rigido src -> dst (punti più vicini, coppie lontane scartate)"""
    R = np.eye(3); t = np.zeros(3)
    for _ in range(iters):
        X = src @ R.T + t
        d, i = dst_tree.query(X)
        keep = d < max(0.004, np.median(d) * 2.5)
        if keep.sum() < 10: break
        A, Bm = src[keep], dst[i[keep]]
        ma, mb = A.mean(0), Bm.mean(0)
        U, S, Vt = np.linalg.svd((Bm - mb).T @ (A - ma)); D = np.eye(3)
        if np.linalg.det(U @ Vt) < 0: D[2, 2] = -1
        R = U @ D @ Vt; t = mb - R @ ma
    X = src @ R.T + t
    return R, t, float(np.median(dst_tree.query(X)[0]))

def bone_field(sigma=0.02):
    """per ogni osso di Z-Anatomy, la trasformazione rigida che lo porta sull'osso di BodyParts3D;
    ritorna warp(X): punti di Z-Anatomy (Y-su) -> spazio BodyParts3D, mescolando le trasformazioni degli ossi vicini"""
    from scipy.spatial import cKDTree
    pr = pairs()
    X = np.array([a.mean(0) for _, _, a, _ in pr]); Y = np.array([b.mean(0) for *_, b in pr])
    s, R0, t0 = sim(X, Y)
    G = lambda P: (s * (R0 @ P.T)).T + t0
    samp, sid, Rs, ts, errs = [], [], [], [], []
    rng = np.random.default_rng(1)
    for k, (zn, bn, a, b) in enumerate(pr):
        a2 = G(a)
        sub = a2[rng.choice(len(a2), min(len(a2), 1500), replace=False)]
        R, t, e = icp(sub, cKDTree(b), b)
        Rs.append(R); ts.append(t); errs.append(e)
        sm = a2[rng.choice(len(a2), min(len(a2), 250), replace=False)]
        samp.append(sm); sid.append(np.full(len(sm), k))
    samp = np.vstack(samp); sid = np.concatenate(sid); Rs = np.array(Rs); ts = np.array(ts)
    tree = cKDTree(samp)
    def warp(P, chunk=20000):
        P = G(P); out = np.empty_like(P)
        for c0 in range(0, len(P), chunk):
            Q = P[c0:c0 + chunk]
            d, i = tree.query(Q, k=48)
            b = sid[i]
            n = len(Q); acc = np.zeros((n, 3)); wsum = np.zeros(n)
            # per ogni osso tra i vicini: distanza minima
            for col in range(i.shape[1]):
                first = np.ones(n, bool)
                for prev in range(col):
                    first &= b[:, prev] != b[:, col]
                w = np.exp(-d[:, col] ** 2 / (2 * sigma ** 2)) * first
                bb = b[:, col]
                Y = np.einsum('nij,nj->ni', Rs[bb], Q) + ts[bb]
                acc += w[:, None] * Y; wsum += w
            far = wsum < 1e-6
            wsum[far] = 1; acc[far] = Q[far]
            out[c0:c0 + chunk] = acc / wsum[:, None]
        return out
    return warp, G, dict(scale=s, err_mm=np.median(errs) * 1000, worst=sorted(zip(errs, [p[0] for p in pr]))[-5:])
