import { useEntryState } from "@/lib/arcieri/back-restore";
import { useEffect, useState, type ReactNode } from "react";
import { useCrests } from "@/lib/arcieri/crest";
import { useMemberMaybe } from "@/components/shell";
import { createFileRoute } from "@tanstack/react-router";
import { AvatarScene, useAvatar } from "@/components/avatar-hero";
import { Archer3D } from "@/components/archer-3d";
import { ArcherAvatar, AvatarFace } from "@/components/archer-avatar";
import { AvatarPhotoButton } from "@/components/avatar-photo";
import { BOW_TYPES, MAIN_BOW_TYPES, bowTypesShown } from "@/components/gear-icons";
import { Button, Card, Chips, Segmented } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { SceneBackdrop, SceneThumb } from "@/components/scene-2d";
import { ArcherFront } from "@/components/archer-front";
import { FACE_BGS, SCENES, sceneById } from "@/lib/arcieri/scenes";
import { useSky } from "@/lib/arcieri/sky3d";
import { PALETTES } from "@/lib/arcieri/avatar-more";
import { EXCLUSIVE_SCENES, specialLooksFor, type SpecialLook } from "@/lib/arcieri/special-looks";
import {
  AVATAR_DEFAULT,
  AVATAR_PRESETS,
  CLOTH_COLORS,
  EYE_COLORS,
  TOPS,
  GEAR_COLORS,
  HAIR_COLORS,
  SKINS,
  EXTRA_OPTIONS,
  FOUNDER_LOOKS,
  founderOnly,
  randomLook,
  outfitIdea,
  presetLook,
  tune,
  BOOTS_TALL,
  nearSide,
  sideOf,
  type AvatarLook,
  type ExtraKey,
} from "@/lib/arcieri/avatar";
import { bootHeightOf } from "@/components/avatar-shoes";

export const Route = createFileRoute("/_app/avatar")({
  component: Page,
});

const STYLE_NAME: Record<AvatarLook["style"], string> = { moderno: "Moderno", medievale: "Medievale" };
const BODY_NAME: Record<AvatarLook["body"], string> = { uomo: "arciere", donna: "arciera", ragazzo: "giovane arciere", ragazza: "giovane arciera" };
const sceneLabel = (id: string) => sceneById(id).label;

type Tab = "corpo" | "viso" | "barba" | "capelli" | "abiti" | "accessori" | "attrezzatura" | "posa" | "scena";

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const BODY_LABEL = { uomo: "Uomo", donna: "Donna", ragazzo: "Ragazzo", ragazza: "Ragazza" } as const;
const NOSE_OPTS: [AvatarLook["nose"], string][] = [["dritto", "Dritto"], ["piccolo", "Piccolo"], ["insu", "All'insù"], ["aquilino", "Aquilino"], ["largo", "Largo"], ["patata", "A patata"]];
const BEARD_OPTS: [AvatarLook["beard"], string][] = [["nessuna", "Nessuna"], ["accenno", "Accenno"], ["corta", "Corta"], ["piena", "Piena"], ["lunga", "Lunga"], ["pizzetto", "Pizzetto"], ["barbetta", "Sul mento"], ["basette", "Basette"], ["mosca", "Mosca"], ["baffi", "Solo baffi"]];
const STACHE_OPTS: [AvatarLook["stache"], string][] = [["auto", "Con la barba"], ["nessuno", "Nessuno"], ["sottili", "Sottili"], ["classici", "Classici"], ["folti", "Folti"], ["manubrio", "A manubrio"], ["ferro", "A ferro di cavallo"]];
const HAIR_OPTS: [AvatarLook["hair"], string][] = [
  ["corti", "Corti"], ["spettinati", "Spettinati"], ["rasati", "Rasati"], ["frangia", "Con frangia"], ["ciuffo", "Ciuffo"], ["undercut", "Rasati ai lati"], ["mossi", "Mossi"], ["ricci", "Ricci"], ["afro", "Afro"], ["dread", "Dread"],
  ["lunghi", "Lunghi"], ["lunghi-mossi", "Lunghi mossi"], ["coda", "Coda"], ["coda-alta", "Coda alta"], ["raccolti", "Raccolti in alto"], ["chignon", "Chignon"], ["treccia", "Treccia"], ["trecce", "Due trecce"], ["vichinga", "Treccia vichinga"], ["codini", "Codini"], ["caschetto", "Caschetto"], ["cresta", "Cresta"], ["calvo", "Calvo"],
];
const HAT_OPTS: [AvatarLook["hat"], string][] = [["nessuno", "Niente"], ["berretto", "Berretto"], ["cuffia", "Cuffia"], ["fascia", "Fascia"], ["bandana", "Bandana"], ["piuma", "Con piuma"], ["robin", "A punta"], ["tesa", "Tesa larga"], ["cappuccio", "Cappuccio"], ["cerchietto", "Diadema"], ["alloro", "Alloro"], ["elmo", "Elmo"]];
const BOTTOM_OPTS: [AvatarLook["bottom"], string][] = [["pantaloni", "Pantaloni"], ["jeans", "Jeans"], ["cargo", "Con tasche"], ["pantaloncini", "Pantaloncini"], ["calzamaglia", "Calzamaglia"], ["brache", "Brache"], ["larghi", "Larghi"], ["gonna", "Gonnellino"]];
const POSE_OPTS: [AvatarLook["pose"], string][] = [["animata", "Tira in continuo"], ["riposo", "Posizione"], ["incocco", "Incocca"], ["mira", "Mira"], ["accompagna", "Accompagna"], ["vittoria", "Vittoria"], ["esulta", "Esulta"], ["fiero", "Fiero"], ["saluto", "Saluto"], ["pensa", "Pensa"], ["mostra", "Mostra l'arco"], ["spalla", "Arco imbracciato"]];
const FOOT_OPTS: [AvatarLook["footwear"], string][] = [["sportive", "Sportive"], ["stivaletti", "Stivaletti"], ["scarponi", "Scarponi"], ["mocassini", "Mocassini"], ["sandali", "Sandali"], ["stivali", "Stivali"], ["stivali-risvolto", "Con risvolto"], ["stivali-alti", "Alti"], ["stivali-pelliccia", "Con pelliccia"]];

/**
 * Nastro di scelte da scorrere col dito: ogni miniatura mostra il proprio arciere con
 * quella scelta già applicata. Si tocca e si vede subito.
 */
