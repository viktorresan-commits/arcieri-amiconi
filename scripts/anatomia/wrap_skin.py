"""
Pelle vera fedele all'anatomia: il corpo chiuso del personaggio Quaternius (pelle.bin) prende la forma della
pelle dell'atlante (BodyParts3D, che segue i muscoli veri) senza i suoi buchi.

1. ogni triangolo del personaggio si divide in quattro (più punti per seguire i muscoli);
2. il personaggio si mette nel riposo dell'atlante con le stesse ossa dell'app (rest-bones.json, da
   scripts/anatomia/wrap_rest.ts) e ogni punto va sul punto più vicino della pelle dell'atlante con la
   normale concorde, spalle e gomiti compresi; dove l'atlante ha buchi (ascelle) o è lontano lo spostamento si
   riempie dai vicini; mani e dita dei piedi restano quelle del personaggio (dita vere). La testa prima si porta
   su quella dell'atlante (scala e spostamento per asse), poi come il resto; le orecchie (l'atlante non le ha)
   seguono la pelle attorno, gli occhi si appiattiscono di fronte (arrivano dalla foto del viso);
2a. involucro: per busto (con testa e clavicole), braccia e gambe si fa una griglia di 2,5 mm con muscoli e ossa
   della stessa parte (la parte di ogni punto della pelle viene dai pesi dello scheletro del personaggio, così
   l'interno del braccio non finisce sul busto), si chiude, si gonfia di 12 mm e si stringe fino a 4 mm sopra i
   tessuti, si leviga; ogni punto va su quella superficie lungo il gradiente della distanza. Testa, mani e dita
   dei piedi restano fuori (viso dalla foto, dita vere). WRAP_DEBUG=1 salva le griglie per controllo;
2b. pesi: ogni punto si muove con i segmenti dei muscoli e delle ossa dell'atlante sotto di lui (le stesse matrici
   nell'app), presi solo dai tessuti della stessa parte; vicino alla spalla braccio e busto si dividono entro
   5-9 cm dal giunto (niente lembi della scapola trascinati dal braccio); mano, dita e pollice dell'atlante
   passano alle ossa delle mani vere: in ogni posa la pelle riveste i suoi muscoli e le sue ossa;
3. dalla pelle dell'atlante si prende anche il muscolo sotto (gruppo, ventre, quanto la pelle lo segue):
   nell'app la pelle si gonfia con il muscolo che lavora, come quella dell'atlante;
4. occlusione ambientale (pieghe, sotto i pettorali, glutei) dentro ogni parte del corpo, più la cavità
   locale (solchi degli addominali, tra i muscoli);
5. quanto conta il chiaroscuro dipinto: tutto su testa e mani, poco dove la forma viene dall'atlante.

Uscita: pelle.bin / pelle.json con 15 byte in più per vertice (stride 42): gruppo, gonfiore, occlusione, dipinto,
10 byte liberi (erano il ritorno alla forma del personaggio a gomito chiuso) e quanto conta la foto del viso. Il corpo
è a riposo nello spazio dell'atlante; giunti 0..20 = segmenti dell'atlante, 21 + k = ossa del personaggio (le mani),
con restInv in pelle.json. Più pelle.rest.npz e pelle.body.npz per bake_face.py e bake_relief.py.

Uso (vedi LEGGIMI.md):
  node /tmp/wrap_rest.mjs public/anatomia/corpo.json <pelle originale>.json > rest-bones.json
  python3 scripts/anatomia/wrap_skin.py <pelle originale senza estensione> <rest-bones.json> <corpo atlante> <uscita>
"""
import json
import os
import sys

import numpy as np
from scipy.ndimage import binary_fill_holes, distance_transform_edt, gaussian_filter, map_coordinates
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


def load_atlas_all(path):
    """tutti i vertici dell'atlante (ossa, muscoli, pelle) a riposo, con i due segmenti e il peso del primo"""
    j = json.load(open(path + ".json"))
    b = open(path + ".bin", "rb").read()
    st = j["stride"]
    lo, hi = np.array(j["lo"]), np.array(j["hi"])
    P, J, W, L = [], [], [], []
    for bt in j["batches"]:
        n = bt["vertices"]
        raw = np.frombuffer(b, np.uint8, n * st, bt["vOffset"]).reshape(n, st)
        P.append(lo + raw[:, 0:6].copy().view("<u2").reshape(n, 3) / 65535.0 * (hi - lo))
        J.append(raw[:, 9:11].astype(np.int64))
        W.append(raw[:, 11].astype(np.float64) / 255)
        L.append(np.full(n, {"bone": 0, "muscle": 1, "skin": 2}[bt["layer"]]))
    return j["segments"], np.concatenate(P), np.concatenate(J), np.concatenate(W), np.concatenate(L)


