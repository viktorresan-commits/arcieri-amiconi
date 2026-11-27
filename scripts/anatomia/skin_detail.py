"""
Dettaglio della pelle vera: dalle mappe del pacchetto "avatar_skin_package_full" (albedo, normal e
roughness senza giunte, 1408 px) due trame piccole che si ripetono sulla pelle del personaggio:

  public/anatomia/pelle-dettaglio.jpg  R = luminanza (0,5 neutra), G = ruvidità (0,5 media), B = rossore
  public/anatomia/pelle-normali.jpg    la normal map (OpenGL, Y in su)

Del colore resta solo la grana fine (pori, lentiggini, macchie): il tono lo sceglie l'arciere.
Le ombre larghe della foto si tolgono con una sfocatura che si richiude sui bordi (la trama si ripete),
poi i bordi si ricuciono con la stessa trama spostata di mezzo lato.

Uso: python3 scripts/anatomia/skin_detail.py <cartella del pacchetto> [uscita]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 512


def blur_wrap(a: np.ndarray, sigma: float) -> np.ndarray:
    """sfocatura gaussiana con i bordi che si richiudono (FFT)"""
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def seam(a: np.ndarray) -> np.ndarray:
    """ricuce i bordi, un asse alla volta: al centro la trama com'è, verso i bordi la stessa trama
    spostata di mezzo lato (la sua giunta cade al centro, dove non si usa)"""
    for ax in (1, 0):
        n = a.shape[ax]
        t = np.abs(np.linspace(-1, 1, n))
        m = np.clip((1 - t) / 0.3, 0, 1)
        m = m * m * (3 - 2 * m)
        m = m[None, :] if ax == 1 else m[:, None]
        if a.ndim == 3:
            m = m[..., None]
        a = a * m + np.roll(a, n // 2, ax) * (1 - m)
    return a


def load(p: Path) -> np.ndarray:
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float64) / 255.0


def main() -> None:
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/anatomia")
    alb = load(src / "01_albedo_seamless_body.jpg")
    nrm = load(src / "04_normal_seamless.jpg")
    rgh = load(src / "06_roughness_seamless.jpg")[..., 0]

    lum = alb @ np.array([0.2126, 0.7152, 0.0722])
    hp = lum / np.maximum(blur_wrap(lum, 40), 1e-3)  # solo la grana: 1 = neutro
    red = (alb[..., 0] - alb[..., 2]) / np.maximum(lum, 1e-3)
    redhp = red - blur_wrap(red, 40)
    rhp = rgh - blur_wrap(rgh, 60)

    det = np.stack(
        [
            np.clip(0.5 + (hp - 1) * 2.5, 0, 1),
            np.clip(0.5 + rhp * 3.0, 0, 1),
            np.clip(0.5 + redhp * 2.0, 0, 1),
        ],
        -1,
    )
    det = seam(det)
    n = seam(nrm * 2 - 1)
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)

    out.mkdir(parents=True, exist_ok=True)
    for arr, name in ((det, "pelle-dettaglio.jpg"), (n * 0.5 + 0.5, "pelle-normali.jpg")):
        im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)).resize((SIZE, SIZE), Image.LANCZOS)
        im.save(out / name, quality=86, optimize=True)
        print(name, im.size, (out / name).stat().st_size, "byte")


if __name__ == "__main__":
    main()
