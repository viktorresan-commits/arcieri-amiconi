/**
 * Cosa migliorare, letto da dove finiscono davvero le frecce.
 * Sono indicazioni di massima, come quelle di un istruttore che guarda il bersaglio:
 * la causa vera va cercata sulla linea di tiro.
 */
export type Form = { n: number; placed: number; avg: number; offX: number; offY: number; spread: number; missRate: number };

export type CoachNote = { title: string; tip: string; where: string; tone: "ok" | "warn" | "info" };

/** dove si raccoglie il gruppo, a parole */
export function groupWhere(f: Form) {
  if (f.placed < 6) return "";
  const v = f.offY > 0.15 ? "in basso" : f.offY < -0.15 ? "in alto" : "";
  const h = f.offX > 0.15 ? "a destra" : f.offX < -0.15 ? "a sinistra" : "";
  if (!v && !h) return "al centro";
  return [v, h].filter(Boolean).join(" ");
}

export function coachNotes(f: Form | null | undefined, lefty = false): CoachNote[] {
  if (!f || f.n < 6) {
    return [{ title: "Il tuo arciere aspetta i tuoi dati", tip: "Registra un allenamento: da lì in poi in Home tirerà come tiri tu.", where: "", tone: "info" }];
  }
  const out: CoachNote[] = [];
  const where = groupWhere(f);
  // per un mancino destra e sinistra si scambiano
  const side = lefty ? -f.offX : f.offX;
  if (f.missRate > 0.15) out.push({ title: "Troppe frecce fuori", tip: "Avvicinati di qualche metro finché il gruppo resta tutto sul bersaglio, poi allontanati di nuovo.", where, tone: "warn" });
  if (f.placed >= 6 && f.offY > 0.15) out.push({ title: "Il gruppo scende", tip: "Spesso succede quando si rilassa la trazione o si abbassa l'arco al rilascio: tieni la schiena attiva e accompagna il tiro.", where, tone: "warn" });
  if (f.placed >= 6 && f.offY < -0.15) out.push({ title: "Il gruppo sale", tip: "Controlla che l'ancoraggio sia sempre nello stesso punto e di non alzare la testa durante il rilascio.", where, tone: "warn" });
  if (f.placed >= 6 && side < -0.15) out.push({ title: `Le frecce vanno ${f.offX < 0 ? "a sinistra" : "a destra"}`, tip: "Spesso è un rilascio che strappa: lascia le dita morbide e fai uscire la corda da sola.", where, tone: "warn" });
  if (f.placed >= 6 && side > 0.15) out.push({ title: `Le frecce vanno ${f.offX < 0 ? "a sinistra" : "a destra"}`, tip: "Spesso è la mano dell'arco che stringe o spinge di lato: tienila rilassata e lascia lavorare l'arco.", where, tone: "warn" });
  if (f.spread > 0.45) out.push({ title: "Gruppo largo", tip: "Lavora sulla costanza: la stessa routine a ogni freccia, con gli stessi tempi.", where, tone: "warn" });
  if (!out.length) out.push({ title: f.avg >= 8 ? "Gruppo stretto e centrato" : "Gruppo in ordine", tip: f.avg >= 8 ? "Ottimo lavoro: prova una distanza più lunga o un bersaglio più piccolo." : "Le frecce sono ben raccolte: ora punta a stringere ancora il gruppo.", where, tone: "ok" });
  return out;
}

/** stima di una volée da 3 frecce, in decimi del bersaglio */
export function volleyEstimate(f: Form | null | undefined) {
  if (!f || f.n < 6) return null;
  return Math.round(f.avg * 3);
}
