import { useSyncExternalStore } from "react";

/**
 * Attrezzatura principale: la configurazione (arco + frecce) che usi di solito.
 * Resta sul telefono con una copia delle schede, così Home, avatar, balistica e 3D
 * la mostrano subito, anche senza rete. Un allenamento nuovo parte con questa.
 */
export type MainGear = {
  setupId: number | null;
  name: string;
  bowId: number | null;
  arrowId: number | null;
  bowName: string;
  arrowName: string;
  bowSpecs: Record<string, string>;
  arrowSpecs: Record<string, string>;
};

const KEY = "aa-main-gear";
const EVENT = "aa-main-gear";

export function readMainGear(): MainGear | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<MainGear> | null;
    if (!raw || typeof raw !== "object") return null;
    return {
      setupId: typeof raw.setupId === "number" ? raw.setupId : null,
      name: String(raw.name ?? ""),
      bowId: typeof raw.bowId === "number" ? raw.bowId : null,
      arrowId: typeof raw.arrowId === "number" ? raw.arrowId : null,
      bowName: String(raw.bowName ?? ""),
      arrowName: String(raw.arrowName ?? ""),
      bowSpecs: raw.bowSpecs && typeof raw.bowSpecs === "object" ? (raw.bowSpecs as Record<string, string>) : {},
      arrowSpecs: raw.arrowSpecs && typeof raw.arrowSpecs === "object" ? (raw.arrowSpecs as Record<string, string>) : {},
    };
  } catch {
    return null;
  }
}

export function saveMainGear(gear: MainGear | null) {
  try {
    if (gear) localStorage.setItem(KEY, JSON.stringify(gear));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* memoria non disponibile */
  }
}

// lo stesso oggetto finché il testo salvato non cambia: chi la usa non si ridisegna per niente
let snap: { raw: string | null; gear: MainGear | null } | null = null;
function gearSnapshot(): MainGear | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (snap && snap.raw === raw) return snap.gear;
  snap = { raw, gear: readMainGear() };
  return snap.gear;
}
function subscribeGear(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** Attrezzatura principale, letta subito (anche al ritorno su una scheda); durante l'idratazione parte vuota come sul server. */
export function useMainGear() {
  return useSyncExternalStore(subscribeGear, gearSnapshot, () => null);
}

const SHAFT_BY_MATERIAL: Record<string, string> = { legno: "#c99a5e", carbonio: "#1d1f22", alluminio: "#9aa7b2", "carbo-alluminio": "#5b6670", bambu: "#c9b46a" };

/** Colori delle frecce principali, per le viste 3D. */
export function arrowLookOf(sp: Record<string, string> | undefined | null) {
  if (!sp) return {};
  return {
    shaft: sp.shaft || SHAFT_BY_MATERIAL[sp.material ?? ""] || undefined,
    fletch: sp.fletch || undefined,
    cock: sp.cock || undefined,
    nock: sp.nock || undefined,
    wood: sp.material === "legno" || sp.material === "bambu" || undefined,
    material: sp.material || undefined,
    fletchType: sp.fletchType || undefined,
    fletchStyle: sp.fletchStyle || undefined,
    fletch2: sp.fletch2 || undefined,
    wrap: sp.wrap || undefined,
    pointType: sp.pointType || undefined,
  };
}

export function useMainArrowLook() {
  const gear = useMainGear();
  return arrowLookOf(gear?.arrowSpecs);
}
