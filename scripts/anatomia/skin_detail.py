"""
Dettaglio della pelle vera: dalle mappe del pacchetto "avatar_skin_package_full" (albedo, normal e
roughness senza giunte, 1408 px) due trame piccole che si ripetono sulla pelle del personaggio:

  public/anatomia/pelle-dettaglio.jpg  R = luminanza (0,5 neutra), G = ruvidità (0,5 media), B = rossore
  public/anatomia/pelle-normali.jpg    la normal map (OpenGL, Y in su)

Del colore resta solo la grana fine (pori, lentiggini, macchie): il tono lo sceglie l'arciere.
Le ombre larghe della foto si tolgono con una sfocatura che si richiude sui bordi (la trama si ripete),
poi i bordi si ricuciono con la stessa trama spostata di mezzo lato.

Oppure dal file .glb di "Human Materials 1 (CC0)" di britdawgmasterfunk su Sketchfab (materiale "Material",
pelle senza giunte 2048 px: colore, roughness nel canale G, normal map OpenGL): uscita a 1024 px.

Uso: python3 scripts/anatomia/skin_detail.py <cartella del pacchetto | file .glb> [uscita]
"""
import io
import json
import struct
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


def glb_maps(p: Path, material: str = "Material"):
    """colore, normal map e roughness di un materiale dentro un .glb (immagini incorporate)"""
    b = p.read_bytes()
    off, js, binary = 12, None, b""
    while off < len(b):
        n, kind = struct.unpack("<II", b[off : off + 8])
        chunk = b[off + 8 : off + 8 + n]
        if kind == 0x4E4F534A:
            js = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        off += 8 + n
    mat = next(m for m in js["materials"] if m.get("name") == material)

    def tex(i: int) -> np.ndarray:
        im = js["images"][js["textures"][i]["source"]]
        bv = js["bufferViews"][im["bufferView"]]
        o = bv.get("byteOffset", 0)
        return np.asarray(Image.open(io.BytesIO(binary[o : o + bv["byteLength"]])).convert("RGB")).astype(np.float64) / 255.0

    pbr = mat["pbrMetallicRoughness"]
    alb = tex(pbr["baseColorTexture"]["index"])
    nrm = tex(mat["normalTexture"]["index"])
    rgh = tex(pbr["metallicRoughnessTexture"]["index"])[..., 1]  # glTF: roughness nel verde
    return alb, nrm, rgh


def main() -> None:
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/anatomia")
    size = SIZE
    # quanto contano luce, ruvidità e rossore della grana (la pelle della foto glb è più contrastata)
    gain = (2.5, 3.0, 2.0)
    if src.suffix.lower() == ".glb":
        alb, nrm, rgh = glb_maps(src)
        size = 1024
        gain = (2.2, 1.9, 1.4)
    else:
        alb = load(src / "01_albedo_seamless_body.jpg")
        nrm = load(src / "04_normal_seamless.jpg")
        rgh = load(src / "06_roughness_seamless.jpg")[..., 0]
    # le sfocature valgono per 1408 px: si scalano con la trama. Per il glb solo la grana dei pori: le macchie
    # larghe del colore, ripetute sulla pelle, sembravano sporco
    k = alb.shape[0] / 1408
    sg = 40 * k if src.suffix.lower() != ".glb" else 12 * k

    lum = alb @ np.array([0.2126, 0.7152, 0.0722])
    hp = lum / np.maximum(blur_wrap(lum, sg), 1e-3)  # solo la grana: 1 = neutro
    red = (alb[..., 0] - alb[..., 2]) / np.maximum(lum, 1e-3)
    redhp = red - blur_wrap(red, sg)
    rhp = rgh - blur_wrap(rgh, 60 * k)

    det = np.stack(
        [
            np.clip(0.5 + (hp - 1) * gain[0], 0, 1),
            np.clip(0.5 + rhp * gain[1], 0, 1),
            np.clip(0.5 + redhp * gain[2], 0, 1),
        ],
        -1,
    )
    det = seam(det)
    n = seam(nrm * 2 - 1)
    # pori un poco più marcati per la pelle del glb (le inclinazioni xy contano di più)
    if src.suffix.lower() == ".glb":
        n[..., :2] *= 1.3
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)

    out.mkdir(parents=True, exist_ok=True)
    for arr, name in ((det, "pelle-dettaglio.jpg"), (n * 0.5 + 0.5, "pelle-normali.jpg")):
        im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
        im.save(out / name, quality=86 if size <= 512 else 80, optimize=True)
        print(name, im.size, (out / name).stat().st_size, "byte")


if __name__ == "__main__":
    main()
