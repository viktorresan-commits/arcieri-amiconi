/**
 * Il programma di esercizi come PDF da stampare in bianco e nero: in alto i dati dell'allievo
 * (scritti o da compilare a penna), poi una casella per categoria con esercizio, come si fa,
 * quanto, difficoltà (pallini) e i quadratini dei giorni da segnare con una X.
 */
import { LEVEL_NAME, type ExProgram, type Level } from "./exercise-catalog";
import { Pdf } from "./pdf-writer";

const M = 30; // margini
const DAYS = ["L", "M", "M", "G", "V", "S", "D"];

function dots(pdf: Pdf, x: number, y: number, level: Level, r = 3.1) {
  for (let i = 0; i < 3; i++) pdf.circle(x + i * (r * 2 + 3), y, r, { fill: i < level, lw: 0.8 });
}

export function programPdf(p: ExProgram): Uint8Array {
  const pdf = new Pdf();
  const W = pdf.W;
  const inner = W - M * 2;
  let y = M;

  // ---------- intestazione ----------
  pdf.text(M, y + 16, "PROGRAMMA DI ALLENAMENTO", 18, { bold: true });
  pdf.text(M, y + 30, p.title && p.title !== "Programma di allenamento" ? p.title : "Tiro con l'arco · esercizi per la settimana", 9, { gray: 0.3 });
  pdf.text(W - M, y + 14, `Livello: ${LEVEL_NAME[p.level]}`, 11, { bold: true, align: "right" });
  dots(pdf, W - M - 27, y + 25, p.level, 3.6);
  y += 42;

  // dati dell'allievo: scritti, oppure una riga punteggiata da compilare a penna
  const cell = (x: number, yy: number, w: number, h: number, label: string, value: string) => {
    pdf.rect(x, yy, w, h, { stroke: 0, lw: 0.7 });
    pdf.text(x + 5, yy + 9, label.toUpperCase(), 6.5, { bold: true, gray: 0.35 });
    if (value) {
      const v = pdf.wrap(value, 11, w - 10, true)[0];
      pdf.text(x + 5, yy + h - 6, v, 11, { bold: true });
    } else pdf.line(x + 5, yy + h - 5, x + w - 5, yy + h - 5, { lw: 0.5, gray: 0.45, dash: [1, 2] });
  };
  const h1 = 27;
  const a = inner * 0.68;
  const h = p.header;
  cell(M, y, a, h1, "Nome e cognome", h.athlete);
  cell(M + a, y, inner - a, h1, "Età", h.age);
  y += h1;
  cell(M, y, a, h1, "Compagnia", h.company);
  cell(M + a, y, inner - a, h1, "Arco", h.bow);
  y += h1;
  cell(M, y, a, h1, "Allenatore", h.coach);
  cell(M + a, y, inner - a, h1, "Periodo", h.from || h.to ? `dal ${h.from || "…"} al ${h.to || "…"}` : "");
  y += h1;
  cell(M, y, inner, h1, "Quando mi alleno", h.days);
  y += h1;
  cell(M, y, inner, h1, "Il mio obiettivo", h.goal);
  y += h1 + 10;

  // come si usa
  const howH = 50;
  pdf.rect(M, y, inner, howH, { fill: 0.93 });
  pdf.text(M + 8, y + 13, "COME SI USA", 8, { bold: true });
  const steps = ["Fai gli esercizi dall'alto in basso, una casella dopo l'altra.", "Finito un esercizio, fai una X nel quadratino del giorno.", "Fatica sì, dolore no: se qualcosa fa male fermati e dillo all'allenatore."];
  steps.forEach((s, i) => pdf.text(M + 8, y + 25 + i * 10, `${i + 1}.  ${s}`, 8.5));
  const lx = W - M - 128;
  pdf.text(lx, y + 13, "DIFFICOLTÀ", 8, { bold: true });
  ([[1, "facile"], [2, "media"], [3, "difficile"]] as const).forEach(([lv, t], i) => {
    dots(pdf, lx + 4, y + 22 + i * 10, lv, 2.6);
    pdf.text(lx + 30, y + 25 + i * 10, t, 8.5);
  });
  y += howH + 12;

  // ---------- caselle per categoria ----------
  const cDays = 7 * 14;
  const cDiff = 42;
  const cDose = 82;
  const cCode = 30;
  const cName = inner - cDays - cDiff - cDose - cCode;
  const xCode = M;
  const xName = xCode + cCode;
  const xDose = xName + cName;
  const xDiff = xDose + cDose;
  const xDays = xDiff + cDiff;
  const bottom = pdf.H - M - 18;

  const colHead = () => {
    pdf.rect(M, y, inner, 13, { fill: 0.96, stroke: 0, lw: 0.5 });
    pdf.text(xCode + 4, y + 9.2, "N.", 6.5, { bold: true, gray: 0.3 });
    pdf.text(xName + 4, y + 9.2, "ESERCIZIO · COME SI FA", 6.5, { bold: true, gray: 0.3 });
    pdf.text(xDose + 4, y + 9.2, "QUANTO", 6.5, { bold: true, gray: 0.3 });
    pdf.text(xDiff + 4, y + 9.2, "DIFF.", 6.5, { bold: true, gray: 0.3 });
    DAYS.forEach((d, i) => pdf.text(xDays + i * 14 + 7, y + 9.2, d, 6.5, { bold: true, gray: 0.3, align: "center" }));
    y += 13;
  };

  p.sections.forEach((s, si) => {
    const rows = s.items.map((it) => {
      const how = pdf.wrap(it.how, 8, cName - 8);
      const dose = pdf.wrap(it.dose, 8.5, cDose - 8, true);
      return { it, how, dose, h: Math.max(26, 15 + how.length * 9.6, 9 + dose.length * 10.5) };
    });
    // titolo + intestazione + prima riga devono stare insieme
    if (y + 20 + 13 + (rows[0]?.h ?? 0) > bottom) {
      pdf.addPage();
      y = M;
    }
    pdf.rect(M, y, inner, 20, { fill: 0.84, stroke: 0, lw: 0.8 });
    pdf.text(M + 7, y + 14, `${si + 1}`, 12, { bold: true });
    pdf.text(M + 24, y + 14, s.title.toUpperCase(), 11, { bold: true });
    if (s.hint) pdf.text(W - M - 7, y + 13.5, s.hint, 8, { gray: 0.2, align: "right" });
    y += 20;
    colHead();
    for (const r of rows) {
      if (y + r.h > bottom) {
        pdf.addPage();
        y = M;
        pdf.text(M, y + 10, `${si + 1}. ${s.title} (continua)`, 9, { bold: true });
        y += 16;
        colHead();
      }
      pdf.rect(M, y, inner, r.h, { stroke: 0, lw: 0.6 });
      for (const x of [xName, xDose, xDiff, xDays]) pdf.line(x, y, x, y + r.h, { lw: 0.4, gray: 0.55 });
      pdf.text(xCode + cCode / 2, y + 12, r.it.code, 7.5, { bold: true, align: "center" });
      pdf.text(xName + 4, y + 11.5, r.it.name, 10, { bold: true });
      r.how.forEach((l, i) => pdf.text(xName + 4, y + 22 + i * 9.6, l, 8, { gray: 0.15 }));
      r.dose.forEach((l, i) => pdf.text(xDose + 4, y + 12 + i * 10.5, l, 8.5, { bold: true }));
      dots(pdf, xDiff + 9, y + r.h / 2, r.it.level, 3);
      for (let i = 0; i < 7; i++) pdf.rect(xDays + i * 14 + 2.5, y + r.h / 2 - 4.5, 9, 9, { stroke: 0, lw: 0.6 });
      y += r.h;
    }
    y += 10;
  });

  // ---------- com'è andata, note, firme ----------
  const endH = 120;
  if (y + endH > bottom) {
    pdf.addPage();
    y = M;
  }
  pdf.rect(M, y, inner, 30, { stroke: 0, lw: 0.7 });
  pdf.text(M + 6, y + 11, "COM'È ANDATA LA SETTIMANA? (fai un cerchio)", 7, { bold: true, gray: 0.3 });
  const moods = ["Benissimo", "Bene", "Così così", "Che fatica"];
  moods.forEach((m, i) => pdf.text(M + 14 + i * (inner / 4), y + 24, m, 10.5, { bold: true }));
  y += 38;
  const noteH = 54;
  pdf.rect(M, y, inner, noteH, { stroke: 0, lw: 0.7 });
  pdf.text(M + 6, y + 11, "NOTE DELL'ALLENATORE", 7, { bold: true, gray: 0.3 });
  if (p.notes) pdf.wrap(p.notes, 9.5, inner - 14).slice(0, 4).forEach((l, i) => pdf.text(M + 6, y + 24 + i * 11, l, 9.5));
  else for (let i = 0; i < 3; i++) pdf.line(M + 6, y + 26 + i * 11, W - M - 6, y + 26 + i * 11, { lw: 0.4, gray: 0.55, dash: [1, 2] });
  y += noteH + 16;
  pdf.line(M, y + 6, M + inner * 0.4, y + 6, { lw: 0.5 });
  pdf.text(M, y + 15, "Firma dell'allenatore", 7.5, { gray: 0.3 });
  pdf.line(W - M - inner * 0.4, y + 6, W - M, y + 6, { lw: 0.5 });
  pdf.text(W - M - inner * 0.4, y + 15, "Firma dell'allievo (o di un genitore)", 7.5, { gray: 0.3 });

  // piè di pagina
  const n = pdf.pageCount;
  for (let i = 0; i < n; i++) {
    pdf.onPage(i, () => {
      pdf.line(M, pdf.H - M - 8, W - M, pdf.H - M - 8, { lw: 0.4, gray: 0.6 });
      pdf.text(M, pdf.H - M, `Arcieri Amiconi · ${h.athlete || "Programma di allenamento"} · livello ${LEVEL_NAME[p.level].toLowerCase()}`, 7, { gray: 0.35 });
      pdf.text(W - M, pdf.H - M, `Pagina ${i + 1} di ${n}`, 7, { gray: 0.35, align: "right" });
    });
  }
  return pdf.bytes(`Programma di allenamento${h.athlete ? ` · ${h.athlete}` : ""}`);
}

export function programFileName(p: ExProgram) {
  const who = (p.header.athlete || "allievo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `programma-${who || "allievo"}-${LEVEL_NAME[p.level].toLowerCase()}.pdf`;
}