def load_tissue(path):
    """ossa e muscoli dell'atlante a riposo: vertici (posizione, due segmenti, peso del primo) e triangoli"""
    j = json.load(open(path + ".json"))
    b = open(path + ".bin", "rb").read()
    st = j["stride"]
    lo, hi = np.array(j["lo"]), np.array(j["hi"])
    P, J, W, T = [], [], [], []
    off = 0
    for bt in j["batches"]:
        if bt["layer"] not in ("bone", "muscle"):
            continue
        n = bt["vertices"]
        raw = np.frombuffer(b, np.uint8, n * st, bt["vOffset"]).reshape(n, st)
        P.append(lo + raw[:, 0:6].copy().view("<u2").reshape(n, 3) / 65535.0 * (hi - lo))
        J.append(raw[:, 9:11].astype(np.int64))
        W.append(raw[:, 11].astype(np.float64) / 255)
        T.append(np.frombuffer(b, "<u2", bt["indices"], bt["iOffset"]).reshape(-1, 3).astype(np.int64) + off)
        off += n
    return j["segments"], np.concatenate(P), np.concatenate(J), np.concatenate(W), np.concatenate(T)


def tri_samples(P, T, step=0.002):
    """punti fitti sui triangoli, quanti servono per ognuno (lati lunghi, più punti)"""
    A, B, C = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    L = np.maximum.reduce([np.linalg.norm(B - A, axis=1), np.linalg.norm(C - B, axis=1), np.linalg.norm(A - C, axis=1)])
    ks = np.clip(np.ceil(L / step).astype(int), 1, 16)
    out = [A, B, C]
    for k in np.unique(ks):
        m = ks == k
        a, b_, c = A[m], B[m], C[m]
        for i in range(k + 1):
            for jj in range(k + 1 - i):
                if (i, jj) in ((0, 0), (k, 0), (0, k)):
                    continue
                u, v = i / k, jj / k
                out.append(a + (b_ - a) * u + (c - a) * v)
    return np.concatenate(out)


def envelope(points, vox=0.0025, r=0.012, t=0.004):
    """
    involucro dei tessuti: i punti dilatati di r e riempiti dentro, poi erosi di r - t (chiusura): la superficie
    segue muscoli e ossa a t di distanza, i solchi più stretti di 2 r si chiudono. phi < 0 dentro, 0 sulla pelle.
    """
    lo = points.min(0) - (r + 0.03)
    hi = points.max(0) + (r + 0.03)
    shape = tuple(np.ceil((hi - lo) / vox).astype(int) + 1)
    M = np.zeros(shape, bool)
    ijk = np.floor((points - lo) / vox).astype(int)
    M[ijk[:, 0], ijk[:, 1], ijk[:, 2]] = True
    O = distance_transform_edt(~M) <= r / vox
    del M
    O = binary_fill_holes(O)
    S = (distance_transform_edt(~O) - distance_transform_edt(O)).astype(np.float32) * vox
    del O
    phi = gaussian_filter(S + np.float32(r - t), 1.0)
    return {"lo": lo, "vox": vox, "phi": phi}


def env_sample(env, p):
    idx = ((p - env["lo"]) / env["vox"]).T
    return map_coordinates(env["phi"], idx, order=1, mode="nearest")


