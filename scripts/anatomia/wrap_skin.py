"""
Pelle vera fedele all'anatomia: il corpo chiuso del personaggio Quaternius (pelle.bin) prende la forma della
pelle dell'atlante (BodyParts3D, che segue i muscoli veri) senza i suoi buchi.

1. ogni triangolo del personaggio si divide in quattro (più punti per seguire i muscoli);
2. il personaggio si mette nel riposo dell'atlante con le stesse ossa dell'app (rest-bones.json, da
   scripts/anatomia/wrap_rest.ts) e ogni punto va sul punto più vicino della pelle dell'atlante con la
   normale concorde; dove l'atlante ha buchi (ascelle) o è lontano lo spostamento si riempie dai vicini;
   testa, mani e dita dei piedi restano quelli del personaggio (occhi, dita vere), con un passaggio morbido;
3. dalla pelle dell'atlante si prende anche il muscolo sotto (gruppo, ventre, quanto la pelle lo segue):
   nell'app la pelle si gonfia con il muscolo che lavora, come quella dell'atlante;
4. occlusione ambientale (pieghe, sotto i pettorali, glutei) dentro ogni parte del corpo, più la cavità
   locale (solchi degli addominali, tra i muscoli);
5. quanto conta il chiaroscuro dipinto: tutto su testa e mani, poco dove la forma viene dall'atlante.

Uscita: pelle.bin / pelle.json con 15 byte in più per vertice (stride 42): gruppo, gonfiore, occlusione, dipinto,
quanto togliere della forma dell'atlante a gomito chiuso (3 int16, decimi di mm), lato/peso della zona del braccio,
la normale della forma del personaggio (3 int8) e quanto conta la foto del viso; più pelle.rest.npz per bake_face.py.

Uso (vedi LEGGIMI.md):
  node /tmp/wrap_rest.mjs public/anatomia/corpo.json <pelle originale>.json > rest-bones.json
  python3 scripts/anatomia/wrap_skin.py <pelle originale senza estensione> <rest-bones.json> <corpo atlante> <uscita>
"""
import json
import sys

import numpy as np
from scipy.sparse import coo_matrix
from scipy.spatial import cKDTree

HAND = ("hand", "thumb", "index", "middle", "ring", "pinky")


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- lettura
def load_quat(path):
    j = json.load(open(path + ".json"))
    b = open(path + ".bin", "rb").read()
    st = j["stride"]

    def dec(m):
        n = m["n"]
        raw = np.frombuffer(b, np.uint8, n * st, m["vOffset"]).reshape(n, st)
        return dict(
            pos=raw[:, 0:12].copy().view("<f4").reshape(n, 3).astype(np.float64),
            nrm=raw[:, 12:15].copy().view(np.int8).astype(np.float64) / 127,
            uv=raw[:, 15:19].copy().view("<u2").reshape(n, 2).astype(np.float64),
            jo=raw[:, 19:23].astype(np.int64),
            wt=raw[:, 23:27].astype(np.float64) / 255,
            idx=np.frombuffer(b, "<u2", m["indices"], m["iOffset"]).reshape(-1, 3).astype(np.int64),
        )

    return j, dec(j["meshes"]["corpo"]), dec(j["meshes"]["occhi"])


def load_anat(path):
    j = json.load(open(path + ".json"))
    b = open(path + ".bin", "rb").read()
    sk = [x for x in j["batches"] if x["layer"] == "skin"][0]
    n, st = sk["vertices"], j["stride"]
    raw = np.frombuffer(b, np.uint8, n * st, sk["vOffset"]).reshape(n, st)
    lo, hi = np.array(j["lo"]), np.array(j["hi"])
    P = lo + raw[:, 0:6].copy().view("<u2").reshape(n, 3) / 65535.0 * (hi - lo)
    idx = np.frombuffer(b, "<u2", sk["indices"], sk["iOffset"]).reshape(-1, 3).astype(np.int64)
    return P, idx


def load_muscles(path):
    """tutti i muscoli dell'atlante a riposo: posizione, gruppo, punto lungo le fibre, tendine"""
    j = json.load(open(path + ".json"))
    b = open(path + ".bin", "rb").read()
    lo, hi = np.array(j["lo"]), np.array(j["hi"])
    P, G, F, T = [], [], [], []
    for bt in j["batches"]:
        if bt["layer"] != "muscle":
            continue
        n = bt["vertices"]
        raw = np.frombuffer(b, np.uint8, n * j["stride"], bt["vOffset"]).reshape(n, j["stride"])
        P.append(lo + raw[:, 0:6].copy().view("<u2").reshape(n, 3) / 65535.0 * (hi - lo))
        G.append(raw[:, 12].astype(np.int64))
        F.append(raw[:, 13] / 255.0)
        T.append(raw[:, 15] / 255.0)
    return np.concatenate(P), np.concatenate(G), np.concatenate(F), np.concatenate(T)


