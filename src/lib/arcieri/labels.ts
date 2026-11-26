/** archi delle gare e degli allenamenti: prima quelli della compagnia (tradizionale, storico, foggia storica), poi gli altri */
export const BOWS = [
  { id: "tradizionale", label: "Arco tradizionale" },
  { id: "storico", label: "Arco storico" },
  { id: "foggia storica", label: "Foggia storica" },
  { id: "lungo", label: "Arco lungo" },
  { id: "nudo", label: "Arco nudo" },
  { id: "olimpico", label: "Arco olimpico" },
  { id: "compound", label: "Arco compound" },
  { id: "altro", label: "Altro" },
] as const;
export const MAIN_BOWS = ["tradizionale", "storico", "foggia storica"];

export const DISCIPLINES = [
  { id: "indoor", label: "Indoor" },
  { id: "outdoor", label: "Targa outdoor" },
  { id: "field", label: "Field" },
  { id: "3d", label: "3D" },
  { id: "tradizionale", label: "Tradizionale" },
  { id: "libero", label: "Libero" },
] as const;

export const CATEGORIES = [
  { id: "arco", label: "Archi" },
  { id: "freccia", label: "Frecce" },
  { id: "aste", label: "Aste" },
  { id: "punte", label: "Punte" },
  { id: "alette", label: "Alette e penne" },
  { id: "cocche", label: "Cocche" },
  { id: "corda", label: "Corde" },
  { id: "mirino", label: "Mirini" },
  { id: "rest", label: "Rest" },
  { id: "stabilizzatore", label: "Stabilizzatori" },
  { id: "parabraccio", label: "Parabraccio" },
  { id: "guantino", label: "Guantino" },
  { id: "sgancio", label: "Sgancio" },
  { id: "pettorina", label: "Pettorina" },
  { id: "faretra", label: "Faretra" },
  { id: "bersaglio", label: "Bersagli" },
  { id: "custodia", label: "Custodie" },
  { id: "borsa", label: "Borse" },
  { id: "supporto", label: "Supporti arco" },
  { id: "accessorio", label: "Accessori" },
  { id: "abbigliamento", label: "Abbigliamento" },
  { id: "scarpe", label: "Scarpe" },
  { id: "altro", label: "Altro" },
] as const;

export const DISTANCES = [18, 20, 25, 30, 40, 50, 60, 70, 90];

export function bowLabel(id: string, custom = "") {
  if (id === "altro" && custom.trim()) return custom.trim();
  return BOWS.find((b) => b.id === id)?.label ?? BOW_ALIASES[id] ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : id);
}

/** archi scelti nell'avatar o scritti a mano, detti per bene */
const BOW_ALIASES: Record<string, string> = { longbow: "Arco lungo", ricurvo: "Arco ricurvo", flatbow: "Flatbow", storico: "Arco storico", "foggia storica": "Foggia storica", asiatico: "Arco asiatico", barebow: "Arco nudo" };

export function disciplineLabel(id: string) {
  return DISCIPLINES.find((d) => d.id === id)?.label ?? id;
}

export function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const DIVISIONS = ["Madonne", "Messeri", "Pueri", "Juniores"] as const;
export type Division = (typeof DIVISIONS)[number];

export function divisionOf(category: string): Division | "" {
  if (category === "Madame" || category === "Madonne") return "Madonne";
  if (category === "Messeri") return "Messeri";
  if (category === "Pueri") return "Pueri";
  if (category === "Juniores") return "Juniores";
  return "";
}

export type NameBits = {
  givenName: string;
  familyName: string;
  nickname: string;
  slug: string;
};

export function memberLabel(m: NameBits, peers: { givenName: string }[]) {
  if (m.nickname.trim()) return m.nickname.trim();
  const family = m.familyName.trim();
  const base = [m.givenName, family].filter(Boolean).join(" ");
  const dup = peers.filter((p) => p.givenName === m.givenName).length > 1;
  if (dup && !family) {
    if (m.slug.startsWith("u-")) return `${m.givenName} · nuovo`;
    const suffix = m.slug.split("-")[1];
    return suffix ? `${m.givenName} · ${suffix}` : m.givenName;
  }
  return base || m.givenName;
}

export function initials(name: string) {
  const parts = name.split(/\s+/).filter((w) => w !== "·" && !/^\d+$/.test(w));
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return name.replace(/[^a-zA-ZÀ-ÿ]/g, "").slice(0, 2).toUpperCase() || "?";
}

export function parseEuro(raw: string) {
  const n = Number(raw.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function euro(cents: number | null) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