def env_project(env, p, iters=6):
    """ogni punto sulla superficie dell'involucro (lungo il gradiente)"""
    h = env["vox"]
    q = p.copy()
    for _ in range(iters):
        f = env_sample(env, q)
        g = np.stack([(env_sample(env, q + h * e) - env_sample(env, q - h * e)) / (2 * h) for e in np.eye(3)], 1)
        gn = np.maximum((g * g).sum(1), 0.05)
        q = q - (f / gn)[:, None] * g
    return q, env_sample(env, q)


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
    # la pelle si muove con gli stessi segmenti di muscoli e ossa (pesi dell'atlante, più sotto): anche spalla e
    # gomito prendono la forma dell'atlante, senza il compromesso «forma del personaggio fatta per piegarsi»
    del jf
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

    # ---- testa: quella del personaggio è più alta di circa 5 cm e ha il viso 2 cm più avanti dell'atlante. Prima si
    # porta tutta sulla testa dell'atlante con scala e spostamento per asse (stimati sui punti), poi ogni punto va
    # sulla pelle dell'atlante come il resto del corpo: una sola regola, niente piega alle tempie (prima il viso
    # andava solo in profondità e il cranio lungo il raggio, due superfici diverse)
    P, AI = load_anat(anat_path)
    head_w = np.zeros(nw)
    np.add.at(head_w, wid, wsum(is_head))
    head_w /= np.bincount(wid, minlength=nw)
    hb = head_w.copy()
    for _ in range(6):
        hb = 0.5 * hb + 0.5 * avg(hb)
    hb = smoothstep(0.15, 0.6, hb)
    Ah = P[P[:, 1] > 1.50]
    hq = qw[(head_w > 0.6) & (qw[:, 1] > 1.53)]
    sc, off = np.ones(3), np.zeros(3)
    th = cKDTree(Ah)
    for _ in range(40):
        _, ii = th.query(hq * sc + off)
        y = Ah[ii]
        for a in range(3):
            sc[a], off[a] = np.linalg.lstsq(np.stack([hq[:, a], np.ones(len(hq))], 1), y[:, a], rcond=None)[0]
    qa = qw + hb[:, None] * (qw * sc + off - qw)
    nqa = vnormals(qa, triw)
    print("testa sulla testa dell'atlante: scala", sc.round(3), "spostamento medio (cm)", round(float(np.linalg.norm((qa - qw)[head_w > 0.6], axis=1).mean() * 100), 2))

    # ---- punto più vicino sulla pelle dell'atlante (normale concorde)
    tn = np.cross(P[AI[:, 1]] - P[AI[:, 0]], P[AI[:, 2]] - P[AI[:, 0]])
    tn /= np.maximum(np.linalg.norm(tn, axis=1, keepdims=True), 1e-12)
    cen = P[AI].mean(1)
    K = 16
    _, cand = cKDTree(cen).query(qa, K)
    best_d = np.full(nw, np.inf)
    best_p = qa.copy()
    for k in range(K):
        tr = cand[:, k]
        cp, bary = closest_on_tris(qa, P[AI[tr, 0]], P[AI[tr, 1]], P[AI[tr, 2]])
        d = np.linalg.norm(cp - qa, axis=1)
        agree = (tn[tr] * nqa).sum(1) > 0.25
        better = agree & (d < best_d)
        best_d[better], best_p[better] = d[better], cp[better]
    # bordi dei buchi dell'atlante (lati con un triangolo solo)
    e = np.sort(np.concatenate([AI[:, [0, 1]], AI[:, [1, 2]], AI[:, [2, 0]]]), 1)
    ue, cnt = np.unique(e, axis=0, return_counts=True)
    bverts = np.unique(ue[cnt == 1])
    db = cKDTree(P[bverts]).query(best_p)[0] if len(bverts) else np.full(nw, 1.0)
    dd = np.where(np.isfinite(best_d), best_d, 1)
    valid = np.isfinite(best_d) * (1 - smoothstep(0.03, 0.05, dd)) * smoothstep(0.006, 0.03, db)
    # orecchie: l'atlante non le ha; quelle del personaggio seguono la pelle attorno (spostamento dai vicini)
    ax_ = np.abs(qa[:, 0])
    ear = (head_w > 0.5) & (ax_ > 0.06) & (qa[:, 1] > 1.55) & (qa[:, 1] < 1.68) & (qa[:, 2] > -0.06) & (qa[:, 2] < 0.035) & (dd > 0.004)
    valid[ear] = 0
    print("distanza dall'atlante (cm):", np.percentile(best_d[np.isfinite(best_d)] * 100, [50, 90, 99]).round(2), "validi", round(float((valid > 0.5).mean()), 3), "orecchie", int(ear.sum()))

    # ---- occhi: nell'atlante sono gallerie; lì la pelle va sulla profondità vista di fronte con le gallerie chiuse
    # (gli occhi veri arrivano dalla foto del viso, su una superficie liscia)
    hsel = AI[P[AI][:, :, 1].min(1) > 1.45]
    zb, (fx0, fy1, ppm) = front_depth(P, hsel, -0.11, 0.11, 1.44, 1.78)
    fx = (qa[:, 0] - fx0) * ppm
    fy = (fy1 - qa[:, 1]) * ppm
    ok_f = (fx >= 0) & (fx < zb.shape[1] - 1) & (fy >= 0) & (fy < zb.shape[0] - 1)
    zf = np.full(nw, -np.inf)
    ix, iy = np.clip(fx.astype(int), 0, zb.shape[1] - 1), np.clip(fy.astype(int), 0, zb.shape[0] - 1)
    zf[ok_f] = zb[iy[ok_f], ix[ok_f]]
    eyes = smoothstep(0.004, 0.012, ax_) * (1 - smoothstep(0.052, 0.062, ax_)) * smoothstep(1.572, 1.582, qa[:, 1]) * (1 - smoothstep(1.615, 1.625, qa[:, 1]))
    front = eyes * smoothstep(0.0, 0.015, qa[:, 2]) * smoothstep(0.4, 0.7, head_w) * np.isfinite(zf)
    tgt = np.where(np.isfinite(best_d)[:, None], best_p, qa)
    tgt = np.where(front[:, None] > 0, tgt * (1 - front[:, None]) + np.stack([qa[:, 0], qa[:, 1], np.where(np.isfinite(zf), zf, qa[:, 2])], 1) * front[:, None], tgt)
    valid = np.maximum(valid, front)
    # dove la pelle non va sull'atlante resta quella allineata (non quella di partenza)
    tgt = np.where(valid[:, None] > 0, tgt, qa)
    print("occhi di fronte:", int((front > 0.5).sum()), "punti")

    # ---- spostamento: dove l'atlante manca si riempie dai vicini, poi si ammorbidisce appena
    # le cavità appiattite lasciano triangoli rovesciati: i punti degli occhi si distendono sulla superficie
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
    if os.environ.get("WRAP_DEBUG"):
        np.savez(os.environ["WRAP_DEBUG"], qw=qw, tgt=tgt, valid=valid, head_w=head_w, front=front, triw=triw, nqw=nqw)
    # dove la pelle non va sull'atlante lo spostamento viene dai vicini; sulla testa si parte da quello
    # dell'allineamento (orecchie comprese)
    Df = D * valid[:, None] + (qa - qw) * (1 - valid[:, None])
    for _ in range(400):
        Df = valid[:, None] * D + (1 - valid[:, None]) * avg(Df)
    for lam in (0.5, -0.53, 0.5, -0.53):  # Taubin: liscia senza restringere
        Df = Df + lam * (avg(Df) - Df)
    disp = Df * kw[:, None]
    qn = qw + disp

    # ---- la pelle sulla sagoma di muscoli e ossa: per ogni parte del corpo (busto con testa, braccia, gambe,
    # separate perché non si faccia la membrana tra braccio e fianco o tra le cosce) l'involucro dei suoi tessuti
    # a 4 mm; la pelle ci va sopra, la testa (viso vero), le mani e le dita dei piedi restano quelle di prima
    tsegs, TP, TJ, TW, TT = load_tissue(anat_path)
    part_of = {}
    for i, nm in enumerate(tsegs):
        part_of[i] = "torso" if nm in ("bacino", "torace", "testa", "clav_L", "clav_R") else ("arm_" + nm[-1]) if nm.split("_")[0] in ("omero", "avambr", "mano", "dita", "pollice") else ("leg_" + nm[-1])
    parts = sorted(set(part_of.values()))
    PW = np.zeros((len(TP), len(parts)))
    for i, nm in part_of.items():
        k = parts.index(nm)
        PW[:, k] += np.where(TJ[:, 0] == i, TW, 0) + np.where(TJ[:, 1] == i, 1 - TW, 0)
    # parti della pelle: dallo scheletro del personaggio (non dal tessuto più vicino: la pelle dell'interno del
    # braccio, a riposo accanto al fianco, finiva sul busto e a braccio alzato restava incollata al fianco)
    def char_part(nm):
        if nm.startswith(("upperarm", "lowerarm") + HAND):
            return "arm_" + nm[-1].upper()
        if nm.startswith(("thigh", "calf", "foot", "ball")):
            return "leg_" + nm[-1].upper()
        return "torso"

    cpart = np.array([char_part(nm) for nm in names])
    SPW = np.stack([wsum(cpart == pn)[first] for pn in parts], 1)
    SPW /= np.maximum(SPW.sum(1, keepdims=True), 1e-12)
    for _ in range(2):
        SPW = 0.5 * SPW + 0.5 * avg(SPW)
    hw_s = head_w.copy()
    for _ in range(4):
        hw_s = 0.5 * hw_s + 0.5 * avg(hw_s)
    ew = kw * (1 - smoothstep(0.25, 0.65, hw_s))
    tgt2 = np.zeros_like(qn)
    wsum2 = np.zeros(nw)
    for k, pname in enumerate(parts):
        use = (SPW[:, k] > 0.02) & (ew > 0.01)
        if not use.any():
            continue
        member = PW[:, k] >= 0.25
        tri = TT[member[TT].all(1)]
        pts = tri_samples(TP, tri)
        env = envelope(pts)
        proj, res = env_project(env, qn[use])
        ok = np.abs(res) < 0.003
        w = SPW[use, k] * ok
        tgt2[use] += proj * w[:, None]
        wsum2[use] += w
        print("involucro", pname, env["phi"].shape, "punti", int(use.sum()), "spostamento medio (mm)", round(float(np.linalg.norm(proj - qn[use], axis=1)[ok].mean() * 1000), 1), "non riusciti", int((~ok).sum()))
        del env
    have = wsum2 > 1e-6
    D2 = np.zeros_like(qn)
    D2[have] = tgt2[have] / wsum2[have, None] - qn[have]
    D2 *= (ew * np.clip(wsum2 / np.maximum(SPW.sum(1), 1e-9), 0, 1))[:, None]
    for lam in (0.5, -0.53, 0.5, -0.53, 0.5, -0.53):
        D2 = D2 + lam * (avg(D2) - D2)
    print("pelle sulla sagoma dei tessuti: spostamento medio (mm)", round(float(np.linalg.norm(D2, axis=1)[ew > 0.5].mean() * 1000), 1))
    disp = disp + D2
    qn = qw + disp

    # ---- pesi: ogni punto della pelle si muove con i segmenti dei tessuti dell'atlante sotto di lui (muscoli e ossa,
    # gli stessi che li muovono nell'app), così in ogni posa la pelle resta sopra i suoi muscoli e le sue ossa.
    # La pelle dell'atlante non conta: ha pesi a gradini (si strappa sulle spalle). Ammorbiditi sulla pelle.
    segs, AP, AJ, AW, AL = load_atlas_all(anat_path)
    tissue = AL != 2
    AP, AJ, AW = AP[tissue], AJ[tissue], AW[tissue]
    nseg = len(segs)
    # parte di ogni tessuto (come per l'involucro): la pelle di una parte prende i pesi dai tessuti della sua parte
    APW = np.zeros((len(AP), len(parts)))
    for i, nm in part_of.items():
        k = parts.index(nm)
        APW[:, k] += np.where(AJ[:, 0] == i, AW, 0) + np.where(AJ[:, 1] == i, 1 - AW, 0)
    KW = 24
    Wseg = np.zeros((nw, nseg))
    dA0 = np.full(nw, np.inf)
    for k_p, pname in enumerate(parts):
        use = SPW[:, k_p] > 0.01
        mem = APW[:, k_p] >= 0.25
        if not use.any() or not mem.any():
            continue
        AP_p, AJ_p, AW_p = AP[mem], AJ[mem], AW[mem]
        dA, iA = cKDTree(AP_p).query(qn[use], KW)
        dA0[use] = np.minimum(dA0[use], dA[:, 0])
        sig = np.maximum(0.012, 1.5 * dA[:, :1])
        gA = np.exp(-((dA / sig) ** 2))
        Wp = np.zeros((int(use.sum()), nseg))
        rows = np.arange(len(Wp))
        for k in range(KW):
            ii = iA[:, k]
            np.add.at(Wp, (rows, AJ_p[ii, 0]), gA[:, k] * AW_p[ii])
            np.add.at(Wp, (rows, AJ_p[ii, 1]), gA[:, k] * (1 - AW_p[ii]))
        Wp /= np.maximum(Wp.sum(1, keepdims=True), 1e-12)
        Wseg[use] += Wp * SPW[use, k_p][:, None]
    Wseg /= np.maximum(Wseg.sum(1, keepdims=True), 1e-12)
    dA = dA0[:, None]
    for _ in range(6):
        Wseg = 0.5 * Wseg + 0.5 * avg(Wseg)
    print("tessuto dell'atlante più vicino (cm):", np.percentile(dA[:, 0] * 100, [50, 90, 99]).round(2))
    # braccio e busto si mescolano solo vicino alla spalla: il gran dorsale e il grande rotondo vanno dal busto
    # all'omero e davano un po' del braccio alla pelle del fianco, che a braccio alzato in trazione restava tesa
    # come un lembo dal braccio fino alla vita
    rest_pts = json.load(open(anat_path + ".json"))["rest"]
    for sd, shk in (("L", "11"), ("R", "12")):
        # anche la scapola (segmento della clavicola): la sua pelle segue il braccio solo vicino al giunto
        torso_i = [segs.index("torace"), segs.index("bacino"), segs.index(f"clav_{sd}")]
        arm_i = [segs.index(f"{nm}_{sd}") for nm in ("omero", "avambr", "mano", "dita", "pollice")]
        d_sh = np.linalg.norm(qn - np.array(rest_pts[shk]), axis=1)
        lim = 1 - smoothstep(0.05, 0.09, d_sh)
        aw, tw = Wseg[:, arm_i].sum(1), Wseg[:, torso_i].sum(1)
        mostly_torso = tw >= aw
        Wseg[np.ix_(mostly_torso, arm_i)] *= lim[mostly_torso, None]
        Wseg[np.ix_(~mostly_torso, torso_i)] *= lim[~mostly_torso, None]
    Wseg /= np.maximum(Wseg.sum(1, keepdims=True), 1e-12)
    for _ in range(2):
        Wseg = 0.5 * Wseg + 0.5 * avg(Wseg)

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
    # pesi per ogni vertice: segmenti dell'atlante (0..20, sulla posizione a riposo) e ossa delle mani vere
    # (21 + osso del personaggio): mano, dita e pollice dell'atlante passano alla mano vera
    NJ = len(names)
    Wc = np.zeros((n, nseg + NJ))
    Wa = Wseg[wid]
    for sd in ("L", "R"):
        hj = nseg + names.index(f"hand_{sd.lower()}")
        for nm in (f"mano_{sd}", f"dita_{sd}", f"pollice_{sd}"):
            si = segs.index(nm)
            Wa[:, si], Wc[:, hj] = 0.0, Wc[:, hj] + Wa[:, si]
    Wc[:, :nseg] += Wa
    Qh = np.zeros((n, NJ))
    for k in range(4):
        jk = Q["jo"][:, k]
        np.add.at(Qh, (np.arange(n), jk), Q["wt"][:, k] * is_hand[jk])
    hsum = Qh.sum(1, keepdims=True)
    Wc *= 1 - hsum
    Wc[:, nseg:] += Qh
    top = np.argsort(-Wc, 1)[:, :4]
    JO = top
    WT = np.take_along_axis(Wc, top, 1)
    WT /= np.maximum(WT.sum(1, keepdims=True), 1e-12)
    print("pesi: segmenti per punto (oltre 5%):", np.bincount((WT > 0.05).sum(1)).tolist())
    bulge = bk[wid]
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
    # niente più ritorno alla forma del personaggio a gomito chiuso: la pelle segue i muscoli dell'atlante
    dq = np.zeros((n, 6), np.uint8)
    zb = np.zeros((n, 1), np.uint8)
    n0 = np.zeros((n, 3), np.uint8)
    ex = np.concatenate([ex, dq, zb, n0, np.round(face * 255).astype(np.uint8)[:, None]], 1)
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
    # posizioni e normali a riposo nello spazio dell'atlante (le ossa delle mani ci arrivano con restInv)
    nrest = nn[wid]
    body = dict(
        pos=np.concatenate([restU, restU[allv]]),
        nrm=np.concatenate([nrest, nrest[allv]]),
        uv=np.concatenate([Q["uv"], np.round(alluv * 32767.0)]),
        jo=np.concatenate([JO, JO[allv]]),
        wt=np.concatenate([WT, WT[allv]]),
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
    j["extra"] = {"group": 27, "bulge": 28, "ao": 29, "paint": 30, "bulgeScale": BK, "face": 41}
    # pelle mossa dai segmenti dell'atlante: indici 0..20 segmenti, 21 + k ossa del personaggio (solo le mani);
    # restInv porta la posizione a riposo nello spazio del personaggio per le sue ossa (righe 3x3 e traslazione)
    j["rig"] = "atlante"
    j["segments"] = segs
    Rinv = np.linalg.inv(R)
    j["restInv"] = [[float(x) for x in list(Rinv[k].reshape(-1)) + list(-Rinv[k] @ T[k])] for k in range(NJ)]
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
