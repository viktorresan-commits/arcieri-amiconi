import { teamKey } from "./fitast-league";

/**
 * Loghi veri delle compagnie FITAST, presi dalle loro pagine (Facebook, Instagram, sito) e ripuliti:
 * stanno in /public/compagnie/fitast. Ogni compagnia si riconosce dalle parole che la distinguono nel
 * nome del portale (una delle alternative basta), così vale anche se il portale scrive il nome un po' diverso.
 */
const STEMMI: { file: string; words: string[][] }[] = [
  { file: "castrum-collis-palumbi", words: [["PALUMBI"], ["COLPALOMBO"]] },
  { file: "arcieri-di-azzolino", words: [["AZZOLINO"], ["GROTTAZZOLINA"]] },
  { file: "castello-di-enna", words: [["ENNA"]] },
  { file: "amalac", words: [["AMALAC"]] },
  { file: "avis-spinetoli-pagliare", words: [["SPINETOLI"], ["PAGLIARE"]] },
  { file: "castrum-firmignani", words: [["FIRMIGNANI"]] },
  { file: "turma-lyncis", words: [["LYNCIS"], ["TURMALYNCIS"]] },
  { file: "arcieri-del-girfalco", words: [["GIRFALCO"]] },
  { file: "arcarius-helvinium", words: [["HELVINIUM"], ["ARCARIUS"]] },
  { file: "la-fenice", words: [["POLISPORTIVA", "FENICE"], ["FENICE", "SPOLETO"]] },
  { file: "arcieri-de-varano", words: [["VARANO"]] },
  { file: "arcieri-di-cornaletto", words: [["CORNALETTO"]] },
  { file: "arcieri-dell-ossaia", words: [["OSSAIA"]] },
  { file: "arcieri-firmum", words: [["FIRMUM"]] },
  { file: "castrum-fossati", words: [["FOSSATI"]] },
  { file: "arcus-tuder", words: [["TUDER"]] },
  { file: "arcieri-dei-nebrodi", words: [["NEBRODI"]] },
];

/** una parola c'è se è intera nel nome; le sigle col punto (A.M.A.L.A.C.) si leggono anche tutte attaccate */
function has(key: string, compact: string, w: string) {
  return key.includes(` ${w} `) || (w.length >= 6 && compact.includes(w));
}

/** il logo vero della compagnia, se lo abbiamo, dal primo nome che lo riconosce */
export function realCrest(...names: (string | null | undefined)[]): string | null {
  for (const n of names) {
    if (!n) continue;
    const key = ` ${teamKey(n)} `;
    const compact = key.replace(/ /g, "");
    const hit = STEMMI.find((s) => s.words.some((set) => set.every((w) => has(key, compact, w))));
    if (hit) return `/compagnie/fitast/${hit.file}.webp`;
  }
  return null;
}

/**
 * Il logo da mostrare: quello caricato dalla compagnia resta; lo stemma disegnato e quello trovato da solo
 * in rete (che poteva essere sbagliato) lasciano il posto al logo vero, se c'è.
 */
export function withRealCrest(logoUrl: string | null | undefined, ...names: (string | null | undefined)[]): string | null {
  const own = logoUrl && !logoUrl.startsWith("data:image/svg+xml") && !logoUrl.startsWith("/api/logo/") ? logoUrl : null;
  return own ?? realCrest(...names) ?? logoUrl ?? null;
}
