export const BOWS = [
  { id: "olimpico", label: "Arco olimpico" },
  { id: "compound", label: "Arco compound" },
  { id: "nudo", label: "Arco nudo" },
  { id: "lungo", label: "Arco lungo" },
  { id: "tradizionale", label: "Arco tradizionale" },
  { id: "altro", label: "Altro" },
] as const;

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
  { id: "corda", label: "Corde" },
  { id: "mirino", label: "Mirini" },
  { id: "rest", label: "Rest" },
  { id: "stabilizzatore", label: "Stabilizzatori" },
  { id: "parabraccio", label: "Parabraccio" },
  { id: "guantino", label: "Guantino" },
  { id: "faretra", label: "Faretra" },
  { id: "bersaglio", label: "Bersagli" },
  { id: "accessorio", label: "Accessori" },
  { id: "abbigliamento", label: "Abbigliamento" },
  { id: "scarpe", label: "Scarpe" },
  { id: "altro", label: "Altro" },
] as const;

export const DISTANCES = [18, 20, 25, 30, 40, 50, 60, 70, 90];

export function bowLabel(id: string, custom = "") {
  if (id === "altro" && custom.trim()) return custom.trim();
  return BOWS.find((b) => b.id === id)?.label ?? id;
}

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
