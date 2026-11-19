const WIN: Record<string, number> = {
  "À": 192, "È": 200, "É": 201, "Ì": 204, "Ò": 210, "Ù": 217,
  "à": 224, "è": 232, "é": 233, "ì": 236, "ò": 242, "ù": 249,
  "°": 176, "·": 183,
};

function pdfText(s: string) {
  let out = "";
  for (const ch of s) {
    if (ch === "(" || ch === ")" || ch === "\\") {
      out += `\\${ch}`;
      continue;
    }
    const code = WIN[ch] ?? ch.charCodeAt(0);
    if (code >= 32 && code < 127) out += String.fromCharCode(code);
    else if (code >= 128 && code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += "?";
  }
  return out;
}

export function simplePdf(title: string, lines: string[]) {
  const chunks: string[][] = [];
  const body = lines.length ? lines : ["Nessun dato."];
  for (let i = 0; i < body.length; i += 44) chunks.push(body.slice(i, i + 44));
  const fontId = 3 + chunks.length * 2;
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = chunks.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Count ${chunks.length} /Kids [${kids}] >>`);
  chunks.forEach((page, i) => {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    const text = [
      "BT",
      "/F1 16 Tf",
      "48 800 Td",
      `(${pdfText(title)}) Tj`,
      "/F1 10 Tf",
      "0 -26 Td",
      "14 TL",
      ...page.map((line) => `(${pdfText(line.slice(0, 95))}) Tj T*`),
      "ET",
    ].join("\n");
    objects[contentId - 1] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
  });
  objects[fontId - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
