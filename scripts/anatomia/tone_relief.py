"""
Rilievo del corpo più calmo dove la tavola arriva di sbieco. bake_relief.py porta sulla pelle la normal map delle
tavole viste di fronte e di schiena: sui fianchi, sui lati del torace e sotto le braccia la tavola si allunga e il
dettaglio diventa una serie di righe orizzontali (costole e obliqui a strisce, schiena a gradini). Qui il dettaglio
resta pieno dove la pelle guarda davanti o dietro, cala dove guarda di lato, e un filo di sfocatura toglie il
rumore più fine.

Uso: python3 scripts/anatomia/tone_relief.py <pelle.json> <pelle.bin> <pelle-rilievo.jpg> [uscita.jpg] [forza=1]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter


def smoothstep(a: float, b: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def main() -> None:
    js_p, bin_p, img_p = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    out_p = Path(sys.argv[4]) if len(sys.argv) > 4 else img_p
    force = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
    js = json.loads(js_p.read_text())
    raw = bin_p.read_bytes()
    st = js["stride"]
    m = js["meshes"]["corpo"]
    n = m["n"]
    rec = np.frombuffer(raw[m["vOffset"] : m["vOffset"] + n * st], dtype=np.uint8).reshape(n, st)
    pos = rec[:, 0:12].copy().view(np.float32).reshape(n, 3).astype(np.float64)
    nrm = rec[:, 12:15].copy().view(np.int8).astype(np.float64) / 127.0
    uv = rec[:, 15:19].copy().view(np.uint16).reshape(n, 2).astype(np.float64) / 65535.0
    idx = np.frombuffer(raw[m["iOffset"] : m["iOffset"] + m["indices"] * 2], dtype=np.uint16).astype(np.int64)
    hs = m.get("headStart") or len(idx)
    tri = idx[:hs].reshape(-1, 3)

    # normali levigate (sui punti saldati): conta la direzione della superficie, non il dettaglio
    key = np.round(pos * 4000).astype(np.int64)
    _, of = np.unique(key, axis=0, return_inverse=True)
    of = of.reshape(-1)
    W = of.max() + 1
    N = np.zeros((W, 3))
    np.add.at(N, of, nrm)
    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    e = of[e]
    e = e[e[:, 0] != e[:, 1]]
    e = np.unique(np.sort(e, 1), axis=0)
    a, b = e[:, 0], e[:, 1]
    deg = np.maximum(np.bincount(a, minlength=W) + np.bincount(b, minlength=W), 1)
    for _ in range(12):
        acc = np.zeros_like(N)
        np.add.at(acc, a, N[b])
        np.add.at(acc, b, N[a])
        N = 0.5 * N + 0.5 * acc / deg[:, None]
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    facing = smoothstep(0.3, 0.72, np.abs(N[of][:, 2]))

    im = Image.open(img_p).convert("RGB")
    S = im.size[0]
    mask = Image.new("F", im.size, 1.0)
    dr = ImageDraw.Draw(mask)
    UV = uv * S
    for t in tri:
        p = UV[t]
        if np.abs(p[:, 0].max() - p[:, 0].min()) > S * 0.25 or np.abs(p[:, 1].max() - p[:, 1].min()) > S * 0.25:
            continue
        dr.polygon([tuple(q) for q in p], fill=float(facing[t].mean()))
    k = gaussian_filter(np.asarray(mask, dtype=np.float64), 6.0)

    a_img = np.asarray(im).astype(np.float64) / 255.0
    rg = a_img[..., :2] - 0.5
    rg = np.stack([gaussian_filter(rg[..., c], 1.1) for c in range(2)], -1)
    rg *= (k * force)[..., None]
    out = a_img.copy()
    out[..., :2] = 0.5 + rg
    Image.fromarray(np.round(np.clip(out, 0, 1) * 255).astype(np.uint8)).save(out_p, quality=92)
    print(f"rilievo: pieno su {np.mean(k > 0.9) * 100:.0f} % dell'immagine, scritto {out_p}")


if __name__ == "__main__":
    main()