# ---------------------------------------------------------------- geometria
def subdivide(m):
    """ogni triangolo in quattro, nuovi punti a metà dei lati (pesi, uv e normali mediati)"""
    idx = m["idx"]
    n0 = len(m["pos"])
    e = np.concatenate([idx[:, [0, 1]], idx[:, [1, 2]], idx[:, [2, 0]]])
    key = np.sort(e, 1)
    uk, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(3, -1).T + n0  # per triangolo: mezzo di ab, bc, ca
    a, b = uk[:, 0], uk[:, 1]
    pos = np.concatenate([m["pos"], (m["pos"][a] + m["pos"][b]) / 2])
    nm = m["nrm"][a] + m["nrm"][b]
    nrm = np.concatenate([m["nrm"], nm / np.maximum(np.linalg.norm(nm, axis=1, keepdims=True), 1e-9)])
    uv = np.concatenate([m["uv"], (m["uv"][a] + m["uv"][b]) / 2])
    # pesi: unione delle due liste, i quattro più forti
    J = np.concatenate([m["jo"][a], m["jo"][b]], 1)
    W = np.concatenate([m["wt"][a], m["wt"][b]], 1) / 2
    jo = np.zeros((len(uk), 4), np.int64)
    wt = np.zeros((len(uk), 4))
    for i in range(len(uk)):
        acc = {}
        for jj, ww in zip(J[i], W[i]):
            if ww > 0:
                acc[jj] = acc.get(jj, 0) + ww
        top = sorted(acc.items(), key=lambda x: -x[1])[:4]
        s = sum(w for _, w in top) or 1
        for k, (jj, ww) in enumerate(top):
            jo[i, k] = jj
            wt[i, k] = ww / s
    i0, i1, i2 = idx[:, 0], idx[:, 1], idx[:, 2]
    ab, bc, ca = inv[:, 0], inv[:, 1], inv[:, 2]
    tri = np.concatenate([np.stack([i0, ab, ca], 1), np.stack([ab, i1, bc], 1), np.stack([ca, bc, i2], 1), np.stack([ab, bc, ca], 1)])
    return dict(pos=pos, nrm=nrm, uv=uv, jo=np.concatenate([m["jo"], jo]), wt=np.concatenate([m["wt"], wt]), idx=tri)


def weld(pos):
    """stessi punti (i bordi delle uv): un indice solo"""
    key = np.round(pos * 1e6).astype(np.int64)
    _, first, wid = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return wid.reshape(-1), first


def adjacency(tri, n):
    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    e = np.concatenate([e, e[:, ::-1]])
    A = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)).tocsr()
    A.data[:] = 1
    deg = np.asarray(A.sum(1)).ravel()
    return A, np.maximum(deg, 1)


