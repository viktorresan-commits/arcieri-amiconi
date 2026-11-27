/**
 * Le scale dei premi: ogni famiglia sale a gradini (bronzo, argento, oro, platino, con le stelle in mezzo).
 * Una sola definizione per il server (chi li ha sbloccati) e per i disegni dei premi. Senza rete né database.
 */

export type LadderId = "allenamenti" | "frecce" | "gare" | "podi" | "vittorie" | "piazzole" | "campionato";

export type Ladder = {
  id: LadderId;
  /** quello che si conta, al plurale e al singolare */
  unit: string;
  one: string;
  steps: { code: string; at: number; title: string }[];
};

const steps = (prefix: string, values: number[], title: (n: number) => string, first?: { code: string; title: string }) =>
  values.map((n, i) => (i === 0 && first ? { code: first.code, at: n, title: first.title } : { code: `${prefix}_${n}`, at: n, title: title(n) }));

const it = (n: number) => n.toLocaleString("it-IT");

export const LADDERS: Ladder[] = [
  { id: "allenamenti", unit: "allenamenti", one: "allenamento", steps: steps("sessions", [1, 5, 10, 25, 50, 100, 200, 300, 500, 1000], (n) => `${it(n)} allenamenti`, { code: "first_session", title: "Primo allenamento" }) },
  { id: "frecce", unit: "frecce", one: "freccia", steps: steps("arrows", [100, 500, 1000, 2500, 5000, 10000, 20000, 50000, 100000], (n) => `${it(n)} frecce`) },
  { id: "gare", unit: "gare", one: "gara", steps: steps("gare", [1, 5, 10, 20, 30, 50, 75, 100, 150, 200], (n) => `${it(n)} gare`, { code: "first_comp", title: "Prima gara" }) },
  { id: "podi", unit: "podi", one: "podio", steps: steps("podi", [1, 3, 5, 10, 20, 30, 50, 75, 100], (n) => `${it(n)} podi`, { code: "podi_1", title: "Primo podio" }) },
  { id: "vittorie", unit: "gare vinte", one: "gara vinta", steps: steps("win", [1, 3, 5, 10, 20, 30, 50], (n) => `${it(n)} gare vinte`, { code: "win_1", title: "Prima vittoria" }) },
  { id: "piazzole", unit: "piazzole", one: "piazzola", steps: steps("pz", [100, 250, 500, 1000, 2000, 3000, 5000, 10000], (n) => `${it(n)} piazzole`) },
  { id: "campionato", unit: "punti campionato", one: "punto campionato", steps: steps("champ", [10, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000], (n) => `${it(n)} punti`) },
];

/** i premi che non sono a scala */
export const SINGLE_PRIZES: { code: string; title: string; hint: string }[] = [
  { code: "streak_7", title: "7 giorni di fila", hint: "7 giorni consecutivi" },
  { code: "days_30", title: "30 giorni", hint: "30 giorni diversi" },
  { code: "first_record", title: "Primo record", hint: "Migliori la media" },
  { code: "improve_5", title: "Media in salita", hint: "+5% in 30 giorni" },
];

/** il gradino di un premio a scala: la scala, il posto nella scala (0 = il primo) */
export function ladderOf(code: string): { ladder: Ladder; index: number } | null {
  for (const ladder of LADDERS) {
    const index = ladder.steps.findIndex((s) => s.code === code);
    if (index >= 0) return { ladder, index };
  }
  return null;
}

/** i premi sbloccati con questi numeri */
export function codesFor(n: Record<LadderId, number>): string[] {
  const out: string[] = [];
  for (const ladder of LADDERS) for (const s of ladder.steps) if (n[ladder.id] >= s.at) out.push(s.code);
  return out;
}

/** il prossimo gradino di una scala, se c'è */
export function nextStep(id: LadderId, value: number) {
  const ladder = LADDERS.find((l) => l.id === id);
  return ladder?.steps.find((s) => s.at > value) ?? null;
}

/** elenco dei premi con titolo e indicazione (come li mostra la pagina Obiettivi) */
export function prizeList(): { code: string; title: string; hint: string }[] {
  const ladders = LADDERS.flatMap((l) => l.steps.map((s) => ({ code: s.code, title: s.title, hint: `${it(s.at)} ${s.at === 1 ? l.one : l.unit}` })));
  return [...ladders, ...SINGLE_PRIZES];
}
