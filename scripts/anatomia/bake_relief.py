"""
Rilievo della pelle vera dalle tavole di riferimento dell'avatar (normal map di corpo e braccia, viste di fronte e
di schiena): addominali, pettorali, dorsali, glutei, ginocchia, polpacci, vene delle braccia.

Della normal map delle tavole resta solo il dettaglio fine (sottratta la forma larga, che è già quella della pelle
dell'atlante); ogni punto della pelle a riposo si porta sulla tavola riga per riga (punti di riferimento in altezza:
spalle, capezzoli, ombelico, inguine, ginocchia, caviglie; in larghezza la sagoma della tavola contro quella della
pelle). Il dettaglio si scrive nello spazio tangente delle uv del corpo (gradienti di u e v, come nell'app):
pelle-rilievo.jpg, r = lungo u, g = lungo v (0,5 = niente). Il colore resta il tono di pelle scelto.

Uso: python3 scripts/anatomia/bake_relief.py <pelle.body.npz> <tavola normal map> <pelle-rilievo.jpg> [pelle.json]
(con pelle.json vi segna "relief": l'app carica pelle-rilievo.jpg)
"""
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_erosion, gaussian_filter, map_coordinates

SIZE = 2048
BG = np.array([125, 131, 253]) / 255.0
# viste della tavola: colonne, parti della pelle (0 busto, 1 braccio sinistro, 2 braccio destro, 3 e 4 gambe),
# verso della vista (+1 di fronte, -1 di schiena), specchio orizzontale, punti in altezza (metri -> riga)
FRONT_Y = [(1.52, 5), (1.43, 48), (1.28, 155), (1.07, 265), (0.83, 383), (0.49, 525), (0.08, 700), (0.0, 760)]
BACK_Y = [(1.52, 10), (1.40, 75), (1.10, 250), (1.00, 300), (0.80, 395), (0.49, 520), (0.38, 610), (0.08, 700), (0.0, 760)]
ARM_Y = [(1.44, 165), (1.124, 287), (0.892, 440), (0.79, 555)]
VIEWS = [
    dict(cols=(220, 450), parts=(0, 3, 4), dir=1, mirror=False, ys=FRONT_Y),
    dict(cols=(955, 1185), parts=(0, 3, 4), dir=-1, mirror=False, ys=BACK_Y),
    # braccio destro (x < 0): davanti col palmo (pollice a sinistra nella tavola), dietro col dorso
    dict(cols=(100, 200), parts=(2,), dir=1, mirror=False, ys=ARM_Y),
    dict(cols=(0, 100), parts=(2,), dir=-1, mirror=False, ys=ARM_Y),
    # braccio sinistro: davanti lo stesso palmo specchiato, dietro col dorso
    dict(cols=(1198, 1300), parts=(1,), dir=1, mirror=True, ys=ARM_Y),
    dict(cols=(1300, 1408), parts=(1,), dir=-1, mirror=False, ys=ARM_Y),
]


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def spans(row_mask):
    """tratti pieni di una riga: [(inizio, fine)]"""
    d = np.diff(np.concatenate([[0], row_mask.astype(np.int8), [0]]))
    a = np.nonzero(d == 1)[0]
    b = np.nonzero(d == -1)[0]
    return [(int(x), int(y)) for x, y in zip(a, b) if y - x >= 3]


def raster_mask(P2, T, x0, x1, y0, y1, ppm):
    W, H = int((x1 - x0) * ppm), int((y1 - y0) * ppm)
    im = Image.new("1", (W, H), 0)
    dr = ImageDraw.Draw(im)
    px = (P2[:, 0] - x0) * ppm
    py = (y1 - P2[:, 1]) * ppm
    for t in T:
        dr.polygon([(px[i], py[i]) for i in t], fill=1)
    return np.asarray(im)