def vnormals(pos, tri):
    fn = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
    n = np.zeros_like(pos)
    for k in range(3):
        np.add.at(n, tri[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def closest_on_tris(p, A, B, C):
    """punto più vicino di p su ogni triangolo ABC (Ericson), vettoriale; restituisce punto e baricentriche"""
    ab, ac, ap = B - A, C - A, p - A
    d1, d2 = (ab * ap).sum(-1), (ac * ap).sum(-1)
    bp = p - B
    d3, d4 = (ab * bp).sum(-1), (ac * bp).sum(-1)
    cp = p - C
    d5, d6 = (ab * cp).sum(-1), (ac * cp).sum(-1)
    va = d3 * d6 - d5 * d4
    vb = d5 * d2 - d1 * d6
    vc = d1 * d4 - d3 * d2
    den = np.where(np.abs(va + vb + vc) < 1e-18, 1e-18, va + vb + vc)
    v = vb / den
    w = vc / den
    u = 1 - v - w
    bary = np.stack([u, v, w], -1)
    # regioni dei vertici e dei lati
    m = (d1 <= 0) & (d2 <= 0)
    bary[m] = [1, 0, 0]
    m2 = (d3 >= 0) & (d4 <= d3)
    bary[m2 & ~m] = [0, 1, 0]
    m3 = (d6 >= 0) & (d5 <= d6)
    bary[m3 & ~m & ~m2] = [0, 0, 1]
    done = m | m2 | m3
    mab = (vc <= 0) & (d1 >= 0) & (d3 <= 0) & ~done
    t = np.clip(d1 / np.where(np.abs(d1 - d3) < 1e-18, 1e-18, d1 - d3), 0, 1)
    bary[mab] = np.stack([1 - t, t, np.zeros_like(t)], -1)[mab]
    done |= mab
    mac = (vb <= 0) & (d2 >= 0) & (d6 <= 0) & ~done
    t = np.clip(d2 / np.where(np.abs(d2 - d6) < 1e-18, 1e-18, d2 - d6), 0, 1)
    bary[mac] = np.stack([1 - t, np.zeros_like(t), t], -1)[mac]
    done |= mac
    mbc = (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0) & ~done
    t = np.clip((d4 - d3) / np.where(np.abs((d4 - d3) + (d5 - d6)) < 1e-18, 1e-18, (d4 - d3) + (d5 - d6)), 0, 1)
    bary[mbc] = np.stack([np.zeros_like(t), 1 - t, t], -1)[mbc]
    q = bary[..., 0:1] * A + bary[..., 1:2] * B + bary[..., 2:3] * C
    return q, bary


def front_depth(P, T, x0, x1, y0, y1, ppm=3500.0):
    """profondità (z più vicina alla camera, che guarda da +z) della superficie, vista di fronte"""
    W, H = int((x1 - x0) * ppm), int((y1 - y0) * ppm)
    zb = np.full((H, W), -np.inf)
    px = (P[:, 0] - x0) * ppm
    py = (y1 - P[:, 1]) * ppm
    for a, b, c in T:
        xs = np.array([px[a], px[b], px[c]])
        ys = np.array([py[a], py[b], py[c]])
        mnx, mxx = int(max(0, np.floor(xs.min()))), int(min(W - 1, np.ceil(xs.max())))
        mny, mxy = int(max(0, np.floor(ys.min()))), int(min(H - 1, np.ceil(ys.max())))
        if mnx > mxx or mny > mxy:
            continue
        gx, gy = np.meshgrid(np.arange(mnx, mxx + 1) + 0.5, np.arange(mny, mxy + 1) + 0.5)
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-12:
            continue
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        l2 = 1 - l0 - l1
        m = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
        z = l0 * P[a, 2] + l1 * P[b, 2] + l2 * P[c, 2]
        sub = zb[mny:mxy + 1, mnx:mxx + 1]
        sub[m] = np.maximum(sub[m], z[m])
    # le aperture degli occhi dell'atlante sono gallerie: di fronte si vedrebbe la nuca. Dove la profondità cade
    # molto sotto quella dei dintorni si richiude con la media dei vicini (una palpebra liscia)
    fin = np.isfinite(zb)
    gx = x0 + (np.arange(W) + 0.5) / ppm
    gy = y1 - (np.arange(H) + 0.5) / ppm
    X, Y = np.meshgrid(gx, gy)
    # nel viso (davanti al piano delle orecchie) la pelle sta sempre avanti: più indietro è una galleria
    hole = fin & (zb < 0.02) & (np.abs(X) < 0.065) & (Y > 1.56) & (Y < 1.65)
    zb[hole] = np.nan
    for _ in range(300):
        nb = np.nanmean(np.stack([np.roll(zb, 1, 0), np.roll(zb, -1, 0), np.roll(zb, 1, 1), np.roll(zb, -1, 1)]), 0)
        upd = hole & np.isfinite(nb)
        zb[upd] = nb[upd]
    zb[np.isnan(zb)] = -np.inf
    return zb, (x0, y1, ppm)


def sphere_radius(P, T, C, NU=720, NV=360):
    """raggio della superficie più esterna attorno a C, per direzione (u = angolo attorno alla verticale, v = dall'alto)"""
    d = P - C
    r = np.linalg.norm(d, axis=1)
    u = (np.arctan2(d[:, 0], d[:, 2]) / (2 * np.pi) + 0.5) * NU
    v = np.arccos(np.clip(d[:, 1] / np.maximum(r, 1e-9), -1, 1)) / np.pi * NV
    R = np.full((NV, NU), np.nan)
    for t in T:
        uu, vv, rr = u[t].copy(), v[t], r[t]
        if uu.max() - uu.min() > NU / 2:
            uu[uu < NU / 2] += NU
        mnx, mxx = int(np.floor(uu.min())), int(np.ceil(uu.max()))
        mny, mxy = int(max(0, np.floor(vv.min()))), int(min(NV - 1, np.ceil(vv.max())))
        gx, gy = np.meshgrid(np.arange(mnx, mxx + 1) + 0.5, np.arange(mny, mxy + 1) + 0.5)
        dd = (vv[1] - vv[2]) * (uu[0] - uu[2]) + (uu[2] - uu[1]) * (vv[0] - vv[2])
        if abs(dd) < 1e-12:
            continue
        l0 = ((vv[1] - vv[2]) * (gx - uu[2]) + (uu[2] - uu[1]) * (gy - vv[2])) / dd
        l1 = ((vv[2] - vv[0]) * (gx - uu[2]) + (uu[0] - uu[2]) * (gy - vv[2])) / dd
        l2 = 1 - l0 - l1
        m = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
        if not m.any():
            continue
        z = l0 * rr[0] + l1 * rr[1] + l2 * rr[2]
        ix = (gx[m].astype(int)) % NU
        iy = gy[m].astype(int)
        cur = R[iy, ix]
        R[iy, ix] = np.where(np.isnan(cur), z[m], np.maximum(cur, z[m]))
    # buchi (poli, bordi): dai vicini
    for _ in range(50):
        if not np.isnan(R).any():
            break
        nb = np.nanmean(np.stack([np.roll(R, 1, 1), np.roll(R, -1, 1), np.roll(R, 1, 0), np.roll(R, -1, 0)]), 0)
        R = np.where(np.isnan(R), nb, R)
    return R


# ---------------------------------------------------------------- occlusione
def ray_ao(pts, nrm, occ_pts, cell=0.006, dirs=28, reach=0.22, start=0.012):
    """quanto cielo vede ogni punto (0..1) contro le superfici occ_pts (griglia di voxel)"""
    lo = occ_pts.min(0) - 0.05
    dims = np.ceil((occ_pts.max(0) + 0.05 - lo) / cell).astype(int) + 1
    grid = np.zeros(dims, bool)
    c = np.floor((occ_pts - lo) / cell).astype(int)
    grid[c[:, 0], c[:, 1], c[:, 2]] = True
    rng = np.random.default_rng(7)
    # direzioni nell'emisfero (coseno), stesse per tutti, girate sulla normale
    u1, u2 = rng.random(dirs), rng.random(dirs)
    r = np.sqrt(u1)
    th = 2 * np.pi * u2
    loc = np.stack([r * np.cos(th), r * np.sin(th), np.sqrt(1 - u1)], -1)
    t1 = np.cross(nrm, np.where(np.abs(nrm[:, 1:2]) < 0.9, [0, 1, 0], [1, 0, 0]))
    t1 /= np.maximum(np.linalg.norm(t1, axis=1, keepdims=True), 1e-9)
    t2 = np.cross(nrm, t1)
    vis = np.zeros(len(pts))
    steps = np.arange(start, reach, cell * 0.9)
    for d in loc:
        D = t1 * d[0] + t2 * d[1] + nrm * d[2]
        hit = np.zeros(len(pts), bool)
        hitd = np.full(len(pts), reach)
        for s in steps:
            q = np.floor((pts + D * s - lo) / cell).astype(int)
            ok = np.all((q >= 0) & (q < dims), 1)
            h = np.zeros(len(pts), bool)
            h[ok] = grid[q[ok, 0], q[ok, 1], q[ok, 2]]
            new = h & ~hit
            hitd[new] = s
            hit |= h
        # gli ostacoli lontani contano meno
        vis += np.where(hit, (hitd / reach) ** 0.6, 1.0)
    return vis / dirs


def surface_samples(pos, tri, step=0.004):
    """punti fitti sulla superficie (per la griglia degli ostacoli)"""
    A, B, C = pos[tri[:, 0]], pos[tri[:, 1]], pos[tri[:, 2]]
    L = np.maximum(np.linalg.norm(B - A, axis=1), np.linalg.norm(C - A, axis=1))
    out = [A, B, C]
    k = int(np.ceil(L.max() / step))
    for i in range(1, k):
        for j in range(0, k - i):
            u, v = i / k, j / k
            out.append(A + (B - A) * u + (C - A) * v)
    return np.concatenate(out)


# ---------------------------------------------------------------- principale
def main():
    src, bones_path, anat_path, out = sys.argv[1:5]
    pj, Q0, E = load_quat(src)
    rb = json.load(open(bones_path))
    names = rb["names"]
    R = np.array([b["r"] for b in rb["bones"]]).reshape(-1, 3, 3)
    T = np.array([b["t"] for b in rb["bones"]])
    # a riposo le mani seguono l'avambraccio (le ossa vere della mano arrivano solo con la presa)
    for k, nm in enumerate(names):
        if nm.startswith(HAND):
            side = nm[-1]
            fa = names.index(f"lowerarm_{side}")
            R[k], T[k] = R[fa], T[fa]
    pj_scale = 1.0  # il personaggio è già in metri
    is_hand = np.array([nm.startswith(HAND) for nm in names])
    is_head = np.array([nm == "Head" for nm in names])
    is_toe = np.array([nm.startswith("ball") for nm in names])

    Q = subdivide(Q0)
    n = len(Q["pos"])
    print("vertici", len(Q0["pos"]), "->", n, "triangoli", len(Q["idx"]))
    if n > 65535:
        raise SystemExit("troppi vertici per indici a 16 bit")
    M = np.einsum("vk,vkij->vij", Q["wt"], R[Q["jo"]])
    t = np.einsum("vk,vki->vi", Q["wt"], T[Q["jo"]])
    q = np.einsum("vij,vj->vi", M, Q["pos"]) + t

    wid, first = weld(Q["pos"])
    nw = len(first)
    triw = wid[Q["idx"]]
    Adj, deg = adjacency(triw, nw)
    qw = q[first]
    nqw = vnormals(qw, triw)

    def avg(x):
        return (Adj @ x) / (deg[:, None] if x.ndim == 2 else deg)

    def wsum(mask):
        return (Q["wt"] * mask[Q["jo"]]).sum(1)

    # dove si segue l'atlante: niente testa, mani, dita dei piedi; passaggio morbido
    # anche la testa prende la forma dell'atlante (viso vero, proporzioni vere); gli occhi del personaggio non
    # si disegnano più: occhi, sopracciglia, labbra vengono dalla foto del viso (scripts/anatomia/bake_face.py)
    keep = (1 - smoothstep(0.0, 0.45, wsum(is_hand))) * (1 - smoothstep(0.1, 0.6, wsum(is_toe)))
    # vicino alle articolazioni che si piegano molto (spalla, gomito; meno anca, ginocchio, caviglia) la forma
    # resta quella del personaggio, fatta per piegarsi: spostata, la pelle farebbe pieghe e spigoli
    def cls(nm):
        for pre, c in (("clavicle", "torso"), ("upperarm", "up"), ("lowerarm", "low"), ("thigh", "thigh"), ("calf", "calf"), ("foot", "foot"), ("ball", "foot")):
            if nm.startswith(pre):
                return c + nm[-2:] if nm[-2:] in ("_l", "_r") else c
        return "hand" + nm[-2:] if nm.startswith(HAND) else "torso"

    cname = np.array([cls(nm) for nm in names])
    classes = np.unique(cname)
    cw = np.stack([wsum(cname == c) for c in classes], 1)
    top2 = np.sort(cw, 1)[:, -2:]
    mixing = top2[:, 0] / np.maximum(top2.sum(1), 1e-9)  # 0 = un pezzo solo, 0,5 = metà e metà
    c1 = classes[np.argmax(cw, 1)]
    cw2 = cw.copy()
    cw2[np.arange(len(cw)), np.argmax(cw, 1)] = -1
    c2 = classes[np.argmax(cw2, 1)]
    arm = np.array([("up" in a or "up" in b) for a, b in zip(c1, c2)])
    jf = np.where(arm, 1 - smoothstep(0.04, 0.3, mixing), 1 - 0.6 * smoothstep(0.08, 0.4, mixing))
    keep = keep * jf
    # braccio piegato: a braccio disteso la forma dell'atlante; quando il gomito si chiude molto (la mano della
    # corda alla bocca) nell'app avambraccio e braccio tornano verso la forma del personaggio, fatta per
    # piegarsi: i muscoli più pieni dell'atlante si compenetrerebbero facendo lembi. Qui solo quanto
    # (tutto l'avambraccio e il braccio, il deltoide vicino alla spalla solo un terzo)
    heads = {jt["name"]: np.array(jt["rest"][12:15]) for jt in pj["joints"]}
    zone = np.zeros(n)
    zside = np.zeros(n, np.int64)
    for k, sd in enumerate(("l", "r")):
        d_sh = np.linalg.norm(Q["pos"] - heads[f"upperarm_{sd}"], axis=1) / pj_scale
        w_up = wsum(np.array([nm == f"upperarm_{sd}" for nm in names]))
        w_lo = wsum(np.array([nm == f"lowerarm_{sd}" for nm in names]))
        z = np.clip(w_lo + w_up * (0.33 + 0.67 * smoothstep(0.05, 0.13, d_sh)), 0, 1)
        zside[z > zone] = k + 1
        zone = np.maximum(zone, z)
    kw = np.zeros(nw)
    np.add.at(kw, wid, keep)
    kw /= np.bincount(wid, minlength=nw)
    for _ in range(6):
        kw = 0.5 * kw + 0.5 * avg(kw)

    # ---- punto più vicino sulla pelle dell'atlante (normale concorde)
    P, AI = load_anat(anat_path)
    tn = np.cross(P[AI[:, 1]] - P[AI[:, 0]], P[AI[:, 2]] - P[AI[:, 0]])
    tn /= np.maximum(np.linalg.norm(tn, axis=1, keepdims=True), 1e-12)
    cen = P[AI].mean(1)
    K = 16
    _, cand = cKDTree(cen).query(qw, K)
    best_d = np.full(nw, np.inf)
    best_p = qw.copy()
    best_t = np.zeros(nw, np.int64)
    best_b = np.zeros((nw, 3))
    for k in range(K):
        tr = cand[:, k]
        cp, bary = closest_on_tris(qw, P[AI[tr, 0]], P[AI[tr, 1]], P[AI[tr, 2]])
        d = np.linalg.norm(cp - qw, axis=1)
        agree = (tn[tr] * nqw).sum(1) > 0.25
        better = agree & (d < best_d)
        best_d[better], best_p[better], best_t[better], best_b[better] = d[better], cp[better], tr[better], bary[better]
    # bordi dei buchi dell'atlante (lati con un triangolo solo)
    e = np.sort(np.concatenate([AI[:, [0, 1]], AI[:, [1, 2]], AI[:, [2, 0]]]), 1)
    ue, cnt = np.unique(e, axis=0, return_counts=True)
    bverts = np.unique(ue[cnt == 1])
    db = cKDTree(P[bverts]).query(best_p)[0] if len(bverts) else np.full(nw, 1.0)
    # la testa del personaggio è più grande di quella dell'atlante (fino a 8-9 cm sulla nuca e in cima): lì si
    # accetta un punto più lontano, se no il cranio resta grosso sopra il viso (a fungo)
    hw0 = np.zeros(nw)
    np.add.at(hw0, wid, wsum(is_head))
    hw0 /= np.bincount(wid, minlength=nw)
    dd = np.where(np.isfinite(best_d), best_d, 1)
    valid = np.isfinite(best_d) * (1 - smoothstep(0.03 + 0.05 * hw0, 0.05 + 0.06 * hw0, dd)) * smoothstep(0.006, 0.03, db)
    print("distanza dall'atlante (cm):", np.percentile(best_d[np.isfinite(best_d)] * 100, [50, 90, 99]).round(2), "validi", round(float((valid > 0.5).mean()), 3))

    # ---- viso: la pelle davanti va sulla superficie dell'atlante solo in profondità (lungo z), senza scorrere:
    # le cavità del personaggio (occhi, narici) si appiattiscono invece di piegarsi sopra le sopracciglia
    head_w = np.zeros(nw)
    np.add.at(head_w, wid, wsum(is_head))
    head_w /= np.bincount(wid, minlength=nw)
    hsel = AI[P[AI][:, :, 1].min(1) > 1.45]
    zb, (fx0, fy1, ppm) = front_depth(P, hsel, -0.11, 0.11, 1.44, 1.78)
    fx = (qw[:, 0] - fx0) * ppm
    fy = (fy1 - qw[:, 1]) * ppm
    ok_f = (fx >= 0) & (fx < zb.shape[1] - 1) & (fy >= 0) & (fy < zb.shape[0] - 1)
    zf = np.full(nw, -np.inf)
    ix, iy = np.clip(fx.astype(int), 0, zb.shape[1] - 1), np.clip(fy.astype(int), 0, zb.shape[0] - 1)
    zf[ok_f] = zb[iy[ok_f], ix[ok_f]]
    # davanti: la pelle che guarda avanti, e tutto il viso (anche le pareti delle cavità degli occhi, che
    # guardano di lato: con il punto più vicino finirebbero sulle tempie, stirate)
    face_reg = smoothstep(0.015, 0.035, qw[:, 2]) * (1 - smoothstep(0.055, 0.07, np.abs(qw[:, 0])))
    front = np.maximum(smoothstep(0.3, 0.65, nqw[:, 2]), face_reg) * smoothstep(0.2, 0.6, head_w) * np.isfinite(zf)
    tgt = np.where(np.isfinite(best_d)[:, None], best_p, qw)
    tgt = np.where(front[:, None] > 0, tgt * (1 - front[:, None]) + np.stack([qw[:, 0], qw[:, 1], np.where(np.isfinite(zf), zf, qw[:, 2])], 1) * front[:, None], tgt)
    valid = np.maximum(valid, front)
    print("viso proiettato di fronte:", int((front > 0.5).sum()), "punti")
    # cranio (fuori dal viso): lungo il raggio dal centro della testa fino alla pelle dell'atlante. Con il punto più
    # vicino la nuca finiva sul collo (un incavo sotto i capelli, testa a fungo)
    CH0 = np.array([0.0, 1.61, -0.01])
    hsel2 = AI[P[AI][:, :, 1].min(1) > 1.46]
    RS = sphere_radius(P, hsel2, CH0)
    dq = qw - CH0
    rq = np.maximum(np.linalg.norm(dq, axis=1), 1e-9)
    uq = ((np.arctan2(dq[:, 0], dq[:, 2]) / (2 * np.pi) + 0.5) * RS.shape[1]).astype(int) % RS.shape[1]
    vq = np.clip((np.arccos(np.clip(dq[:, 1] / rq, -1, 1)) / np.pi * RS.shape[0]).astype(int), 0, RS.shape[0] - 1)
    ra = RS[vq, uq]
    # solo dove la direzione sta sopra il collo (v < 0,62: dall'alto fino sotto le orecchie)
    vfrac = vq / RS.shape[0]
    radial = smoothstep(0.3, 0.7, head_w) * (1 - smoothstep(0.6, 0.82, vfrac)) * (1 - front) * np.isfinite(ra)
    rad_t = CH0 + dq / rq[:, None] * np.where(np.isfinite(ra), ra, rq)[:, None]
    tgt = tgt * (1 - radial[:, None]) + rad_t * radial[:, None]
    valid = np.maximum(valid, radial)
    print("cranio lungo il raggio:", int((radial > 0.5).sum()), "punti")

    # ---- spostamento: dove l'atlante manca si riempie dai vicini, poi si ammorbidisce appena
    D = tgt - qw
    # le cavità appiattite lasciano triangoli rovesciati: i punti del viso si distendono sulla superficie
    # dell'atlante (media dei vicini in x, y, poi di nuovo sulla profondità vista di fronte)
    fm = front > 0.5
    xy = tgt[:, :2].copy()
    for _ in range(12):
        xy[fm] = 0.5 * xy[fm] + 0.5 * avg(xy)[fm]
        fx2 = np.clip(((xy[:, 0] - fx0) * ppm).astype(int), 0, zb.shape[1] - 1)
        fy2 = np.clip(((fy1 - xy[:, 1]) * ppm).astype(int), 0, zb.shape[0] - 1)
        z2 = zb[fy2, fx2]
        okz = fm & np.isfinite(z2)
        tgt[okz, 0], tgt[okz, 1], tgt[okz, 2] = xy[okz, 0], xy[okz, 1], z2[okz]
    D = tgt - qw
    Df = D * valid[:, None]
    for _ in range(400):
        Df = valid[:, None] * D + (1 - valid[:, None]) * avg(Df)
    for lam in (0.5, -0.53, 0.5, -0.53):  # Taubin: liscia senza restringere
        Df = Df + lam * (avg(Df) - Df)
    disp = Df * kw[:, None]
    qn = qw + disp

    # ---- muscolo sotto la pelle (il più vicino): gruppo, ventre, tendine; la pelle lo segue quanto gli è vicina
    MP, MG, MF, MT = load_muscles(anat_path)
    dm, im = cKDTree(MP).query(qn)
    belly = np.power(np.maximum(np.sin(np.pi * MF[im]), 0), 0.75)
    bk = belly * (1 - MT[im]) * (1 - smoothstep(0.012, 0.03, dm)) * kw
    grp = MG[im]
    # ai confini tra due muscoli la pelle non segue nessuno dei due per intero (niente gradini)
    Ac = Adj.tocoo()
    eq = grp[Ac.row] == grp[Ac.col]
    Same = coo_matrix((eq.astype(float), (Ac.row, Ac.col)), shape=Adj.shape).tocsr()
    nb_cnt = np.asarray(Same.sum(1)).ravel()
    bk *= (nb_cnt / deg) ** 2
    for _ in range(3):
        bk = 0.5 * bk + 0.5 * (Same @ bk) / np.maximum(nb_cnt, 1)
    print("pelle sopra un muscolo:", round(float((bk > 0.05).mean()), 3), "gruppi", len(np.unique(grp[bk > 0.05])))

    # ---- occlusione dentro ogni parte (le braccia e le gambe si muovono: non si coprono tra loro)
    nn = vnormals(qn, triw)
    dom = Q["jo"][first, np.argmax(Q["wt"][first], 1)]

    def part(name):
        if name.startswith(("upperarm", "lowerarm") + HAND):
            return "arm_" + name[-1]
        if name.startswith(("thigh", "calf", "foot", "ball")):
            return "leg_" + name[-1]
        return "torso"

    vpart = np.array([part(names[j]) for j in dom])
    tpart = vpart[triw[:, 0]]
    ao = np.ones(nw)
    for pname in np.unique(vpart):
        occl = [pname] if pname.startswith("arm") else ([pname, "torso"] if pname.startswith("leg") else ["torso", "leg_l", "leg_r"])
        sel = np.isin(tpart, occl)
        pts = surface_samples(qn, triw[sel])
        m = vpart == pname
        ao[m] = ray_ao(qn[m] + nn[m] * 0.002, nn[m], pts)
        print("occlusione", pname, int(m.sum()), "punti", round(float(ao[m].mean()), 3))
    # cavità locale (solchi tra i muscoli)
    tree = cKDTree(qn)
    cav = np.zeros(nw)
    for rad, wgt in ((0.015, 0.6), (0.04, 0.4)):
        nb = tree.query_ball_point(qn, rad)
        cen_nb = np.array([qn[l].mean(0) for l in nb])
        c = ((cen_nb - qn) * nn).sum(1) / rad
        cav += wgt * np.clip(c * 4.0, 0, 1)
    occ = np.clip(ao, 0, 1) * (1 - 0.45 * np.clip(cav, 0, 1))
    occ = 0.5 * occ + 0.5 * avg(occ)
    occ = np.clip(occ, 0.3, 1.0)

    # ---- di nuovo nello spazio del personaggio: p' = M^-1 (q' - t)
    qn_u = q + disp[wid]
    Minv = np.linalg.inv(M)
    pn = np.einsum("vij,vj->vi", Minv, qn_u - t)
    # normali dalla nuova forma (saldate sui bordi delle uv), mescolate a quelle originali dove non si sposta
    nb_ = vnormals(pn[first], triw)[wid]
    kk = kw[wid][:, None]
    nrm = kk * nb_ + (1 - kk) * Q["nrm"]
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    # gonfiore nello spazio del personaggio (la sua scala)
    # la parte da togliere a gomito chiuso, nello spazio del personaggio
    zw = np.zeros(nw)
    np.maximum.at(zw, wid, zone)
    zs = np.zeros(nw, np.int64)
    np.maximum.at(zs, wid, zside)
    for _ in range(3):
        zw = 0.5 * zw + 0.5 * avg(zw)
    delta = np.einsum("vij,vj->vi", Minv, disp[wid] * zw[wid][:, None])
    s = np.cbrt(np.abs(np.linalg.det(M)))
    bulge = bk[wid] / np.maximum(s, 1e-6)
    BK = 1.25
    paint = 1 - 0.75 * kw[wid]
    # viso: dove conta la foto del viso (testa, con passaggio morbido sul collo)
    fw = np.zeros(nw)
    np.add.at(fw, wid, smoothstep(0.25, 0.75, wsum(is_head)))
    fw /= np.bincount(wid, minlength=nw)
    for _ in range(3):
        fw = 0.5 * fw + 0.5 * avg(fw)
    face = fw[wid]

    # ---- scrittura (stride 31)
    ST = 42

    def pack(m, extra):
        nv = len(m["pos"])
        buf = np.zeros((nv, ST), np.uint8)
        buf[:, 0:12] = m["pos"].astype("<f4").view(np.uint8).reshape(nv, 12)
        buf[:, 12:15] = np.clip(np.round(m["nrm"] * 127), -127, 127).astype(np.int8).view(np.uint8)
        buf[:, 15:19] = np.round(m["uv"]).astype("<u2").view(np.uint8).reshape(nv, 4)
        buf[:, 19:23] = m["jo"].astype(np.uint8)
        w = np.round(m["wt"] * 255)
        w[:, 0] += 255 - w.sum(1)
        buf[:, 23:27] = np.clip(w, 0, 255).astype(np.uint8)
        buf[:, 27 : 27 + extra.shape[1]] = extra
        return buf

    ex = np.stack([grp[wid], np.clip(np.round(bulge / BK * 255), 0, 255), np.round(occ[wid] * 255), np.round(paint * 255)], 1).astype(np.uint8)
    dq = np.clip(np.round(delta * 1e4), -32767, 32767).astype("<i2").view(np.uint8).reshape(-1, 6)
    zb = np.where(zs[wid] > 0, (zs[wid] - 1) * 128 + np.round(np.clip(zw[wid], 0, 1) * 127), 0).astype(np.uint8)[:, None]
    # le normali della forma del personaggio, per il braccio piegato
    n0 = np.clip(np.round(Q["nrm"] * 127), -127, 127).astype(np.int8).view(np.uint8)
    ex = np.concatenate([ex, dq, zb, n0, np.round(face * 255).astype(np.uint8)[:, None]], 1)
    print("braccio piegato:", int((zw[wid] > 0.05).sum()), "vertici, spostamento medio (mm)", round(float(np.linalg.norm(delta, axis=1)[zw[wid] > 0.05].mean() * 1000), 2))
    # ---- testa nuova: i triangoli della testa (viso almeno a metà) vanno in coda, con punti loro (copie) e uv
    # loro, sferiche attorno al centro del cranio (davanti al centro dell'immagine, la giunta dietro, tra i
    # capelli): l'immagine è pelle-testa.jpg, cotta da bake_face.py. Così niente uv sovrapposte del personaggio
    restU = q + disp[wid]
    tri_all = Q["idx"]
    hmask = face[tri_all].mean(1) >= 0.5
    htri, btri = tri_all[hmask], tri_all[~hmask]
    hv = np.unique(htri)
    remap = np.full(n, -1)
    remap[hv] = np.arange(len(hv)) + n
    htri2 = remap[htri]
    CH = np.array([0.0, 1.61, -0.01])
    dh = restU[hv] - CH
    rh = np.maximum(np.linalg.norm(dh, axis=1), 1e-9)
    hu = 0.5 + np.arctan2(dh[:, 0], dh[:, 2]) / (2 * np.pi)
    hvv = np.arccos(np.clip(dh[:, 1] / rh, -1, 1)) / np.pi
    huv = np.stack([hu, hvv], 1)
    # triangoli a cavallo della giunta dietro: i punti dall'altra parte fanno un giro (u + 1, l'immagine si ripete)
    extra_v = []
    loc = {int(v): i for i, v in enumerate(hv)}
    allv = list(hv)
    alluv = [tuple(x) for x in huv]
    for ti in range(len(htri2)):
        us = [alluv[htri2[ti, kk] - n][0] for kk in range(3)]
        if max(us) - min(us) > 0.5:
            for kk in range(3):
                li = htri2[ti, kk] - n
                if alluv[li][0] < 0.5:
                    allv.append(allv[li])
                    alluv.append((alluv[li][0] + 1.0, alluv[li][1]))
                    htri2[ti, kk] = n + len(allv) - 1
    allv = np.array(allv)
    alluv = np.array(alluv)
    print("testa:", len(htri), "triangoli,", len(allv), "punti (copie)")
    face_b = np.zeros(n)
    ex_b = ex.copy()
    ex_b[:, 14] = 0  # il corpo non usa la foto del viso
    ex_h = ex[allv].copy()
    ex_h[:, 14] = 255
    body = dict(
        pos=np.concatenate([pn, pn[allv]]),
        nrm=np.concatenate([nrm, nrm[allv]]),
        uv=np.concatenate([Q["uv"], np.round(alluv * 32767.0)]),
        jo=np.concatenate([Q["jo"], Q["jo"][allv]]),
        wt=np.concatenate([Q["wt"], Q["wt"][allv]]),
        idx=np.concatenate([btri, htri2]),
    )
    if len(body["pos"]) > 65535:
        raise SystemExit("troppi vertici per indici a 16 bit")
    vb = pack(body, np.concatenate([ex_b, ex_h]))
    eb = pack(E, np.tile(np.array([0, 0, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], np.uint8), (len(E["pos"]), 1)))
    parts = []
    off = 0
    meshes = {}

    def add(name, vbuf, idx):
        nonlocal off
        parts.append(vbuf.tobytes())
        vo = off
        off += vbuf.nbytes
        ib = idx.astype("<u2").tobytes()
        if off % 2:
            parts.append(b"\0")
            off += 1
        io = off
        parts.append(ib)
        off += len(ib)
        while off % 4:
            parts.append(b"\0")
            off += 1
        meshes[name] = {"n": len(vbuf), "vOffset": vo, "iOffset": io, "indices": int(idx.size)}

    add("corpo", vb, body["idx"])
    add("occhi", eb, E["idx"])
    j = dict(pj)
    j["stride"] = ST
    j["meshes"] = meshes
    j["extra"] = {"group": 27, "bulge": 28, "ao": 29, "paint": 30, "bulgeScale": BK, "delta": 31, "zone": 37, "nrm0": 38, "face": 41}
    j["hideEyes"] = True
    # indici della testa (dopo quelli del corpo) e uv della testa in 0..2 (u fa un giro in più dietro)
    j["meshes"]["corpo"]["headStart"] = int(btri.size)
    j["headUvScale"] = 2.0
    j["wrap"] = "forma dalla pelle di BodyParts3D (CC BY 4.0) dove c'è, vedi scripts/anatomia/wrap_skin.py"
    open(out + ".bin", "wb").write(b"".join(parts))
    # per la foto del viso: la pelle a riposo nell'atlante (viso verso +z), uv e quanto conta il viso
    np.savez(out + ".rest.npz", pos=restU[allv], nrm=nn[wid][allv], uv=alluv, tri=htri2 - n, face=face[allv])
    # per il rilievo del corpo (bake_relief.py): tutta la pelle a riposo, uv del corpo, triangoli del corpo e la parte
    # (0 busto, 1 braccio sinistro, 2 braccio destro, 3 gamba sinistra, 4 gamba destra, 5 mani e testa: niente rilievo)
    pid = np.zeros(n, np.int64)
    up_l, up_r = wsum(np.array([nm.startswith(("upperarm_l", "lowerarm_l")) for nm in names])), wsum(np.array([nm.startswith(("upperarm_r", "lowerarm_r")) for nm in names]))
    lg_l, lg_r = wsum(np.array([nm.endswith("_l") and nm.startswith(("thigh", "calf", "foot", "ball")) for nm in names])), wsum(np.array([nm.endswith("_r") and nm.startswith(("thigh", "calf", "foot", "ball")) for nm in names]))
    other = wsum(is_hand | is_head)
    stack = np.stack([1 - up_l - up_r - lg_l - lg_r - other, up_l, up_r, lg_l, lg_r, other], 1)
    pid = np.argmax(stack, 1)
    np.savez(out + ".body.npz", pos=restU, nrm=nn[wid], uv=Q["uv"] / 65535.0, tri=btri, part=pid, arm=np.stack([up_l, up_r], 1))
    json.dump(j, open(out + ".json", "w"), separators=(",", ":"))
    print("scritto", out, off, "byte")


if __name__ == "__main__":
    main()
