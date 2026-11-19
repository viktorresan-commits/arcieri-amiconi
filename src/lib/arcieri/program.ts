export const PROGRAMS = [
  {
    id: "A",
    title: "Precisione",
    ask: "Precisione",
    goal: "Rosata stretta, freccia dopo freccia.",
    points: ["Serie da 3 frecce.", "Concentrazione sul punto di mira.", "Analisi della rosata.", "Ricerca della costanza."],
  },
  {
    id: "B",
    title: "Tecnica",
    ask: "Tecnica di tiro",
    goal: "Il gesto, prima del punteggio.",
    points: ["Apertura e allineamento.", "Stabilità della spalla.", "Ancoraggio costante.", "Rilascio naturale."],
  },
  {
    id: "C",
    title: "Controllo",
    ask: "Concentrazione e controllo",
    goal: "Stesso gesto, stessa testa.",
    points: ["Routine pre-tiro.", "Respirazione e concentrazione.", "Gestione della tensione.", "Continuità del gesto."],
  },
  {
    id: "D",
    title: "Resistenza",
    ask: "Resistenza",
    goal: "La qualità non cala nelle ultime serie.",
    points: ["Attenzione che avanza, frecce che restano.", "Mantenere la qualità tecnica.", "Controllo della fatica.", "Meno errori nelle ultime serie."],
  },
  {
    id: "E",
    title: "Test",
    ask: "Test prestazionale",
    goal: "Un punteggio vero, da confrontare.",
    points: ["Serie a punteggio.", "Registrazione delle rosate.", "Confronto con i risultati precedenti.", "Individuazione delle criticità."],
  },
] as const;

export const BODIES = [
  { id: "fresco", label: "Fresco" },
  { id: "normale", label: "Normale" },
  { id: "affaticato", label: "Affaticato" },
] as const;

export const VOLUMES = [15, 30, 45, 60] as const;

export const DISPERSIONS = ["Stretta", "Aperta", "Alta", "Bassa", "Sinistra", "Destra"] as const;

export const TECH_ERRORS = ["Punto di mira", "Apertura", "Spalla", "Ancoraggio", "Rilascio", "Respiro", "Tensione", "Ultime serie"] as const;

export type ProgramId = (typeof PROGRAMS)[number]["id"];
export type BodyId = (typeof BODIES)[number]["id"];

export function programById(id: string) {
  return PROGRAMS.find((item) => item.id === id) ?? null;
}

export function asProgram(value: string): ProgramId | "" {
  return programById(value) ? (value as ProgramId) : "";
}

export function asBody(value: string): BodyId | "" {
  return BODIES.some((item) => item.id === value) ? (value as BodyId) : "";
}

export function sameVolume(last: number | null): (typeof VOLUMES)[number] {
  if (last === 15 || last === 30 || last === 45 || last === 60) return last;
  return 30;
}

export function liveCue(program: string, body: string, end: number, ends: number) {
  const tired = body === "affaticato";
  const tail = tired ? " Sei affaticato: le frecce restano quelle scelte." : "";
  if (program === "A") return `Tre frecce. Punto di mira, poi la rosata. Cerca la stessa apertura.${tail}`;
  if (program === "B") return `Apertura, spalla, ancoraggio, rilascio. Se un pezzo cede, annotalo. Non compensare con altre frecce.${tail}`;
  if (program === "C") return tired
    ? "Routine, respiro, tensione. Tra una volée e l'altra fermati. Il numero di frecce non cambia."
    : "Prima di ogni freccia: routine, respiro, stessa tensione, stesso gesto.";
  if (program === "D") {
    const third = ends <= 1 ? 2 : end < ends / 3 ? 0 : end < (ends * 2) / 3 ? 1 : 2;
    if (third === 0) return `Prime serie. Imposta il gesto. Il totale frecce resta quello scelto.${tail}`;
    if (third === 1) return `Metà lavoro. Stessa apertura. Non si aggiunge nessuna volée.${tail}`;
    return "Ultime serie. Conta gli errori, non i punti. Se la fatica apre la rosata, chiudi: la sessione non si allunga.";
  }
  if (program === "E") return `Punteggio vero. A fine tiro confronti questa rosata con la precedente, a parità di carico.${tail}`;
  return "";
}

export function volumeHint(chosen: number, lastArrows: number | null, body: string, lastErrors: string) {
  if (body === "affaticato") {
    return lastArrows
      ? `Affaticato. L'ultima volta erano ${lastArrows} frecce. Puoi restare lì o scendere. Da qui non si sale da soli.`
      : "Affaticato. Scegli il volume che reggi oggi. 60 non è il punto di partenza.";
  }
  if (lastArrows && chosen > lastArrows) {
    return `Hai premuto più frecce dell'ultima volta (${lastArrows}). Vale solo perché lo decidi tu.`;
  }
  if (lastArrows && lastErrors) {
    return `Errori dell'ultima volta: ${lastErrors}. Si resta su ${lastArrows} frecce finché il gesto non è pulito.`;
  }
  if (lastArrows) return `Ultima volta ${lastArrows} frecce. Oggi il numero è il tuo: non sale in automatico.`;
  return "30 frecce è un inizio possibile, non un obbligo. Il numero non sale da solo.";
}

export function packMarks(picked: string[], note: string) {
  const chips = picked.join(", ");
  const extra = note.trim();
  if (chips && extra) return `${chips} — ${extra}`;
  return chips || extra;
}

export function unpackMarks(value: string, known: readonly string[]) {
  const [head, ...rest] = value.split(" — ");
  const picked = known.filter((item) => head.split(",").map((part) => part.trim()).includes(item));
  return { picked, note: rest.join(" — ").trim() };
}