def main():
    body_path, sheet_path, out_path = sys.argv[1:4]
    B = np.load(body_path)
    pos, nrm, uv, tri, part = B["pos"], B["nrm"], B["uv"], B["tri"], B["part"]
    sheet = np.asarray(Image.open(sheet_path).convert("RGB")).astype(np.float64) / 255
    SH, SW = sheet.shape[:2]
    fg = np.linalg.norm(sheet - BG, axis=2) > 0.11
    fg = binary_erosion(fg, iterations=1)
    n = sheet * 2 - 1
    n /= np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-6)
    # solo il dettaglio fine: normale meno la sua media (pesata sulla sagoma)
    m = fg.astype(np.float64)
    bl = np.stack([gaussian_filter(n[..., c] * m, 5) for c in range(3)], 2) / np.maximum(gaussian_filter(m, 5), 1e-3)[..., None]
    # ai bordi della sagoma la media è falsata: lì il dettaglio si spegne
    from scipy.ndimage import distance_transform_edt

    hp = (n - bl) * smoothstep(3, 12, distance_transform_edt(fg))[..., None]
    print("dettaglio della tavola (deviazione media)", round(float(np.abs(hp[fg]).mean()), 3))

    # sagome della pelle per ogni vista (riga per riga, in metri)
    PPM = 500.0
    X0, X1, Y0, Y1 = -0.45, 0.45, -0.02, 1.62
    tparts = part[tri]
    for v in VIEWS:
        sel = tri[np.all(np.isin(tparts, v["parts"]), 1)]
        P2 = np.stack([pos[:, 0] * v["dir"], pos[:, 1]], 1)
        v["mask"] = raster_mask(P2, sel, X0, X1, Y0, Y1, PPM)
        c0, c1 = v["cols"]
        v["sheet"] = fg[:, c0:c1]

    # tabelle per riga: per la pelle, a ogni pixel il tratto più vicino; per la tavola, i tratti
    for v in VIEWS:
        mk = v["mask"]
        Hm, Wm = mk.shape
        s0 = np.zeros((Hm, Wm))
        s1 = np.zeros((Hm, Wm))
        si = np.full((Hm, Wm), -1)
        cnt = np.zeros(Hm, int)
        lo = np.zeros(Hm)
        hi = np.zeros(Hm)
        xs = np.arange(Wm)
        for r in range(Hm):
            a = spans(mk[r])
            cnt[r] = len(a)
            if not a:
                continue
            lo[r], hi[r] = a[0][0], a[-1][1]
            dist = np.stack([np.where((xs >= x0) & (xs <= x1), 0, np.minimum(np.abs(xs - x0), np.abs(xs - x1))) for x0, x1 in a])
            k = np.argmin(dist, 0)
            si[r] = k
            s0[r] = np.array([x0 for x0, _ in a])[k]
            s1[r] = np.array([x1 for _, x1 in a])[k]
        v["lut"] = (s0, s1, si, cnt, lo, hi)
        sh = v["sheet"]
        K = 4
        t0 = np.zeros((SH, K))
        t1 = np.zeros((SH, K))
        tc = np.zeros(SH, int)
        for r in range(SH):
            b = spans(sh[r])[:K]
            tc[r] = len(b)
            for k, (x0, x1) in enumerate(b):
                t0[r, k], t1[r, k] = x0, x1
        v["tab"] = (t0, t1, tc)

    def sheet_xy(v, sx, y):
        """punti della pelle (x di schermo, y) -> (riga, colonna) nella tavola"""
        ys = np.array([a for a, _ in v["ys"]])[::-1]
        rs = np.array([b for _, b in v["ys"]])[::-1]
        row = np.interp(y, ys, rs)
        s0, s1, si, cnt, lo, hi = v["lut"]
        t0, t1, tc = v["tab"]
        my = np.clip(((Y1 - y) * PPM).astype(int), 0, s0.shape[0] - 1)
        mx = (sx - X0) * PPM
        mxi = np.clip(mx.astype(int), 0, s0.shape[1] - 1)
        sr = np.clip(np.round(row).astype(int), 0, SH - 1)
        n_a = cnt[my]
        n_b = tc[sr]
        same = (n_a == n_b) & (n_a > 0) & (si[my, mxi] >= 0)
        k = np.clip(si[my, mxi], 0, 3)
        a0 = np.where(same, s0[my, mxi], lo[my])
        a1 = np.where(same, s1[my, mxi], hi[my])
        last = np.clip(n_b - 1, 0, 3)
        b0 = np.where(same, t0[sr, k], t0[sr, 0])
        b1 = np.where(same, t1[sr, k], t1[sr, last])
        f = np.clip((mx - a0) / np.maximum(1, a1 - a0), 0, 1)
        if v["mirror"]:
            f = 1 - f
        col = v["cols"][0] + b0 + f * (b1 - b0)
        col[(n_a == 0) | (n_b == 0)] = np.nan
        return row, col

    img = np.full((SIZE, SIZE, 3), 0.5)
    done = np.zeros((SIZE, SIZE), bool)
    UVp = uv * SIZE
    sel_t = np.nonzero(np.isin(tparts, (0, 1, 2, 3, 4)).all(1))[0]
    print("triangoli con rilievo", len(sel_t))
    for ti in sel_t:
        t = tri[ti]
        u = UVp[t]
        minx, maxx = int(max(0, np.floor(u[:, 0].min()))), int(min(SIZE - 1, np.ceil(u[:, 0].max())))
        miny, maxy = int(max(0, np.floor(u[:, 1].min()))), int(min(SIZE - 1, np.ceil(u[:, 1].max())))
        if minx > maxx or miny > maxy:
            continue
        gx, gy = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
        d = (u[1, 1] - u[2, 1]) * (u[0, 0] - u[2, 0]) + (u[2, 0] - u[1, 0]) * (u[0, 1] - u[2, 1])
        if abs(d) < 1e-12:
            continue
        l0 = ((u[1, 1] - u[2, 1]) * (gx - u[2, 0]) + (u[2, 0] - u[1, 0]) * (gy - u[2, 1])) / d
        l1 = ((u[2, 1] - u[0, 1]) * (gx - u[2, 0]) + (u[0, 0] - u[2, 0]) * (gy - u[2, 1])) / d
        l2 = 1 - l0 - l1
        mm = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
        if not mm.any():
            continue
        L = np.stack([l0[mm], l1[mm], l2[mm]], 1)
        P = L @ pos[t]
        N = L @ nrm[t]
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
        # gradienti di u e v sul triangolo (come la base tangente dell'app)
        e1, e2 = pos[t[1]] - pos[t[0]], pos[t[2]] - pos[t[0]]
        fn = np.cross(e1, e2)
        f2 = max(float(fn @ fn), 1e-18)
        uu, vv = uv[t, 0], uv[t, 1]
        gu = ((uu[1] - uu[0]) * np.cross(e2, fn) + (uu[2] - uu[0]) * np.cross(fn, e1)) / f2
        gv = ((vv[1] - vv[0]) * np.cross(e2, fn) + (vv[2] - vv[0]) * np.cross(fn, e1)) / f2
        gu /= max(np.linalg.norm(gu), 1e-12)
        gv /= max(np.linalg.norm(gv), 1e-12)
        pt = int(np.bincount(part[t]).argmax())
        acc = np.zeros((len(P), 3))
        wsum = np.zeros(len(P))
        for v in VIEWS:
            if pt not in v["parts"]:
                continue
            w = smoothstep(0.12, 0.5, N[:, 2] * v["dir"])
            if not (w > 0).any():
                continue
            row, col = sheet_xy(v, P[:, 0] * v["dir"], P[:, 1])
            ok = np.isfinite(col)
            if not ok.any():
                continue
            s = np.zeros((len(P), 3))
            for c in range(3):
                s[ok, c] = map_coordinates(hp[..., c], [row[ok], col[ok]], order=1, mode="constant")
            if v["mirror"]:
                s[:, 0] = -s[:, 0]
            # dalla vista al mondo: di schiena x e z si rovesciano
            s[:, 0] *= v["dir"]
            s[:, 2] *= v["dir"]
            acc += s * (w * ok)[:, None]
            wsum += w * ok
        dvec = acc / np.maximum(wsum, 1.0)[:, None]
        tu = dvec @ gu
        tv = dvec @ gv
        yy, xx = gy[mm].astype(int), gx[mm].astype(int)
        img[yy, xx, 0] = 0.5 + 0.5 * np.clip(tu * 1.6, -1, 1)
        img[yy, xx, 1] = 0.5 + 0.5 * np.clip(tv * 1.6, -1, 1)
        done[yy, xx] = True
    # colore allargato sui pixel liberi (niente cuciture con le mipmap)
    for _ in range(6):
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
    print("scritto", out_path)
    if len(sys.argv) > 4:
        import json

        j = json.load(open(sys.argv[4]))
        j["relief"] = True
        json.dump(j, open(sys.argv[4], "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
