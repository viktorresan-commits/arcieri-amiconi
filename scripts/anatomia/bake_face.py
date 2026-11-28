"""
Testa nuova della pelle vera: la foto del viso del pacchetto pelle dell'avatar (08_face_albedo, vista di fronte)
si cuoce in un'immagine sola della testa (pelle-testa.jpg, 2048 x 1024, uv sferiche fatte da wrap_skin.py) sulla
testa che wrap_skin.py ha portato sulla forma dell'atlante.

- la foto si deforma sulla testa con punti di riferimento (occhi, naso, bocca, mento, tempie, mandibola) e una
  spline a piastra sottile: i punti dell'atlante sono in metri nel suo riposo (viso verso +z);
- dove la pelle guarda di lato o indietro la foto non basta: sopra le orecchie e dietro la testa capelli corti
  (presi dalla foto), altrove la pelle della guancia;
- ai bordi delle isole delle uv il colore si allarga di qualche pixel (niente cuciture con le mipmap).

Uso: python3 scripts/anatomia/bake_face.py <pelle.rest.npz> <(non usato)> <foto del viso> <pelle-testa.jpg> [pelle.json]
(con pelle.json vi scrive faceSkin, il colore medio della pelle della foto, per portarla al tono scelto)
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import binary_erosion, map_coordinates

W, H = 2048, 1024
PXM = 3500.0  # pixel per metro della vista di fronte dell'atlante usata per i punti
X0, Y1 = -0.1, 1.74

# punti dell'atlante (pixel della vista di fronte, 3500 px/m) -> punti della foto (pixel, 1408 di lato)
PAIRS = [
    # occhi: angolo esterno, interno, centro; sopracciglia
    ((190, 500), (455, 495)), ((288, 503), (605, 503)), ((239, 500), (528, 488)),
    ((410, 503), (815, 503)), ((507, 506), (965, 495)), ((458, 503), (890, 487)),
    ((239, 452), (528, 425)), ((458, 452), (890, 425)),
    # naso: radice, punta, base, ali
    ((352, 505), (710, 500)), ((352, 612), (710, 700)), ((352, 642), (710, 752)), ((300, 628), (612, 712)), ((405, 628), (808, 712)),
    # bocca: centro, angoli, labbro sopra e sotto
    ((352, 712), (710, 900)), ((268, 710), (560, 895)), ((436, 710), (858, 895)), ((352, 692), (710, 858)), ((352, 742), (710, 945)),
    # mento, attaccatura dei capelli, cima della testa
    ((352, 880), (712, 1168)), ((352, 240), (710, 170)), ((352, 72), (710, 22)),
    # lati: tempie, guance, mandibola, alto della testa
    ((128, 500), (325, 480)), ((598, 500), (1090, 480)),
    ((120, 700), (360, 850)), ((600, 700), (1060, 850)),
    ((150, 820), (440, 1050)), ((570, 820), (985, 1050)),
    ((155, 170), (430, 120)), ((560, 170), (985, 120)),
]
# piano della testa nel riposo dell'atlante
Y_EYE = Y1 - 503 / PXM
Y_MOUTH = Y1 - 712 / PXM


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def tile(img, size):
    """una toppa della foto ripetuta senza giunte (specchiata)"""
    a = np.concatenate([img, img[:, ::-1]], 1)
    return np.concatenate([a, a[::-1]], 0), size


def main():
    rest_path, base_path, photo_path, out_path = sys.argv[1:5]
    R = np.load(rest_path)
    pos, nrm, uv, tri, face = R["pos"], R["nrm"], R["uv"], R["tri"], R["face"]
    photo = np.asarray(Image.open(photo_path).convert("RGB")).astype(np.float64) / 255
    ph, pw = photo.shape[:2]
    k = pw / 1408.0
    # sagoma della testa nella foto (fondo nero), un po' ristretta
    lum = photo @ np.array([0.2126, 0.7152, 0.0722])
    silf = binary_erosion(lum > 0.035, iterations=int(6 * k)).astype(np.float64)

    src = np.array([[X0 + a / PXM, Y1 - b / PXM] for (a, b), _ in PAIRS])
    dst = np.array([[c * k, d * k] for _, (c, d) in PAIRS])
    tps = RBFInterpolator(src, dst, kernel="thin_plate_spline", smoothing=1e-4)

    # toppe: capelli corti (alto della testa) e pelle della guancia
    # la luce della foto (di fronte, guance e lati più scuri) si sommava a quella della scena: viso più scuro e più
    # rosso del collo. Metà dell'ombreggiatura larga della pelle si toglie (i dettagli fini restano)
    from scipy.ndimage import gaussian_filter

    lum_ph = photo @ np.array([0.2126, 0.7152, 0.0722])
    big = gaussian_filter(lum_ph * silf, 45 * k) / np.maximum(gaussian_filter(silf, 45 * k), 1e-3)
    ref_l = np.median(lum_ph[int(560 * k):int(640 * k), int(430 * k):int(520 * k)])
    mx_ = photo.max(2)
    sat_ = (mx_ - photo.min(2)) / np.maximum(mx_, 1e-3)
    skinish = np.clip((sat_ - 0.15) / 0.15, 0, 1) * np.clip((lum_ph - 0.12) / 0.1, 0, 1) * silf
    flat = np.clip(ref_l / np.maximum(big, 1e-3), 0.75, 1.45) ** 0.5
    photo = photo * (1 + (flat - 1) * skinish)[..., None]
    hair_patch = photo[int(45 * k):int(140 * k), int(560 * k):int(860 * k)]
    skin_patch = photo[int(560 * k):int(640 * k), int(430 * k):int(520 * k)]
    hair_mean = hair_patch.reshape(-1, 3).mean(0)
    skin_t, _ = tile(skin_patch, 0)
    skin_mean = skin_patch.reshape(-1, 3).mean(0)
    # colore ai bordi del viso, riga per riga (tempie, guance, mandibola, collo): per i lati della testa
    sil_b = silf > 0.5
    edge = np.zeros((2, ph, 3))
    for y in range(ph):
        xs = np.nonzero(sil_b[y])[0]
        if len(xs) < 80 * k:
            continue
        for side, x_in in ((0, xs[0]), (1, xs[-1])):
            a, b = (x_in + int(10 * k), x_in + int(45 * k)) if side == 0 else (x_in - int(45 * k), x_in - int(10 * k))
            edge[side, y] = photo[y, max(0, a):max(1, b)].mean(0)
    have = edge.sum(2) > 0
    for side in (0, 1):
        ys = np.nonzero(have[side])[0]
        for c in range(3):
            edge[side, :, c] = np.interp(np.arange(ph), ys, edge[side, ys, c])
        # molto ammorbidito in verticale: tempia, guancia, mandibola, senza righe (orecchie e ombre della foto)
        win = int(160 * k) | 1
        ker = np.ones(win) / win
        for c in range(3):
            edge[side, :, c] = np.convolve(np.pad(edge[side, :, c], win // 2, mode="edge"), ker, mode="valid")

    # tela larga due giri (u fino a 2): alla fine la parte oltre il primo giro si ripiega
    WW = 2 * W
    neutral = skin_mean
    out = np.tile(neutral, (H, WW, 1)).astype(np.float64)
    baked = np.zeros((H, WW), bool)
    prio = np.full((H, WW), -1.0)
    UVp = uv * np.array([W, H])
    sel = tri
    print("triangoli della testa", len(sel))
    # normali molto ammorbidite (saldate per posizione): dicono solo da che parte guarda la pelle
    key = np.round(pos * 1e5).astype(np.int64)
    _, first, wid = np.unique(key, axis=0, return_index=True, return_inverse=True)
    wid = wid.ravel()
    tw = wid[tri]
    nw = len(first)
    fn = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
    ns = np.zeros((nw, 3))
    for kk in range(3):
        np.add.at(ns, tw[:, kk], fn)
    e = np.concatenate([tw[:, [0, 1]], tw[:, [1, 2]], tw[:, [2, 0]]])
    e = np.concatenate([e, e[:, ::-1]])
    from scipy.sparse import coo_matrix

    Adj = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(nw, nw)).tocsr()
    Adj.data[:] = 1
    deg = np.maximum(np.asarray(Adj.sum(1)).ravel(), 1)
    for _ in range(25):
        ns = 0.4 * ns + 0.6 * (Adj @ ns) / deg[:, None]
    ns /= np.maximum(np.linalg.norm(ns, axis=1, keepdims=True), 1e-12)
    nrm = ns[wid]
    for t in sel:
        u = UVp[t]
        minx, maxx = int(max(0, np.floor(u[:, 0].min()))), int(min(WW - 1, np.ceil(u[:, 0].max())))
        miny, maxy = int(max(0, np.floor(u[:, 1].min()))), int(min(H - 1, np.ceil(u[:, 1].max())))
        if minx > maxx or miny > maxy:
            continue
        gx, gy = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
        d = (u[1, 1] - u[2, 1]) * (u[0, 0] - u[2, 0]) + (u[2, 0] - u[1, 0]) * (u[0, 1] - u[2, 1])
        if abs(d) < 1e-12:
            continue
        l0 = ((u[1, 1] - u[2, 1]) * (gx - u[2, 0]) + (u[2, 0] - u[1, 0]) * (gy - u[2, 1])) / d
        l1 = ((u[2, 1] - u[0, 1]) * (gx - u[2, 0]) + (u[0, 0] - u[2, 0]) * (gy - u[2, 1])) / d
        l2 = 1 - l0 - l1
        m = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
        if not m.any():
            continue
        a3 = 0.5 * np.linalg.norm(np.cross(pos[t[1]] - pos[t[0]], pos[t[2]] - pos[t[0]]))
        pr = a3 * (0.3 + max(0.0, float(nrm[t, 2].mean())))
        yy0, xx0 = gy[m].astype(int), gx[m].astype(int)
        win = pr > prio[yy0, xx0]
        if not win.any():
            continue
        m2 = m.copy()
        m2[m] = win
        m = m2
        prio[gy[m].astype(int), gx[m].astype(int)] = pr
        L = np.stack([l0[m], l1[m], l2[m]], 1)
        P = L @ pos[t]
        N = L @ nrm[t]
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
        F = L @ face[t]
        # foto di fronte
        q = tps(P[:, :2])
        inside = map_coordinates(silf, [q[:, 1], q[:, 0]], order=1, mode="constant")
        col = np.stack([map_coordinates(photo[..., c], [q[:, 1], q[:, 0]], order=1, mode="nearest") for c in range(3)], 1)
        # la foto solo dove la pelle guarda davvero davanti: di sbieco (lati della faccia) si allungava e sulle
        # orecchie del personaggio portava la tempia e i capelli della foto, a macchie
        ear = smoothstep(0.068, 0.076, np.abs(P[:, 0])) * smoothstep(Y_MOUTH + 0.02, Y_MOUTH + 0.035, P[:, 1]) * (1 - smoothstep(Y_EYE + 0.024, Y_EYE + 0.036, P[:, 1]))
        wf = smoothstep(0.3, 0.62, N[:, 2]) * np.clip(inside, 0, 1) * (1 - ear)
        # di lato e dietro: capelli sopra la linea delle orecchie e della nuca, pelle sotto. La linea non è dritta
        # (un'ondulazione lenta di qualche millimetro) e il passaggio è morbido: prima un taglio netto che sul
        # collo, con i triangoli stirati, diventava una frangia a denti
        ang = np.arctan2(P[:, 0], P[:, 2] + 0.01)
        yh = np.interp(P[:, 2], [-0.08, -0.06, -0.005, 0.03], [Y_MOUTH - 0.012, Y_MOUTH, Y_EYE + 0.022, Y_EYE + 0.03])
        yh = yh + 0.0025 * np.sin(ang * 7.0 + 0.6) + 0.0015 * np.sin(ang * 17.0 + 2.1)
        hw = smoothstep(-0.011, 0.009, P[:, 1] - yh)
        # l'orecchio resta pelle: i capelli gli girano attorno
        hw = hw * (1 - smoothstep(0.075, 0.079, np.abs(P[:, 0])) * (1 - smoothstep(Y_EYE + 0.022, Y_EYE + 0.032, P[:, 1])))
        # capelli rasati come nella foto: il loro colore medio con una grana fine (peli corti, pelle che si vede)
        cell = np.floor(P * 900.0)
        nz = np.modf(np.abs(np.sin(cell @ np.array([12.9898, 78.233, 37.719])) * 43758.5453))[0]
        hair = hair_mean[None, :] * (0.7 + 0.6 * nz[:, None])
        su = (ang * 0.09 / 0.03 * skin_t.shape[1]) % skin_t.shape[1]
        sv = ((Y1 - P[:, 1]) / 0.03 * skin_t.shape[0]) % skin_t.shape[0]
        grain = np.stack([map_coordinates(skin_t[..., c], [sv, su], order=1, mode="wrap") for c in range(3)], 1) / np.maximum(skin_mean, 1e-3)
        row = np.clip(q[:, 1], 0, ph - 1).astype(int)
        # il colore dei bordi della foto è in ombra (la foto è illuminata di fronte): sui lati della testa, che
        # nell'app hanno la loro luce, la pelle era più scura del collo. Si tiene poco di quella sfumatura
        side = np.where((P[:, 0] < 0)[:, None], edge[0, row], edge[1, row])
        skin = (0.25 * side + 0.75 * skin_mean[None, :]) * grain
        fill = hair * hw[:, None] + skin * (1 - hw[:, None])
        c = col * wf[:, None] + fill * (1 - wf[:, None])
        # verso il collo il colore va al tono medio della pelle (lì attacca il corpo, con il tono scelto)
        fade = smoothstep(0.5, 0.85, F)[:, None]
        c = neutral * (1 - fade) + c * fade
        yy, xx = gy[m].astype(int), gx[m].astype(int)
        out[yy, xx] = c
        baked[yy, xx] = True

    # il secondo giro si ripiega sul primo
    fold = baked[:, W:]
    img = out[:, :W].copy()
    done = baked[:, :W].copy()
    img[fold] = out[:, W:][fold]
    done |= fold
    # colore allargato sui pixel non usati (niente cuciture con le mipmap)
    for _ in range(12):
        acc = np.zeros_like(img)
        cnt = np.zeros(done.shape)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                acc += np.roll(np.roll(img * done[..., None], dy, 0), dx, 1)
                cnt += np.roll(np.roll(done, dy, 0), dx, 1)
        grow = (~done) & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow][:, None]
        done |= grow
    Image.fromarray(np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8)).save(out_path, quality=90, optimize=True)
    lin = np.power(skin_mean, 2.2)
    print("pelle del viso (lineare)", lin.round(4).tolist(), "scritto", out_path)
    if len(sys.argv) > 5:
        import json

        jp = sys.argv[5]
        j = json.load(open(jp))
        j["faceSkin"] = [round(float(x), 4) for x in lin]
        json.dump(j, open(jp, "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