function Strip({ title, items, current, onPick, hint }: { title: string; items: { id: string; label: string; preview: ReactNode }[]; current: string; onPick: (id: string) => void; hint?: string }) {
  const idx = Math.max(0, items.findIndex((it) => it.id === current));
  return (
    <section className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="shrink-0 text-[0.68rem] tabular-nums text-muted">{idx + 1}/{items.length}{hint ? ` · ${hint}` : ""}</span>
      </div>
      <div className="aa-strip -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none]">
        {items.map((it) => {
          const on = it.id === current;
          return (
            <button key={it.id} type="button" aria-pressed={on} onClick={() => onPick(it.id)} className={`aa-press aa-lazy grid w-[5.6rem] shrink-0 snap-start justify-items-center gap-1 rounded-2xl p-1.5 text-center text-[0.64rem] font-semibold leading-tight transition ${on ? "bg-[#7cf0a8]/15 ring-2 ring-[#7cf0a8]" : "bg-white/[0.04] ring-1 ring-white/5"}`}>
              <span className="relative block h-[4.6rem] w-full overflow-hidden rounded-xl bg-gradient-to-b from-white/[0.07] to-transparent">{it.preview}</span>
              <span className="line-clamp-2 min-h-[1.6em]">{it.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** come si vede una scelta in più: volto, figura di fronte, arco o solo il nome */
const EXTRA_PREVIEW: Record<ExtraKey, "volto" | "fronte" | "arco" | "testo"> = {
  pattern: "fronte", emblem: "fronte", paint: "volto", paint2: "volto", tattoo: "testo", earringType: "volto", hairAcc: "volto",
  bowDeco: "arco", fletchStyle: "arco", quiverStyle: "fronte", eyeShape: "volto", mouth: "volto", ears: "volto",
  blush: "volto", age: "volto", mark: "volto", buckle: "fronte", pouchType: "fronte", clasp: "fronte",
  capePattern: "fronte", frame: "volto", idle: "testo",
  eyepatch: "volto", browShape: "volto", pendant: "fronte", palette: "fronte",
};
/** i colori di una tavolozza, pronti da mettere sull'arciere */
const paletteOf = (id: string): Partial<AvatarLook> => ({ ...(PALETTES.find((p) => p.id === id)?.c ?? {}), palette: id });
/** cosa accendere perché la scelta si veda nell'anteprima */
const EXTRA_NEEDS: Partial<Record<ExtraKey, Partial<AvatarLook>>> = {
  earringType: { earring: true, hat: "nessuno" },
  hairAcc: { hat: "nessuno" },
  pouchType: { pouch: true },
  clasp: { cape: true },
  buckle: { belt: "larga" },
  quiverStyle: { quiverPlace: "fianco" },
  capePattern: { cape: true },
  eyepatch: { hat: "nessuno", sunglasses: false, glasses: false },
  tattoo: {},
};

function ExtraPreview({ k, look, value }: { k: ExtraKey; look: AvatarLook; value: string }) {
  const kind = EXTRA_PREVIEW[k];
  const l = { ...look, ...EXTRA_NEEDS[k], [k]: value, ...(k === "palette" ? paletteOf(value) : {}) } as AvatarLook;
  if (kind === "volto") {
    const zoom = k === "frame" ? "h-full w-full" : "absolute left-[-30%] top-[-26%] h-[160%] w-[160%]";
    return <AvatarFace look={k === "frame" ? l : { ...l, frame: "nessuna" }} className={zoom} />;
  }
  if (kind === "fronte") {
    const crop = k === "buckle" ? "70 165 60 50" : k === "pouchType" ? "40 170 120 70" : k === "quiverStyle" ? "15 160 100 110" : k === "clasp" ? "40 80 120 60" : k === "pendant" ? "62 88 76 62" : k === "palette" ? "15 40 170 320" : k === "capePattern" ? "10 90 180 200" : "40 90 120 130";
    return <ArcherFront look={{ ...l, lefty: false }} crop={crop} className="h-full w-full" />;
  }
  if (kind === "arco") {
    return <span className="absolute left-[-30%] top-[-12%] w-[150%]"><ArcherAvatar look={{ ...l, useMain: false, lefty: false }} pose="mira" still interactive={false} className="h-auto w-full" /></span>;
  }
  const label = (EXTRA_OPTIONS[k].items as readonly (readonly [string, string])[]).find(([id]) => id === value)?.[1] ?? value;
  return <span className="grid h-full place-items-center px-1 font-display text-[0.9rem] leading-tight text-white/90">{label}</span>;
}

/** tutte le novità di una sezione dell'editor, ognuna nel suo nastro */
function ExtraStrips({ tab, look, shown, set, founder = false }: { tab: string; look: AvatarLook; shown: AvatarLook; set: (k: ExtraKey, v: string) => void; /** il Fondatore vede anche i pezzi dei suoi completi */ founder?: boolean }) {
  const keys = (Object.keys(EXTRA_OPTIONS) as ExtraKey[]).filter((k) => EXTRA_OPTIONS[k].tab === tab);
  if (!keys.length) return null;
  return (
    <div className="grid gap-4">
      {keys.map((k) => (
        <Strip
          key={k}
          title={EXTRA_OPTIONS[k].label}
          current={String(look[k] ?? "")}
          onPick={(id) => set(k, id)}
          items={(EXTRA_OPTIONS[k].items as readonly (readonly [string, string])[]).filter(([id]) => founder || !founderOnly(k, id)).map(([id, label]) => ({ id, label, preview: <ExtraPreview k={k} look={shown} value={id} /> }))}
        />
      ))}
    </div>
  );
}

/**
 * Idee per te: nove abbigliamenti nuovi sul tuo arciere (viso e corpo restano i tuoi).
 * Si tocca quella che piace; "Altre idee" ne propone altre nove.
 */
function OutfitIdeas({ base, onPick }: { base: AvatarLook; onPick: (l: AvatarLook) => void }) {
  const [ideas, setIdeas] = useState<AvatarLook[] | null>(null);
  const list = ideas ?? [];
  const more = () => setIdeas(Array.from({ length: 9 }, () => outfitIdea(base)));
  return (
    <section className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h3 className="text-sm font-semibold">Idee per te</h3>
        <button type="button" className="aa-chip" onClick={more}><Glyph name="sparkle" size={13} /> {ideas ? "Altre idee" : "Mostra idee"}</button>
      </div>
      {ideas ? (
        <div className="grid grid-cols-3 gap-2">
          {list.map((l, i) => (
            <button key={i} type="button" onClick={() => onPick(l)} className="aa-press relative h-36 overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.07] to-transparent ring-1 ring-white/5" aria-label={`Idea ${i + 1}: prova questo abbigliamento`}>
              <ArcherFront look={{ ...l, lefty: false }} crop="10 0 180 360" className="h-full w-full" />
            </button>
          ))}
        </div>
      ) : (
        <p className="px-0.5 text-xs text-muted">Nove abbigliamenti pensati per il tuo arciere, con stemmi, fantasie e ambientazioni: il viso resta il tuo.</p>
      )}
    </section>
  );
}

/** riquadro di scelta con anteprima disegnata */
function Pick({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`aa-press grid justify-items-center gap-1 rounded-2xl p-1.5 text-center text-[0.66rem] font-semibold leading-tight transition ${on ? "bg-[#7cf0a8]/15 ring-2 ring-[#7cf0a8]" : "bg-white/[0.04] ring-1 ring-white/5"}`}>
      {children}
      <span className="line-clamp-2 min-h-[1.6em]">{label}</span>
    </button>
  );
}

/** griglia di volti: ogni scelta si vede già applicata al proprio arciere */
function FaceGrid({ look, items, current, onPick, zoom = false }: { look: AvatarLook; items: { id: string; label: string; patch: Partial<AvatarLook> }[]; current: string; onPick: (id: string) => void; zoom?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((it) => (
        <Pick key={it.id} on={current === it.id} label={it.label} onClick={() => onPick(it.id)}>
          <div className={`relative h-14 w-14 overflow-hidden rounded-full ${zoom ? "" : ""}`}>
            <AvatarFace look={{ ...look, ...it.patch }} className={zoom ? "absolute left-[-40%] top-[-38%] h-[180%] w-[180%]" : "h-14 w-14"} />
          </div>
        </Pick>
      ))}
    </div>
  );
}

/** griglia di figure intere per abiti, pantaloni e calzature */
function BodyGrid({ look, items, current, onPick, legs = false, feet = false }: { look: AvatarLook; items: { id: string; label: string; patch: Partial<AvatarLook> }[]; current: string; onPick: (id: string) => void; legs?: boolean; feet?: boolean }) {
  const crop = feet ? "45 250 110 110" : legs ? "35 180 130 170" : "10 0 180 290";
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <Pick key={it.id} on={current === it.id} label={it.label} onClick={() => onPick(it.id)}>
          <div className="relative h-24 w-full overflow-hidden rounded-xl bg-gradient-to-b from-white/[0.06] to-transparent">
            <ArcherFront look={{ ...look, ...it.patch, cape: false, lefty: false }} crop={crop} className="h-full w-full" />
          </div>
        </Pick>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

function Colors({ value, colors, onPick }: { value: string; colors: string[]; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button key={c || "none"} type="button" aria-label={c || "Nessuno"} aria-pressed={value === c} onClick={() => onPick(c)} className={`grid h-9 w-9 place-items-center rounded-full border-2 text-xs text-muted ${value === c ? "border-white shadow-[0_0_0_2px_rgba(0,0,0,0.4)]" : c ? "border-transparent" : "border-line"}`} style={{ background: c || "transparent" }}>{c ? null : "—"}</button>
      ))}
    </div>
  );
}

/** barra a scorrimento con il valore accanto */
function Slider({ label, value, min, max, step = 1, onChange, format, ends }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; ends?: [string, string] }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="grid gap-1">
      <span className="flex items-baseline justify-between text-xs font-semibold text-muted">
        <span>{label}</span>
        <span className="font-display text-sm tabular-nums text-fg">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="aa-range" style={{ ["--pct" as string]: `${pct}%` }} />
      {ends ? <span className="flex justify-between text-[0.62rem] text-muted"><span>{ends[0]}</span><span>{ends[1]}</span></span> : null}
    </label>
  );
}

function hexToHsl(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? Number.parseInt(m[1], 16) : 0x777777;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number) {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const c = (n: number) => Math.round(255 * (L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${[c(0), c(8), c(4)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** colore libero con tre barre (tinta, intensità, luce) e qualche colore pronto sotto */
function Tint({ value, onPick, quick }: { value: string; onPick: (c: string) => void; quick?: string[] }) {
  const { h, s, l } = hexToHsl(value || "#777777");
  // tre barre ben distanziate, ognuna col suo nome: si prendono col dito senza toccare quella vicina
  const bars: { label: string; input: ReactNode }[] = [
    { label: "Tinta", input: <input aria-label="Tinta" type="range" min={0} max={359} value={h} onChange={(e) => onPick(hslToHex(Number(e.target.value), Math.max(s, 18), l))} className="aa-range aa-range-hue" /> },
    { label: "Intensità", input: <input aria-label="Intensità" type="range" min={0} max={100} value={s} onChange={(e) => onPick(hslToHex(h, Number(e.target.value), l))} className="aa-range" style={{ ["--track" as string]: `linear-gradient(90deg, ${hslToHex(h, 0, l)}, ${hslToHex(h, 100, l)})` }} /> },
    { label: "Chiaro o scuro", input: <input aria-label="Chiaro o scuro" type="range" min={4} max={96} value={l} onChange={(e) => onPick(hslToHex(h, s, Number(e.target.value)))} className="aa-range" style={{ ["--track" as string]: `linear-gradient(90deg, #000, ${hslToHex(h, s, 50)}, #fff)` }} /> },
  ];
  return (
    <div className="grid gap-2 rounded-2xl bg-white/[0.03] p-3">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 rounded-full border-2 border-white/70 shadow-[0_0_0_2px_rgba(0,0,0,.35)]" style={{ background: value }} />
        {quick ? (
          <div className="-my-1 flex flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
            {quick.filter(Boolean).map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => onPick(c)} className={`h-8 w-8 shrink-0 rounded-full border-2 ${value === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        ) : <span className="text-xs text-muted">Scegli il colore con le barre</span>}
      </div>
      {bars.map((b) => (
        <label key={b.label} className="grid">
          <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{b.label}</span>
          {b.input}
        </label>
      ))}
    </div>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onChange(!on)} className="aa-chip">
      {on ? <Glyph name="check" size={13} /> : null}
      {label}
    </button>
  );
}

/** accessori da mettere e togliere, ognuno con la sua miniatura */
type Acc = { key: keyof AvatarLook; label: string; crop?: string };
const ACCS_FACE: Acc[] = [
  { key: "glasses", label: "Occhiali" },
  { key: "sunglasses", label: "Occhiali da sole" },
  { key: "mask", label: "Maschera sul viso" },
  { key: "earring", label: "Orecchino" },
  { key: "hairFeather", label: "Piuma tra i capelli" },
  { key: "freckles", label: "Lentiggini" },
  { key: "warpaint", label: "Pittura di guerra" },
  { key: "scar", label: "Cicatrice" },
];
const ACCS_BODY: Acc[] = [
  { key: "necklace", label: "Collana", crop: "62 88 76 62" },
  { key: "amulet", label: "Medaglione", crop: "62 88 76 62" },
  { key: "scarf", label: "Sciarpa", crop: "50 80 100 90" },
  { key: "cowl", label: "Scialle a cappuccio", crop: "40 60 120 100" },
  { key: "fur", label: "Pelliccia sulle spalle", crop: "30 70 140 90" },
  { key: "straps", label: "Cinghie incrociate", crop: "40 90 120 130" },
  { key: "chestguard", label: "Pettorina", crop: "40 90 120 130" },
  { key: "armband", label: "Fascia sul braccio", crop: "15 95 170 120" },
  { key: "watch", label: "Orologio", crop: "15 140 170 100" },
  { key: "gloves", label: "Guanti", crop: "15 150 170 100" },
  { key: "pouch", label: "Borsello", crop: "40 170 120 70" },
  { key: "sash", label: "Fusciacca", crop: "40 160 120 100" },
  { key: "wraps", label: "Fasce alle gambe", crop: "45 230 110 120" },
  { key: "cape", label: "Mantello", crop: "10 60 180 280" },
];
/** nastro di accessori: ogni tocco mette o toglie, la spunta dice cosa porti */
function AccessoryStrip({ title, items, look, shown, onToggle }: { title: string; items: Acc[]; look: AvatarLook; shown: AvatarLook; onToggle: (k: keyof AvatarLook, v: boolean) => void }) {
  const on = items.filter((a) => Boolean(look[a.key])).length;
  return (
    <section className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="shrink-0 text-[0.68rem] tabular-nums text-muted">{on ? `${on} ${on === 1 ? "indossato" : "indossati"}` : "tocca per indossare"}</span>
      </div>
      <div className="aa-strip -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none]">
        {items.map((a) => {
          const isOn = Boolean(look[a.key]);
          const l = { ...shown, [a.key]: true, ...(a.key === "earring" || a.key === "hairFeather" ? { hat: "nessuno" } : {}), lefty: false } as AvatarLook;
          return (
            <button key={String(a.key)} type="button" aria-pressed={isOn} onClick={() => onToggle(a.key, !isOn)} className={`aa-press aa-lazy relative grid w-[5.6rem] shrink-0 snap-start justify-items-center gap-1 rounded-2xl p-1.5 text-center text-[0.64rem] font-semibold leading-tight transition ${isOn ? "bg-[#7cf0a8]/15 ring-2 ring-[#7cf0a8]" : "bg-white/[0.04] ring-1 ring-white/10"}`}>
              <span className="relative block h-[4.6rem] w-full overflow-hidden rounded-xl bg-gradient-to-b from-white/[0.07] to-transparent">
                {a.crop ? <ArcherFront look={l} crop={a.crop} className="h-full w-full" /> : <AvatarFace look={{ ...l, frame: "nessuna" }} className="absolute left-[-30%] top-[-26%] h-[160%] w-[160%]" />}
              </span>
              <span className="line-clamp-2 min-h-[1.6em]">{a.label}</span>
              {isOn ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[#7cf0a8] text-[#0b120e]"><Glyph name="check" size={12} /></span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** cerca fra tutte le scelte dell'avatar per nome (es. «benda», «lupo», «oro») */
type Hit = { k: string; id: string; label: string; group: string };
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function searchIndex(): Hit[] {
  const extras = (Object.keys(EXTRA_OPTIONS) as ExtraKey[]).flatMap((k) => (EXTRA_OPTIONS[k].items as readonly (readonly [string, string])[]).map(([id, label]) => ({ k, id, label, group: EXTRA_OPTIONS[k].label })));
  return [
    ...AVATAR_PRESETS.map((p) => ({ k: "preset", id: p.id, label: p.label, group: "Stili pronti" })),
    ...HAIR_OPTS.map(([id, label]) => ({ k: "hair", id, label, group: "Capelli" })),
    ...BEARD_OPTS.map(([id, label]) => ({ k: "beard", id, label, group: "Barba" })),
    ...STACHE_OPTS.map(([id, label]) => ({ k: "stache", id, label, group: "Baffi" })),
    ...HAT_OPTS.map(([id, label]) => ({ k: "hat", id, label, group: "In testa" })),
    ...[...TOPS.moderno, ...TOPS.medievale].map((t) => ({ k: "top", id: t.id, label: t.label, group: "Sopra" })),
    ...BOTTOM_OPTS.map(([id, label]) => ({ k: "bottom", id, label, group: "Sotto" })),
    ...FOOT_OPTS.map(([id, label]) => ({ k: "footwear", id, label, group: "Ai piedi" })),
    ...extras,
  ];
}
let INDEX: Hit[] | null = null;
function OptionSearch({ look, shown, onPick }: { look: AvatarLook; shown: AvatarLook; onPick: (h: Hit) => void }) {
  const [q, setQ] = useState("");
  INDEX ??= searchIndex();
  const words = norm(q).trim().split(/\s+/).filter((w) => w.length >= 2);
  const hits = words.length ? INDEX.filter((h) => words.every((w) => norm(`${h.label} ${h.group}`).includes(w))).slice(0, 30) : [];
  const preview = (h: Hit): ReactNode => {
    if (h.k === "preset") { const p = AVATAR_PRESETS.find((x) => x.id === h.id); return <AvatarFace look={{ ...presetLook(shown, p?.look ?? {}), frame: "nessuna" }} className="absolute left-[-6%] top-[-4%] h-[112%] w-[112%]" />; }
    if (h.k === "hair" || h.k === "beard" || h.k === "stache" || h.k === "hat") return <AvatarFace look={{ ...shown, [h.k]: h.id, frame: "nessuna" } as AvatarLook} className="absolute left-[-20%] top-[-18%] h-[140%] w-[140%]" />;
    if (h.k === "top" || h.k === "bottom" || h.k === "footwear") return <ArcherFront look={{ ...shown, [h.k]: h.id, cape: false, lefty: false } as AvatarLook} crop={h.k === "top" ? "30 70 140 170" : h.k === "bottom" ? "35 180 130 170" : "45 250 110 110"} className="h-full w-full" />;
    return <ExtraPreview k={h.k as ExtraKey} look={shown} value={h.id} />;
  };
  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-2 rounded-2xl bg-white/[0.06] px-3 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-[#7cf0a8]">
        <Glyph name="search" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cerca fra ${INDEX.length} scelte: benda, lupo, oro, ciondolo…`} className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted" />
        {q ? <button type="button" onClick={() => setQ("")} aria-label="Cancella" className="text-muted"><Glyph name="close" size={14} /></button> : null}
      </label>
      {words.length ? (
        hits.length ? (
          <Strip title={`Trovate ${hits.length}${hits.length === 30 ? "+" : ""}`} current={String((look as Record<string, unknown>)[hits[0]?.k] ?? "")} onPick={(id) => { const h = hits.find((x) => x.id === id); if (h) onPick(h); }} items={hits.map((h) => ({ id: h.id, label: `${h.label} · ${h.group}`, preview: preview(h) }))} />
        ) : <p className="px-1 text-xs text-muted">Nessuna scelta con «{q}». Prova un'altra parola.</p>
      ) : null}
    </div>
  );
}

/** Personalizzazione dell'arciere della Home: aspetto, abiti e attrezzatura. Si salva da sé. Vive nel Profilo. */
export function AvatarEditor() {
  const { look, setLook, shown, main } = useAvatar();
  const [tab, setTab] = useEntryState<Tab>("avatar-tab", "corpo");
  const [allBows, setAllBows] = useState(false);
  const [mode, setMode] = useState<"semplice" | "completa">(() => {
    try {
      return (localStorage.getItem("aa-avatar-mode") as "semplice" | "completa") || "semplice";
    } catch {
      return "semplice";
    }
  });
  const pickMode = (m: "semplice" | "completa") => {
    setMode(m);
    try {
      localStorage.setItem("aa-avatar-mode", m);
    } catch {
      /* niente */
    }
  };
  // stemma della compagnia: si fissa quello della propria compagnia, così gli altri vedono il tuo e non il loro
  const crests = useCrests();
  const myCrest = crests?.mine != null ? String(crests.mine) : "";
  const wantsCrest = look.emblem === "compagnia" || look.capePattern === "stemma";
  useEffect(() => {
    if (wantsCrest && myCrest && look.crest !== myCrest) setLook((l) => ({ ...l, crest: myCrest }));
  }, [wantsCrest, look.crest, myCrest, setLook]);
  const crestOnChest = look.emblem === "compagnia";
  const crestOnCape = look.cape && look.capePattern === "stemma";
  // alcune scelte si vedono solo se c'è l'oggetto: lo accendo insieme
  const setX = (k: ExtraKey, v: string) => setLook((l) => ({ ...l, [k]: v, ...(k === "earringType" ? { earring: true } : k === "pouchType" ? { pouch: true } : k === "clasp" && v !== "nessuno" ? { cape: true } : k === "palette" ? paletteOf(v) : k === "capePattern" && v !== "liscio" ? { cape: true } : {}) }));
  const [view, setView] = useEntryState<"lato" | "fronte" | "3d">("avatar-view", "lato");
  const { sky } = useSky();
  const member = useMemberMaybe();
  const profileName = member ? [member.me.givenName, member.me.familyName].filter(Boolean).join(" ").trim() || member.me.nickname : "";
  // i completi del Fondatore (e i loro pezzi: corona, scaglie, piume di fenice) li vede e li sceglie solo lui
  const founder = Boolean(member?.me.isSuper) && member?.me.role === "admin";
  const hats: [AvatarLook["hat"], string][] = founder ? [...HAT_OPTS, ["corona", "Corona"]] : HAT_OPTS;
  // abiti su misura: li vede solo il loro titolare
  const mine: SpecialLook[] = member ? specialLooksFor(member.me.givenName ?? "", member.me.familyName ?? "", founder) : [];
  // sfondi riservati (l'Arpa di Montelago): solo per chi ha il costume
  const scenes = SCENES.filter((sc) => !EXCLUSIVE_SCENES[sc.id] || EXCLUSIVE_SCENES[sc.id].some((id) => mine.some((m) => m.id === id)));
  const mineStrip = mine.length ? (
    <Strip
      title="I tuoi abiti su misura"
      current={look.special}
      hint="solo tuoi, nessun altro li può avere"
      onPick={(id) => { const sp = mine.find((x) => x.id === id); if (sp) setLook((l) => presetLook(l, sp.look)); }}
      items={mine.map((sp) => ({ id: sp.id, label: sp.label.replace(/^[^·]*·\s*/, ""), preview: <ArcherFront look={{ ...presetLook(shown, sp.look), lefty: false }} crop="10 0 180 360" className="absolute inset-0 h-full w-full" /> }))}
    />
  ) : null;
  const set = <K extends keyof AvatarLook>(k: K, v: AvatarLook[K]) => setLook((l) => ({ ...l, [k]: v }));
  const opts = <T extends string>(list: readonly T[]) => list.map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }));

  return (
    <div className="grid gap-3">
      <div className="aa-avatar-head relative overflow-hidden rounded-[var(--radius-card)] border border-hair p-3.5" style={{ ["--av" as string]: shown.shirt }}>
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <AvatarFace look={shown} className="h-20 w-20 rounded-full ring-[3px] ring-white/25 shadow-[0_10px_24px_-10px_rgba(0,0,0,.8)]" />
            {shown.lefty ? <span className="absolute -bottom-1 -right-1 rounded-full bg-[#ffd27a] px-1.5 py-0.5 text-[0.55rem] font-black uppercase text-[#2a1d0c]">Mancino</span> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/60">Il tuo arciere · {STYLE_NAME[shown.style]} · {BODY_NAME[shown.body]}</p>
            {/* l'arciere porta il nome del profilo */}
            <p className="truncate font-display text-2xl leading-tight text-white">{profileName || "Il tuo arciere"}</p>
            <p className="truncate text-xs text-white/70">{[sceneLabel(shown.scene), BOW_TYPES.find((b) => b.id === shown.bowType)?.label].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-white/65">Aspetto, abiti, attrezzatura e sequenza di tiro. Si salva da sé.</p>
      </div>
      <div className="sticky top-16 z-10">
        <div className="relative">
          {view === "3d" ? (
            <Archer3D look={shown} height="h-72" />
          ) : view === "fronte" ? (
            <div className="aa-avatar-stage relative h-72 overflow-hidden">
              <SceneBackdrop sky={sky} id="edfront" scene={shown.scene} />
              <div className="absolute inset-x-0 bottom-[2%] top-[3%] flex justify-center">
                <ArcherFront look={shown} className="h-full w-auto" />
              </div>
            </div>
          ) : (
            <AvatarScene look={shown} height="h-72" phase />
          )}
          <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-full bg-black/45 p-1 backdrop-blur">
            {([["lato", "Profilo"], ["fronte", "Fronte"], ["3d", "3D"]] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`min-h-8 rounded-full px-2.5 text-[0.7rem] font-bold ${view === id ? "bg-[#7cf0a8] text-[#0b120e]" : "text-white"}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {mine.map((sp) => (
          <button key={sp.id} type="button" className="aa-chip shrink-0 border-[#7cf0a8]/60 bg-[#7cf0a8]/15 text-[#bff7d6]" onClick={() => setLook((l) => presetLook(l, sp.look))}><Glyph name="sparkle" size={14} /> {sp.label.replace(/^[^·]*·\s*/, "")}</button>
        ))}
        {founder ? FOUNDER_LOOKS.map((c) => (
          <button key={c.id} type="button" className="aa-chip shrink-0 border-[#e8b93e]/60 bg-[#e8b93e]/15 text-[#f5d36b]" onClick={() => setLook((l) => presetLook(l, c.look))}><Glyph name="medal" size={14} /> {c.label}</button>
        )) : null}
        {AVATAR_PRESETS.map((p) => (
          <button key={p.id} type="button" className="aa-chip shrink-0" onClick={() => setLook((l) => presetLook(l, p.look))}>{p.label}</button>
        ))}
        <button type="button" className="aa-chip shrink-0" onClick={() => setLook((l) => randomLook(l))}><Glyph name="sparkle" size={14} /> Casuale</button>
        <button type="button" className="aa-chip shrink-0" onClick={() => setLook(AVATAR_DEFAULT)}>Ricomincia</button>
      </div>
      <AvatarPhotoButton look={shown} />
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.05] p-1" role="tablist" aria-label="Modo dell'editor">
        {([["semplice", "Semplice", "Scorri e tocca"], ["completa", "Completa", "Tutte le regolazioni"]] as const).map(([id, label, sub]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => pickMode(id)} className={`aa-press grid rounded-xl px-3 py-2 text-left transition ${mode === id ? "bg-[#7cf0a8] text-[#0b120e] shadow-[0_6px_18px_-8px_rgba(124,240,168,.7)]" : "text-white/80"}`}>
            <span className="text-sm font-bold">{label}</span>
            <span className={`text-[0.66rem] ${mode === id ? "text-[#0b120e]/70" : "text-muted"}`}>{sub}</span>
          </button>
        ))}
      </div>
      {mode === "semplice" ? (
        <Card className="grid gap-5">
          {mineStrip}
          {founder ? (
            <Strip
              title="Completi del Fondatore"
              current=""
              hint="solo tuoi: abiti, arco e sfondo"
              onPick={(id) => { const c = FOUNDER_LOOKS.find((x) => x.id === id); if (c) setLook((l) => presetLook(l, c.look)); }}
              items={FOUNDER_LOOKS.map((c) => ({
                id: c.id,
                label: c.label,
                preview: (
                  <span className="absolute inset-0">
                    <span className="absolute inset-0"><SceneThumb scene={c.look.scene ?? "campo"} sky={sky} className="h-full w-full rounded-none" /></span>
                    <ArcherFront look={{ ...presetLook(shown, c.look), lefty: false }} crop="10 0 180 360" className="absolute inset-0 h-full w-full" />
                  </span>
                ),
              }))}
            />
          ) : null}
          <OutfitIdeas base={shown} onPick={(l) => setLook(l)} />
          <Strip title="Posa" current={look.pose} onPick={(id) => set("pose", id as AvatarLook["pose"])} items={POSE_OPTS.map(([id, label]) => ({ id, label, preview: <span className="absolute left-[-14%] top-[-4%] w-[128%]"><ArcherAvatar look={{ ...shown, pose: id, lefty: false }} pose={id === "animata" ? "mira" : id} still interactive={false} className="h-auto w-full" /></span> }))} />
          <Strip title="Stili pronti" current="" hint="tocca per provarne uno" onPick={(id) => { const p = AVATAR_PRESETS.find((x) => x.id === id); if (p) setLook((l) => presetLook(l, p.look)); }} items={AVATAR_PRESETS.map((p) => ({ id: p.id, label: p.label, preview: <AvatarFace look={{ ...presetLook(shown, p.look), frame: "nessuna" }} className="absolute left-[-6%] top-[-4%] h-[112%] w-[112%]" /> }))} />
          <Strip title="Ambientazione" current={look.scene} onPick={(id) => set("scene", id)} items={scenes.map((sc) => ({ id: sc.id, label: sc.label.replace(" (al chiuso)", ""), preview: <SceneThumb scene={sc.id} sky={sky} className="h-full w-full" /> }))} />
          <Strip title="Capelli" current={look.hair} onPick={(id) => set("hair", id as AvatarLook["hair"])} items={HAIR_OPTS.map(([id, label]) => ({ id, label, preview: <AvatarFace look={{ ...shown, hair: id, hat: "nessuno", frame: "nessuna" }} className="h-full w-full" /> }))} />
          <Row label="Colore dei capelli"><Tint value={look.hairColor} onPick={(c) => set("hairColor", c)} quick={HAIR_COLORS} /></Row>
          {look.body === "uomo" ? <Strip title="Barba" current={look.beard} onPick={(id) => set("beard", id as AvatarLook["beard"])} items={BEARD_OPTS.map(([id, label]) => ({ id, label, preview: <AvatarFace look={{ ...shown, beard: id, frame: "nessuna" }} className="absolute left-[-30%] top-[-26%] h-[160%] w-[160%]" /> }))} /> : null}
          <Row label="Stemma della compagnia">
            <div className="flex flex-wrap gap-1.5">
              <Toggle on={crestOnChest} label="Sul petto" onChange={(v) => setLook((l) => ({ ...l, emblem: v ? "compagnia" : "nessuno", crest: v ? l.crest || myCrest : l.crest }))} />
              <Toggle on={crestOnCape} label="Sul mantello" onChange={(v) => setLook((l) => ({ ...l, cape: v ? true : l.cape, capePattern: v ? "stemma" : "liscio", crest: v ? l.crest || myCrest : l.crest }))} />
            </div>
          </Row>
          <AccessoryStrip title="Sul viso" items={ACCS_FACE} look={look} shown={shown} onToggle={(k, v) => setLook((l) => ({ ...l, [k]: v }))} />
          <AccessoryStrip title="Addosso" items={ACCS_BODY} look={look} shown={shown} onToggle={(k, v) => setLook((l) => ({ ...l, [k]: v }))} />
          {(["palette", "pendant", "eyepatch"] as ExtraKey[]).map((k) => (
            <Strip key={k} title={EXTRA_OPTIONS[k].label} current={String(look[k] ?? "")} onPick={(id) => setX(k, id)} items={(EXTRA_OPTIONS[k].items as readonly (readonly [string, string])[]).map(([id, label]) => ({ id, label, preview: <ExtraPreview k={k} look={shown} value={id} /> }))} />
          ))}
          <Strip title="In testa" current={look.hat} onPick={(id) => set("hat", id as AvatarLook["hat"])} items={hats.map(([id, label]) => ({ id, label, preview: <AvatarFace look={{ ...shown, hat: id, frame: "nessuna" }} className="h-full w-full" /> }))} />
          <Strip title="Sopra" current={look.top} onPick={(id) => set("top", id as AvatarLook["top"])} items={[...TOPS.moderno, ...TOPS.medievale].map((t) => ({ id: t.id, label: t.label, preview: <ArcherFront look={{ ...shown, top: t.id, cape: false, lefty: false }} crop="30 70 140 170" className="h-full w-full" /> }))} />
          <Row label="Colore della veste"><Tint value={look.shirt} onPick={(c) => set("shirt", c)} quick={CLOTH_COLORS} /></Row>
          <Strip title="Sotto" current={look.bottom} onPick={(id) => set("bottom", id as AvatarLook["bottom"])} items={BOTTOM_OPTS.map(([id, label]) => ({ id, label, preview: <ArcherFront look={{ ...shown, bottom: id, cape: false, lefty: false }} crop="35 180 130 170" className="h-full w-full" /> }))} />
          <Strip title="Ai piedi" current={look.footwear} onPick={(id) => set("footwear", id as AvatarLook["footwear"])} items={FOOT_OPTS.map(([id, label]) => ({ id, label, preview: <ArcherFront look={{ ...shown, footwear: id, cape: false, lefty: false }} crop="45 250 110 110" className="h-full w-full" /> }))} />
          <Strip title="Arco" current={look.bowType} onPick={(id) => setLook((l) => ({ ...l, bowType: id, useMain: false }))} items={BOW_TYPES.map((t) => ({ id: t.id, label: t.label, preview: <span className="absolute left-[-30%] top-[-12%] w-[150%]"><ArcherAvatar look={{ ...shown, bowType: t.id, useMain: false, lefty: false }} pose="mira" still interactive={false} className="h-auto w-full" /></span> }))} />
          <p className="text-xs text-muted">Altre {Object.values(EXTRA_OPTIONS).reduce((n, o) => n + o.items.length, 0)} scelte: pitture, tatuaggi, stemmi, fantasie, cornici, faretre, penne e molto altro, in Completa.</p>
          <Button variant="ghost" onClick={() => pickMode("completa")}>Apri l'editor completo</Button>
        </Card>
      ) : null}
      {mode === "completa" ? <>
      <OptionSearch look={look} shown={shown} onPick={(h) => {
        if (h.k === "preset") { const p = AVATAR_PRESETS.find((x) => x.id === h.id); if (p) setLook((l) => presetLook(l, p.look)); return; }
        if (h.k === "top") { setLook((l) => ({ ...l, top: h.id as AvatarLook["top"], style: TOPS.medievale.some((t) => t.id === h.id) ? "medievale" : "moderno" })); return; }
        if (h.k in EXTRA_OPTIONS) { setX(h.k as ExtraKey, h.id); return; }
        setLook((l) => ({ ...l, [h.k]: h.id }));
      }} />
      <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={(() => {
            const n = (t: string) => (Object.keys(EXTRA_OPTIONS) as ExtraKey[]).filter((k) => EXTRA_OPTIONS[k].tab === t).reduce((a, k) => a + EXTRA_OPTIONS[k].items.length, 0);
            const base: Record<Tab, number> = { corpo: 4, viso: 14, barba: BEARD_OPTS.length + STACHE_OPTS.length, capelli: HAIR_OPTS.length + HAT_OPTS.length, abiti: TOPS.moderno.length + TOPS.medievale.length + BOTTOM_OPTS.length + FOOT_OPTS.length, accessori: ACCS_FACE.length + ACCS_BODY.length, attrezzatura: BOW_TYPES.length, posa: POSE_OPTS.length, scena: SCENES.length };
            const L: [Tab, string][] = [["corpo", "Corpo"], ["viso", "Viso"], ["barba", "Barba"], ["capelli", "Capelli"], ["abiti", "Abiti"], ["accessori", "Accessori"], ["attrezzatura", "Arco"], ["posa", "Posa"], ["scena", "Sfondo"]];
            return L.map(([id, label]) => ({ id, label: `${label} ${base[id] + n(id)}` }));
          })()}
        />
      </div>
      <Card className="grid gap-4">
        {tab === "corpo" ? (
          <>
            <Row label="Chi è">
              <div className="grid grid-cols-4 gap-2">
                {(["uomo", "donna", "ragazzo", "ragazza"] as const).map((b) => (
                  <Pick key={b} on={look.body === b} label={BODY_LABEL[b]} onClick={() => set("body", b)}>
                    <AvatarFace look={{ ...shown, body: b, beard: b === "uomo" ? shown.beard : "nessuna", stache: b === "uomo" ? shown.stache : "nessuno" }} className="h-14 w-14 rounded-full" />
                  </Pick>
                ))}
              </div>
            </Row>
            <Slider label="Corporatura" value={look.buildW !== "" ? tune(look.buildW, 50, 0, 100) : look.build === "snello" ? 17 : look.build === "robusto" ? 83 : 45} min={0} max={100} onChange={(v) => setLook((l) => ({ ...l, buildW: String(Math.round(v)), build: v < 30 ? "snello" : v > 70 ? "robusto" : "normale" }))} format={(v) => (v < 30 ? "Snella" : v > 70 ? "Robusta" : "Media")} ends={["Snella", "Robusta"]} />
            <Slider label="Statura" value={tune(look.stature, 50, 0, 100)} min={0} max={100} onChange={(v) => set("stature", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Più basso", "Più alto"]} />
            <Row label="Carnagione"><Tint value={look.skin} onPick={(c) => set("skin", c)} quick={SKINS} /></Row>
            <Row label="Mano dell'arco">
              <Chips value={look.lefty ? "mancino" : "destro"} onChange={(v) => set("lefty", v === "mancino")} options={[{ id: "destro", label: "Destrorso" }, { id: "mancino", label: "Mancino" }]} />
              <p className="text-xs text-muted">Il mancino tiene l'arco con la destra e tende con la sinistra: in Home tira verso sinistra.</p>
            </Row>
          </>
        ) : null}
        {tab === "viso" ? (
          <>
            <Row label="Espressione">
              <FaceGrid look={shown} current={look.expression} items={(["sorriso", "sereno", "concentrato", "deciso"] as const).map((id) => ({ id, label: cap(id), patch: { expression: id } }))} onPick={(id) => set("expression", id as AvatarLook["expression"])} />
            </Row>
            <Row label="Forma del viso">
              <FaceGrid look={shown} current={look.face} items={(["ovale", "tondo", "squadrato", "allungato"] as const).map((id) => ({ id, label: cap(id), patch: { face: id } }))} onPick={(id) => set("face", id as AvatarLook["face"])} />
            </Row>
            <Row label="Naso">
              <FaceGrid look={shown} current={look.nose} zoom items={NOSE_OPTS.map(([id, label]) => ({ id, label, patch: { nose: id } }))} onPick={(id) => set("nose", id as AvatarLook["nose"])} />
            </Row>
            <Slider label="Grandezza del naso" value={tune(look.noseSize, 50, 0, 100)} min={0} max={100} onChange={(v) => set("noseSize", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Piccolo", "Grande"]} />
            <Row label="Occhi"><Tint value={look.eyes} onPick={(c) => set("eyes", c)} quick={EYE_COLORS} /></Row>
            <Slider label="Grandezza degli occhi" value={tune(look.eyeSize, 50, 0, 100)} min={0} max={100} onChange={(v) => set("eyeSize", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Piccoli", "Grandi"]} />
            <Row label="Sopracciglia"><Chips value={look.brows} onChange={(v) => set("brows", v)} options={opts(["sottili", "normali", "folte"] as const)} /></Row>
            <Slider label="Spessore delle sopracciglia" value={tune(look.browSize, 50, 0, 100)} min={0} max={100} onChange={(v) => set("browSize", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Sottili", "Folte"]} />
            <Row label="Dettagli">
              <div className="flex flex-wrap gap-1.5">
                <Toggle on={look.freckles} label="Lentiggini" onChange={(v) => set("freckles", v)} />
                <Toggle on={look.mask} label="Maschera sul viso" onChange={(v) => set("mask", v)} />
                <Toggle on={look.warpaint} label="Pittura" onChange={(v) => set("warpaint", v)} />
                <Toggle on={look.scar} label="Cicatrice" onChange={(v) => set("scar", v)} />
              </div>
            </Row>
          </>
        ) : null}
        {tab === "barba" ? (
          <>
            <Row label="Barba">
              <FaceGrid look={shown} current={look.beard} items={BEARD_OPTS.map(([id, label]) => ({ id, label, patch: { beard: id, stache: id === "nessuna" ? "nessuno" : look.stache } }))} onPick={(id) => set("beard", id as AvatarLook["beard"])} />
            </Row>
            <Slider label="Lunghezza della barba" value={tune(look.beardLength, 50, 0, 100)} min={0} max={100} onChange={(v) => set("beardLength", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Rasata corta", "Lunga"]} />
            <Row label="Baffi (si uniscono a qualsiasi barba)">
              <FaceGrid look={shown} current={look.stache} zoom items={STACHE_OPTS.map(([id, label]) => ({ id, label, patch: { stache: id } }))} onPick={(id) => set("stache", id as AvatarLook["stache"])} />
            </Row>
            <Row label="Colore di barba e baffi">
              <Chips value={look.beardColor ? "proprio" : "capelli"} onChange={(v) => set("beardColor", v === "capelli" ? "" : look.hairColor)} options={[{ id: "capelli", label: "Come i capelli" }, { id: "proprio", label: "Scelgo io" }]} />
              {look.beardColor ? <Tint value={look.beardColor} onPick={(c) => set("beardColor", c)} quick={HAIR_COLORS} /> : null}
            </Row>
          </>
        ) : null}
        {tab === "capelli" ? (
          <>
            <Row label="Taglio">
              <FaceGrid look={{ ...shown, hat: "nessuno" }} current={look.hair} items={HAIR_OPTS.map(([id, label]) => ({ id, label, patch: { hair: id } }))} onPick={(id) => set("hair", id as AvatarLook["hair"])} />
            </Row>
            <Slider label="Lunghezza" value={tune(look.hairLength, 50, 0, 100)} min={0} max={100} onChange={(v) => set("hairLength", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Più corti", "Più lunghi"]} />
            <Slider label="Volume" value={tune(look.hairVolume, 50, 0, 100)} min={0} max={100} onChange={(v) => set("hairVolume", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Aderenti", "Gonfi"]} />
            <Row label="Colore"><Tint value={look.hairColor} onPick={(c) => set("hairColor", c)} quick={HAIR_COLORS} /></Row>
            <Row label="In testa">
              <FaceGrid look={shown} current={look.hat} items={hats.map(([id, label]) => ({ id, label, patch: { hat: id } }))} onPick={(id) => set("hat", id as AvatarLook["hat"])} />
            </Row>
            {look.hat !== "nessuno" ? <Row label="Colore del copricapo"><Tint value={look.hatColor} onPick={(c) => set("hatColor", c)} quick={CLOTH_COLORS} /></Row> : null}
            {look.hat !== "nessuno" && look.hat !== "cappuccio" ? <Slider label="Gira il copricapo sulla testa" value={tune(look.hatRot, 0, -180, 180)} min={-180} max={180} onChange={(v) => set("hatRot", String(Math.round(v)))} format={(v) => `${v}°`} ends={["Visiera dietro", "Visiera dietro"]} /> : null}
          </>
        ) : null}
        {tab === "abiti" ? (
          <>
            {mineStrip}
            <Row label="Stile">
              <Chips value={look.style} onChange={(v) => setLook((l) => ({ ...l, style: v, top: TOPS[v][0].id, bottom: v === "medievale" ? "calzamaglia" : "pantaloni", footwear: v === "medievale" ? "stivali" : "sportive" }))} options={[{ id: "moderno", label: "Moderno" }, { id: "medievale", label: "Medievale" }]} />
            </Row>
            <Row label="Sopra">
              <BodyGrid look={shown} current={look.top} items={TOPS[look.style].map((t) => ({ id: t.id, label: t.label, patch: { top: t.id } }))} onPick={(id) => set("top", id as AvatarLook["top"])} />
            </Row>
            <Slider label="Lunghezza della veste" value={tune(look.topLength, 50, 0, 100)} min={0} max={100} onChange={(v) => set("topLength", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Corta, in vita", "Lunga, al ginocchio"]} />
            <Row label="Colore"><Tint value={look.shirt} onPick={(c) => set("shirt", c)} quick={CLOTH_COLORS} /></Row>
            <Row label="Rifiniture (colletto, bordi, alamari, fasce)"><Tint value={look.trim} onPick={(c) => set("trim", c)} quick={CLOTH_COLORS} /></Row>
            <Row label="Maniche e camicia sotto"><Colors value={look.sleeves} colors={["", ...CLOTH_COLORS]} onPick={(c) => set("sleeves", c)} /></Row>
            <Row label="Sotto">
              <BodyGrid look={shown} current={look.bottom} legs items={BOTTOM_OPTS.map(([id, label]) => ({ id, label, patch: { bottom: id } }))} onPick={(id) => set("bottom", id as AvatarLook["bottom"])} />
            </Row>
            <Row label="Colore"><Tint value={look.pants} onPick={(c) => set("pants", c)} quick={["#2b3440", "#3a2a1e", "#1f3a5f", "#2a4a7a", "#4b4b4b", "#5b4a2e", "#e9e4d8", "#4b6b2e", "#3f4a2e", "#6b4a2e", "#1b1c1f", "#5a3a22"]} /></Row>
            <Row label="Ai piedi">
              <BodyGrid look={shown} current={look.footwear} feet items={FOOT_OPTS.map(([id, label]) => ({ id, label, patch: { footwear: id } }))} onPick={(id) => set("footwear", id as AvatarLook["footwear"])} />
            </Row>
            {BOOTS_TALL.includes(look.footwear) ? (
              <div className="grid gap-1">
                <Slider label="Altezza delle calzature" value={bootHeightOf(look)} min={0} max={100} onChange={(v) => set("bootHeight", String(Math.round(v)))} format={(v) => (v < 15 ? "Alla caviglia" : v < 45 ? "A metà polpaccio" : v < 80 ? "Sotto il ginocchio" : "Al ginocchio")} ends={["Bassi", "Alti"]} />
                {look.bootHeight !== "" ? <button type="button" className="aa-chip justify-self-start" onClick={() => set("bootHeight", "")}>Come il modello</button> : null}
              </div>
            ) : null}
            <Row label="Colore delle calzature"><Tint value={look.shoes} onPick={(c) => set("shoes", c)} quick={["#3a2a1e", "#14181c", "#e9e4d8", "#8a2f2f", "#2a5d8a", "#5e3b22"]} /></Row>
            <Row label="Cintura"><Chips value={look.belt} onChange={(v) => set("belt", v)} options={[{ id: "sottile", label: "Sottile" }, { id: "larga", label: "Larga con fibbia" }, { id: "nessuna", label: "Nessuna" }]} /></Row>
            {look.belt !== "nessuna" ? <Row label="Colore della cintura"><Colors value={look.beltColor} colors={["#5b3a1e", "#4a2c16", "#14181c", "#8a2f2f", "#7a4a26", "#c9a46a"]} onPick={(c) => set("beltColor", c)} /></Row> : null}
          </>
        ) : null}
        {tab === "accessori" ? (
          <>
            <AccessoryStrip title="Sul viso e in testa" items={ACCS_FACE} look={look} shown={shown} onToggle={(k, v) => setLook((l) => ({ ...l, [k]: v }))} />
            <AccessoryStrip title="Al collo, sul corpo e alle gambe" items={ACCS_BODY} look={look} shown={shown} onToggle={(k, v) => setLook((l) => ({ ...l, [k]: v }))} />
            {/* da che parte: gli accessori che stanno da un lato solo */}
            {look.pouch ? <Row label="Borsello"><Chips value={sideOf(look.pouchSide, nearSide(look))} onChange={(v) => set("pouchSide", v)} options={[{ id: "destra", label: "Fianco destro" }, { id: "sinistra", label: "Fianco sinistro" }]} /></Row> : null}
            {look.earring ? (
              <Row label="Orecchini">
                <Chips value={look.earrings === "1" ? "1" : "2"} onChange={(v) => set("earrings", v)} options={[{ id: "2", label: "Due" }, { id: "1", label: "Uno solo" }]} />
                {look.earrings === "1" ? <Chips value={sideOf(look.earringSide, nearSide(look))} onChange={(v) => set("earringSide", v)} options={[{ id: "destra", label: "Orecchio destro" }, { id: "sinistra", label: "Orecchio sinistro" }]} /> : null}
              </Row>
            ) : null}
            {look.hairFeather ? <Row label="Piuma tra i capelli"><Chips value={sideOf(look.featherSide, "sinistra")} onChange={(v) => set("featherSide", v)} options={[{ id: "destra", label: "A destra" }, { id: "sinistra", label: "A sinistra" }]} /></Row> : null}
            <Row label="Bracciali di cuoio"><Colors value={look.bracers} colors={["", "#6b4224", "#4a2c16", "#14181c", "#8a2f2f", "#c9a46a"]} onPick={(c) => set("bracers", c)} /></Row>
            {look.cape ? <Row label="Mantello"><Chips value={look.capeStyle} onChange={(v) => set("capeStyle", v)} options={[{ id: "liscio", label: "Lungo" }, { id: "frastagliato", label: "Frastagliato" }, { id: "corto", label: "Corto" }]} /></Row> : null}
            {look.cape ? <Row label="Colore del mantello"><Tint value={look.capeColor} onPick={(c) => set("capeColor", c)} quick={CLOTH_COLORS} /></Row> : null}
            {look.cowl || look.mask ? <Row label="Colore di scialle e maschera"><Tint value={look.cowlColor} onPick={(c) => set("cowlColor", c)} quick={CLOTH_COLORS} /></Row> : null}
            {look.fur ? <Row label="Colore della pelliccia"><Colors value={look.furColor} colors={["#6b5a48", "#3a2a1e", "#e9e4d8", "#8a7a6a", "#1d1d1f", "#b88a4a"]} onPick={(c) => set("furColor", c)} /></Row> : null}
            {look.sash ? <Row label="Colore della fusciacca"><Tint value={look.sashColor} onPick={(c) => set("sashColor", c)} quick={CLOTH_COLORS} /></Row> : null}
            {look.wraps ? <Row label="Colore delle fasce"><Colors value={look.wrapsColor} colors={["#6b5a48", "#7a6a52", "#d8cdb6", "#3a2a1e", "#55585a", "#8a2f2f"]} onPick={(c) => set("wrapsColor", c)} /></Row> : null}
            {look.scarf ? <Row label="Colore della sciarpa"><Tint value={look.scarfColor} onPick={(c) => set("scarfColor", c)} quick={CLOTH_COLORS} /></Row> : null}
            <Row label="Faretra"><Chips value={look.quiverPlace} onChange={(v) => set("quiverPlace", v)} options={[{ id: "fianco", label: "Al fianco" }, { id: "schiena", label: "Sulla schiena" }]} /></Row>
            <Slider label="Altezza della faretra" value={tune(look.quiverY, 0, -40, 40)} min={-40} max={40} onChange={(v) => set("quiverY", String(Math.round(v)))} format={(v) => (v === 0 ? "Normale" : v < 0 ? `${-v} più su` : `${v} più giù`)} ends={["Più su", "Più giù"]} />
            <Slider label="Rotazione della faretra" value={tune(look.quiverRot, 0, -180, 180)} min={-180} max={180} onChange={(v) => set("quiverRot", String(Math.round(v)))} format={(v) => `${v}°`} ends={["-180°", "+180°"]} />
            <Row label="Colore della faretra"><Tint value={look.quiver} onPick={(c) => set("quiver", c)} quick={["#7a4a26", "#14181c", "#2f6f62", "#8a2f2f", "#1f3a5f", "#c9a46a"]} /></Row>
          </>
        ) : null}
        {tab === "posa" ? (
          <>
            <Row label="Come sta">
              <Chips value={look.pose} onChange={(v) => set("pose", v)} options={POSE_OPTS.map(([id, label]) => ({ id, label }))} />
              <p className="text-xs text-muted">Nelle pose ferme tocca l'arciere: tende, rilascia e torna in posa.</p>
            </Row>
            <Row label="Sequenza di tiro">
              <Chips value={look.routine} onChange={(v) => set("routine", v)} options={[{ id: "completa", label: "Completa (11 tempi)" }, { id: "rapida", label: "Rapida" }, { id: "gara", label: "Da gara" }]} />
            </Row>
            <Row label="Secondi di mira all'ancoraggio">
              <Chips value={look.hold} onChange={(v) => set("hold", v)} options={["1", "2", "3", "4", "5"].map((x) => ({ id: x, label: `${x} s` }))} />
            </Row>
            <Row label="Frecce per volée">
              <Chips value={look.volley} onChange={(v) => set("volley", v)} options={["1", "3", "6"].map((x) => ({ id: x, label: x }))} />
            </Row>
          </>
        ) : null}
        {tab === "scena" ? (
          <>
            <Row label="Ambientazione (Home e profilo)">
              <div className="grid grid-cols-3 gap-2">
                {scenes.map((sc) => (
                  <button key={sc.id} type="button" aria-pressed={look.scene === sc.id} onClick={() => set("scene", sc.id)} className={`grid gap-1 rounded-2xl p-1 text-left text-[0.7rem] font-semibold ${look.scene === sc.id ? "bg-[#7cf0a8]/15 ring-2 ring-[#7cf0a8]" : "bg-white/[0.04]"}`}>
                    <SceneThumb scene={sc.id} sky={sky} className="h-14 w-full" />
                    <span className="truncate px-1">{sc.label}</span>
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Sfondo della foto profilo">
              <Chips value={look.faceBgStyle} onChange={(v) => set("faceBgStyle", v)} options={[{ id: "sfumato", label: "Sfumato" }, { id: "tinta", label: "Tinta unita" }, { id: "bersaglio", label: "Bersaglio" }, { id: "scena", label: "Come l'ambientazione" }]} />
            </Row>
            {look.faceBgStyle !== "scena" ? (
              <Row label="Colore dello sfondo (— = come la veste)"><Colors value={look.faceBg} colors={FACE_BGS} onPick={(c) => set("faceBg", c)} /></Row>
            ) : null}
            <div className="flex items-center gap-3">
              <AvatarFace look={shown} className="h-20 w-20 rounded-full ring-2 ring-white/15" />
              <p className="text-xs text-muted">Così appari nella compagnia, nelle gare e nelle classifiche (se usi il volto come foto).</p>
            </div>
          </>
        ) : null}
        {tab === "attrezzatura" ? (
          <>
            <Row label="Arco e frecce">
              <div className="flex flex-wrap gap-1.5">
                <Toggle on={look.useMain} label="Uguali alla mia attrezzatura principale" onChange={(v) => set("useMain", v)} />
              </div>
              {look.useMain && !main ? <p className="text-xs text-muted">Non hai ancora scelto l'attrezzatura principale: la scegli in Attrezzatura o in Home. Intanto valgono le scelte qui sotto.</p> : null}
            </Row>
            {!look.useMain || !main ? (
              <>
                <Row label="Tipo di arco">
                  <div className="grid grid-cols-3 gap-2">
                    {bowTypesShown(look.bowType, allBows).map((t) => (
                      <Pick key={t.id} on={look.bowType === t.id} label={t.label} onClick={() => set("bowType", t.id)}>
                        <div className="relative h-28 w-full overflow-hidden rounded-xl bg-gradient-to-b from-white/[0.06] to-transparent">
                          <div className="absolute left-[-24%] top-[-8%] w-[140%]">
                            <ArcherAvatar look={{ ...shown, bowType: t.id, useMain: false, lefty: false }} pose="mira" still interactive={false} className="h-auto w-full" />
                          </div>
                        </div>
                      </Pick>
                    ))}
                  </div>
                  {allBows ? null : (
                    <button type="button" onClick={() => setAllBows(true)} className="mt-2 rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70">
                      Altri archi: {BOW_TYPES.filter((t) => !MAIN_BOW_TYPES.includes(t.id)).map((t) => t.label.toLowerCase()).join(", ")}
                    </button>
                  )}
                </Row>
                <Row label="Riser (impugnatura)"><Colors value={look.riser} colors={GEAR_COLORS} onPick={(c) => set("riser", c)} /></Row>
                <Row label="Flettenti"><Colors value={look.limbs} colors={["#15191d", "#9b6334", "#5b3618", "#f4f1ea", "#2f6fbe", "#b02a2a", "#3d9b74", "#e6b325"]} onPick={(c) => set("limbs", c)} /></Row>
                <Row label="Penne"><Colors value={look.fletch} colors={GEAR_COLORS} onPick={(c) => set("fletch", c)} /></Row>
                <Row label="Penna guida"><Colors value={look.cock} colors={GEAR_COLORS} onPick={(c) => set("cock", c)} /></Row>
              </>
            ) : (
              <p className="text-xs text-muted">Arco: {main.bowName || "—"} · Frecce: {main.arrowName || "—"}. Togli la spunta per scegliere a mano.</p>
            )}
            <Row label="Corda"><Colors value={look.string} colors={["#f4f1ea", "#14181c", "#b02a2a", "#2f6fbe", "#e6b325", "#3fae6a"]} onPick={(c) => set("string", c)} /></Row>
            <Row label="Guantino / patella"><Colors value={look.tab} colors={["#5b3a1e", "#14181c", "#7a4a26", "#8a2f2f", "#2f6fbe", "#c9a46a"]} onPick={(c) => set("tab", c)} /></Row>
            <Row label="Parabraccio"><Colors value={look.armguard} colors={GEAR_COLORS} onPick={(c) => set("armguard", c)} /></Row>
            <Row label="Pettorina">
              <div className="flex flex-wrap gap-1.5"><Toggle on={look.chestguard} label="Indossata" onChange={(v) => set("chestguard", v)} /></div>
            </Row>
            {look.chestguard ? <Row label="Colore della pettorina"><Colors value={look.chestColor} colors={GEAR_COLORS} onPick={(c) => set("chestColor", c)} /></Row> : null}
          </>
        ) : null}
        <ExtraStrips tab={tab} look={look} shown={shown} set={setX} founder={founder} />
      </Card>
      </> : null}
      <Button variant="ghost" onClick={() => history.back()}>Fatto</Button>
    </div>
  );
}

function Page() {
  return <AvatarEditor />;
}
