/** Numeri delle frecce dalle schede dell'attrezzatura: "Numerate da" + "Quante" (di base 1–12). */
export function tagsOf(specs: string): number[] {
  let from = 1;
  let qty = 12;
  try {
    const sp = JSON.parse(specs || "{}") as { numFrom?: string; qty?: string };
    const f = parseInt(String(sp.numFrom ?? ""), 10);
    const q = parseInt(String(sp.qty ?? ""), 10);
    if (Number.isFinite(f) && f >= 0) from = f;
    if (Number.isFinite(q) && q > 0) qty = Math.min(q, 36);
  } catch {
    /* schede vecchie: numeri standard */
  }
  return Array.from({ length: qty }, (_, i) => from + i);
}
