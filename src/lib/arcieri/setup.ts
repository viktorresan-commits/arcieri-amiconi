import { useMainGear } from "./main-gear";
import { grainsFor, realLb, spineFor } from "./gear-advice";

/**
 * Le impostazioni dell'arciere ricavate dall'attrezzatura principale: tipo d'arco, libbre
 * dichiarate, allungo, libbre reali all'allungo, dati delle frecce. Servono a dare consigli
 * su misura (spine, peso, FOC, balistica, lezioni) invece di numeri generici.
 */
export type ArcherSetup = {
  has: boolean;
  bowType: string;
  bowLabel: string;
  lb: number;
  drawIn: number;
  realLb: number;
  arrow: { spine: number; lengthIn: number; weight: number; point: number; material: string; name: string };
  spineRange: string;
  grains: { min: number; max: number } | null;
  /** frase breve: "olimpico 32 lb a 28,5″ (33 lb reali)" */
  summary: string;
};

const BOW_NAMES: Record<string, string> = { olimpico: "olimpico", compound: "compound", nudo: "arco nudo", longbow: "longbow", ricurvo: "ricurvo", storico: "storico", asiatico: "asiatico", flatbow: "flatbow" };

const num = (s: string | undefined) => Number(String(s ?? "").replace(",", ".")) || 0;
const it = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace(".", ",");

export function setupOf(bowSpecs: Record<string, string> | undefined, arrowSpecs: Record<string, string> | undefined, arrowName = ""): ArcherSetup {
  const b = bowSpecs ?? {};
  const a = arrowSpecs ?? {};
  const bowType = b.bowType || "olimpico";
  const lb = num(b.draw);
  const drawIn = num(b.drawLen) || 28;
  const real = lb ? realLb({ bowType, draw: String(lb), drawLen: String(drawIn) }) : 0;
  const arrow = { spine: num(a.spine), lengthIn: num(a.length), weight: num(a.weight), point: num(a.point), material: a.material || "", name: arrowName };
  const g = lb ? grainsFor({ bowType, draw: String(lb), drawLen: String(drawIn) }) : null;
  const bowLabel = BOW_NAMES[bowType] ?? bowType;
  const summary = lb ? `${bowLabel} ${it(lb)} lb a ${it(drawIn)}″${bowType !== "compound" && Math.abs(real - lb) >= 0.5 ? ` (${Math.round(real)} lb reali)` : ""}` : bowLabel;
  return {
    has: lb > 0,
    bowType,
    bowLabel,
    lb,
    drawIn,
    realLb: real,
    arrow,
    spineRange: lb ? spineFor({ bowType, draw: String(lb), drawLen: String(drawIn) }, arrow.lengthIn || drawIn + 1) : "",
    grains: g ? { min: g.min, max: g.max } : null,
    summary,
  };
}

export function useArcherSetup(): ArcherSetup {
  const gear = useMainGear();
  return setupOf(gear?.bowSpecs, gear?.arrowSpecs, gear?.arrowName);
}
