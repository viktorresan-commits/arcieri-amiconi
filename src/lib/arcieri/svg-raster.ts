/**
 * Dai disegni SVG dell'app (arciere, scena) a un'immagine da disegnare su un canvas: per le storie da
 * condividere (foto e video). Le immagini dentro l'SVG (sfondi dipinti) diventano dati incorporati, così
 * il disegno resta intero anche fuori dalla pagina e il canvas si può esportare.
 */

const inlined = new Map<string, Promise<string>>();

function dataUrl(src: string) {
  let p = inlined.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("immagine"))))
      .then(
        (b) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = () => reject(new Error("immagine"));
            fr.readAsDataURL(b);
          }),
      )
      .catch(() => "");
    inlined.set(src, p);
  }
  return p;
}

/** l'SVG come testo, con larghezza e altezza date e le immagini incorporate */
export async function svgText(svg: SVGSVGElement, w: number, h: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  for (const img of Array.from(clone.querySelectorAll("image"))) {
    const href = img.getAttribute("href") ?? img.getAttribute("xlink:href") ?? "";
    if (!href || href.startsWith("data:")) continue;
    const data = await dataUrl(new URL(href, window.location.href).toString());
    if (data) img.setAttribute("href", data);
    else img.remove();
  }
  return new XMLSerializer().serializeToString(clone);
}

/** l'SVG pronto da disegnare (drawImage) */
export async function svgImage(svg: SVGSVGElement, w: number, h: number): Promise<HTMLImageElement> {
  const text = await svgText(svg, w, h);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Disegno non pronto."));
      img.src = url;
    });
    return img;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
