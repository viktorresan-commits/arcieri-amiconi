/**
 * Dal simulatore di volo alla scena del tiro in 3D (arciere animato, paglione e frecce vere): distanza,
 * visuale, volo della freccia pulita, frecce della volée simulata e aspetto dell'arciere dall'avatar.
 * La scena è la pagina 3D dell'app (public/prova3d) in modalità «tiro».
 */
import { goldOf, type describeRound, type FlightInput } from "./flight";
import type { AvatarLook } from "./avatar";

type Round = ReturnType<typeof describeRound>;

export type TiroLook = { sex: "m" | "f"; skin: string; hairColor: string; hair: string; beard: string; shirt: string; pants: string };
export type TiroCfg = {
  /** distanza del paglione (m), raggio della visuale (m), altezza del centro (m) */
  D: number;
  R: number;
  gold: number;
  /** durata del volo (s) e punti del volo: distanza, quota, deriva laterale (+ a destra), tempo */
  T: number;
  path: { x: number; z: number; y: number; t: number }[];
  /** le altre frecce della volée: dove si piantano (o mancate) */
  hits: { y: number; z: number; miss: boolean }[];
  /** cosa dice il cartellino all'arrivo della freccia */
  label: string;
  bow: "longbow" | "recurve";
  look: TiroLook | null;
};

const HAIR: Record<string, string> = {
  corti: "Hair_SimpleParted", spettinati: "Hair_SimpleParted", ciuffo: "Hair_SimpleParted", undercut: "Hair_SimpleParted", frangia: "Hair_SimpleParted", caschetto: "Hair_SimpleParted",
  rasati: "Hair_Buzzed", cresta: "Hair_Buzzed", calvo: "none",
  lunghi: "Hair_Long", "lunghi-mossi": "Hair_Long", mossi: "Hair_Long", ricci: "Hair_Long", afro: "Hair_Long", dread: "Hair_Long", vichinga: "Hair_Long",
  coda: "ponytail", "coda-alta": "ponytail", treccia: "ponytail", trecce: "ponytail", codini: "ponytail",
  chignon: "Hair_Buns", raccolti: "Hair_Buns",
};
const BEARD: Record<string, string> = { nessuna: "none", accenno: "short", corta: "short", barbetta: "short", piena: "full", lunga: "long", pizzetto: "goatee", mosca: "goatee", baffi: "mustache", basette: "sideburns" };

/** l'aspetto dell'arciere 3D preso dall'avatar dell'app */
export function tiroLook(look: AvatarLook | null | undefined): TiroLook | null {
  if (!look) return null;
  const female = look.body === "donna" || look.body === "ragazza";
  return {
    sex: female ? "f" : "m",
    skin: look.skin,
    hairColor: look.hairColor,
    hair: HAIR[look.hair] ?? (female ? "Hair_Long" : "Hair_SimpleParted"),
    beard: female ? "none" : (BEARD[look.beard] ?? "none"),
    shirt: look.shirt,
    pants: look.pants,
  };
}

/** arco del simulatore -> modello 3D: gli archi di legno sono l'arco lungo, gli altri il ricurvo */
export function tiroBow(bowId: string): TiroCfg["bow"] {
  return bowId === "longbow" || bowId === "tradizionale" ? "longbow" : "recurve";
}

export function tiroConfig(input: FlightInput, round: Round, bowId: string, look: AvatarLook | null | undefined): TiroCfg {
  const raw = round.clean.path;
  const T = Math.max(0.05, round.clean.t);
  const every = Math.max(1, Math.ceil(raw.length / 120));
  const pick = raw.filter((_, i) => i % every === 0 || i === raw.length - 1);
  const n = pick.length;
  const path = pick.map((q, i) => ({ x: q.x, z: q.z, y: q.y ?? 0, t: q.t ?? (T * i) / Math.max(1, n - 1) }));
  // l'ultimo punto è proprio sulla linea del paglione, con il tempo di volo intero
  const last = path[n - 1];
  if (last) {
    last.t = T;
    last.y = round.clean.y;
    last.z = round.clean.z;
    last.x = input.distanceM;
  }
  const s = round.scored;
  const label = s.miss ? "Fuori bersaglio" : s.score >= 10 ? "10, centro" : `${s.score} punti`;
  return {
    D: input.distanceM,
    R: input.faceCm / 200,
    gold: goldOf(input),
    T,
    path,
    hits: round.hits.slice(0, 6).map((h) => ({ y: h.y, z: h.z, miss: Boolean(h.miss) })),
    label,
    bow: tiroBow(bowId),
    look: tiroLook(look),
  };
}
