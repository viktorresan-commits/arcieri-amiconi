import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AvatarScene, useAvatar } from "@/components/avatar-hero";
import { Archer3D } from "@/components/archer-3d";
import { AvatarFace } from "@/components/archer-avatar";
import { AvatarPhotoButton } from "@/components/avatar-photo";
import { BOW_TYPES } from "@/components/gear-icons";
import { Button, Card, Chips, Segmented } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { SceneBackdrop, SceneThumb } from "@/components/scene-2d";
import { ArcherFront } from "@/components/archer-front";
import { FACE_BGS, SCENES, sceneById } from "@/lib/arcieri/scenes";
import { useSky } from "@/lib/arcieri/sky3d";
import {
  AVATAR_DEFAULT,
  AVATAR_PRESETS,
  CLOTH_COLORS,
  EYE_COLORS,
  TOPS,
  GEAR_COLORS,
  HAIR_COLORS,
  SKINS,
  randomLook,
  tune,
  type AvatarLook,
} from "@/lib/arcieri/avatar";

export const Route = createFileRoute("/_app/avatar")({
  component: Page,
});

const STYLE_NAME: Record<AvatarLook["style"], string> = { moderno: "Moderno", medievale: "Medievale" };
const BODY_NAME: Record<AvatarLook["body"], string> = { uomo: "arciere", donna: "arciera", ragazzo: "giovane arciere", ragazza: "giovane arciera" };
const sceneLabel = (id: string) => sceneById(id).label;

type Tab = "corpo" | "viso" | "capelli" | "abiti" | "attrezzatura" | "posa" | "scena";

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
  return (
    <div className="grid gap-2 rounded-2xl bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-2.5">
        <span className="h-9 w-9 shrink-0 rounded-full border-2 border-white/70 shadow-[0_0_0_2px_rgba(0,0,0,.35)]" style={{ background: value }} />
        <div className="grid flex-1 gap-1.5">
          <input aria-label="Tinta" type="range" min={0} max={359} value={h} onChange={(e) => onPick(hslToHex(Number(e.target.value), Math.max(s, 18), l))} className="aa-range aa-range-hue" />
          <input aria-label="Intensità" type="range" min={0} max={100} value={s} onChange={(e) => onPick(hslToHex(h, Number(e.target.value), l))} className="aa-range" style={{ background: `linear-gradient(90deg, ${hslToHex(h, 0, l)}, ${hslToHex(h, 100, l)})` }} />
          <input aria-label="Chiaro o scuro" type="range" min={4} max={96} value={l} onChange={(e) => onPick(hslToHex(h, s, Number(e.target.value)))} className="aa-range" style={{ background: `linear-gradient(90deg, #000, ${hslToHex(h, s, 50)}, #fff)` }} />
        </div>
      </div>
      {quick ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {quick.filter(Boolean).map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => onPick(c)} className={`h-7 w-7 shrink-0 rounded-full border-2 ${value === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
          ))}
        </div>
      ) : null}
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

/** Personalizzazione dell'arciere della Home: aspetto, abiti e attrezzatura. Si salva da sé. */
function Page() {
  const { look, setLook, shown, main } = useAvatar();
  const [tab, setTab] = useState<Tab>("corpo");
  const [view, setView] = useState<"lato" | "fronte" | "3d">("lato");
  const { sky } = useSky();
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
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/60">Il tuo arciere</p>
            <p className="truncate font-display text-2xl leading-tight text-white">{STYLE_NAME[shown.style]} · {BODY_NAME[shown.body]}</p>
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
                <ArcherFront look={shown} className="h-full w-auto drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)]" />
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
        {AVATAR_PRESETS.map((p) => (
          <button key={p.id} type="button" className="aa-chip shrink-0" onClick={() => setLook((l) => ({ ...l, ...p.look }))}>{p.label}</button>
        ))}
        <button type="button" className="aa-chip shrink-0" onClick={() => setLook((l) => randomLook(l))}><Glyph name="sparkle" size={14} /> Casuale</button>
        <button type="button" className="aa-chip shrink-0" onClick={() => setLook(AVATAR_DEFAULT)}>Ricomincia</button>
      </div>
      <AvatarPhotoButton look={shown} />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { id: "corpo", label: "Corpo" },
          { id: "viso", label: "Viso" },
          { id: "capelli", label: "Capelli" },
          { id: "abiti", label: "Abiti" },
          { id: "attrezzatura", label: "Arco" },
          { id: "posa", label: "Posa" },
          { id: "scena", label: "Sfondo" },
        ]}
      />
      <Card className="grid gap-3">
        {tab === "corpo" ? (
          <>
            <Row label="Chi è">
              <Chips value={look.body} onChange={(v) => set("body", v)} options={[{ id: "uomo", label: "Uomo" }, { id: "donna", label: "Donna" }, { id: "ragazzo", label: "Ragazzo" }, { id: "ragazza", label: "Ragazza" }]} />
            </Row>
            <Row label="Corporatura"><Chips value={look.build} onChange={(v) => set("build", v)} options={opts(["snello", "normale", "robusto"] as const)} /></Row>
            <Row label="Carnagione"><Colors value={look.skin} colors={SKINS} onPick={(c) => set("skin", c)} /></Row>
            <Row label="Mano dell'arco">
              <Chips value={look.lefty ? "mancino" : "destro"} onChange={(v) => set("lefty", v === "mancino")} options={[{ id: "destro", label: "Destrorso" }, { id: "mancino", label: "Mancino" }]} />
              <p className="text-xs text-muted">Il mancino tiene l'arco con la destra e tende con la sinistra: in Home tira verso sinistra.</p>
            </Row>
          </>
        ) : null}
        {tab === "viso" ? (
          <>
            <Row label="Espressione"><Chips value={look.expression} onChange={(v) => set("expression", v)} options={opts(["sorriso", "sereno", "concentrato", "deciso"] as const)} /></Row>
            <Row label="Forma del viso"><Chips value={look.face} onChange={(v) => set("face", v)} options={opts(["ovale", "tondo", "squadrato", "allungato"] as const)} /></Row>
            <Row label="Naso"><Chips value={look.nose} onChange={(v) => set("nose", v)} options={opts(["piccolo", "dritto", "aquilino", "largo"] as const)} /></Row>
            <Row label="Occhi"><Colors value={look.eyes} colors={EYE_COLORS} onPick={(c) => set("eyes", c)} /></Row>
            <Row label="Sopracciglia"><Chips value={look.brows} onChange={(v) => set("brows", v)} options={opts(["sottili", "normali", "folte"] as const)} /></Row>
            <Row label="Barba e baffi"><Chips value={look.beard} onChange={(v) => set("beard", v)} options={opts(["nessuna", "accenno", "corta", "piena", "pizzetto", "baffi"] as const)} /></Row>
            <Row label="Dettagli">
              <div className="flex flex-wrap gap-1.5">
                <Toggle on={look.freckles} label="Lentiggini" onChange={(v) => set("freckles", v)} />
                <Toggle on={look.glasses} label="Occhiali" onChange={(v) => set("glasses", v)} />
                <Toggle on={look.earring} label="Orecchino" onChange={(v) => set("earring", v)} />
                <Toggle on={look.mask} label="Maschera sul viso" onChange={(v) => set("mask", v)} />
                <Toggle on={look.warpaint} label="Pittura" onChange={(v) => set("warpaint", v)} />
                <Toggle on={look.scar} label="Cicatrice" onChange={(v) => set("scar", v)} />
              </div>
            </Row>
          </>
        ) : null}
        {tab === "capelli" ? (
          <>
            <Row label="Taglio"><Chips value={look.hair} onChange={(v) => set("hair", v)} options={[
              { id: "corti", label: "Corti" }, { id: "spettinati", label: "Spettinati" }, { id: "rasati", label: "Rasati" }, { id: "frangia", label: "Con frangia" }, { id: "mossi", label: "Mossi" }, { id: "ricci", label: "Ricci" }, { id: "afro", label: "Afro" },
              { id: "lunghi", label: "Lunghi" }, { id: "lunghi-mossi", label: "Lunghi mossi" }, { id: "coda", label: "Coda" }, { id: "raccolti", label: "Raccolti in alto" }, { id: "chignon", label: "Chignon" },
              { id: "treccia", label: "Treccia" }, { id: "trecce", label: "Due trecce" }, { id: "codini", label: "Codini" }, { id: "caschetto", label: "Caschetto" }, { id: "cresta", label: "Cresta" }, { id: "calvo", label: "Calvo" },
            ] as { id: AvatarLook["hair"]; label: string }[]} /></Row>
            <Slider label="Lunghezza" value={tune(look.hairLength, 50, 0, 100)} min={0} max={100} onChange={(v) => set("hairLength", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Più corti", "Più lunghi"]} />
            <Row label="Colore (anche della barba)"><Tint value={look.hairColor} onPick={(c) => set("hairColor", c)} quick={HAIR_COLORS} /></Row>
            <Row label="In testa"><Chips value={look.hat} onChange={(v) => set("hat", v)} options={[{ id: "nessuno", label: "Niente" }, { id: "berretto", label: "Berretto" }, { id: "fascia", label: "Fascia" }, { id: "piuma", label: "Cappello con piuma" }, { id: "cappuccio", label: "Cappuccio" }, { id: "robin", label: "Cappello a punta" }, { id: "tesa", label: "Cappello a tesa larga" }, { id: "bandana", label: "Bandana" }, { id: "cerchietto", label: "Diadema" }, { id: "elmo", label: "Elmo" }]} /></Row>
            {look.hat !== "nessuno" || look.hair === "coda" || look.hair === "treccia" ? <Row label="Colore del copricapo / elastico"><Tint value={look.hatColor} onPick={(c) => set("hatColor", c)} quick={CLOTH_COLORS} /></Row> : null}
            {look.hat !== "nessuno" && look.hat !== "cappuccio" ? <Slider label="Rotazione del copricapo" value={tune(look.hatRot, 0, -180, 180)} min={-180} max={180} onChange={(v) => set("hatRot", String(Math.round(v)))} format={(v) => `${v}°`} ends={["-180°", "+180°"]} /> : null}
          </>
        ) : null}
        {tab === "abiti" ? (
          <>
            <Row label="Stile">
              <Chips value={look.style} onChange={(v) => setLook((l) => ({ ...l, style: v, top: TOPS[v][0].id, bottom: v === "medievale" ? "calzamaglia" : "pantaloni", footwear: v === "medievale" ? "stivali" : "sportive" }))} options={[{ id: "moderno", label: "Moderno" }, { id: "medievale", label: "Medievale" }]} />
            </Row>
            <Row label="Sopra"><Chips value={look.top} onChange={(v) => set("top", v)} options={TOPS[look.style]} /></Row>
            <Slider label="Lunghezza della veste" value={tune(look.topLength, 50, 0, 100)} min={0} max={100} onChange={(v) => set("topLength", String(Math.round(v)))} format={(v) => `${v}%`} ends={["Corta, in vita", "Lunga, al ginocchio"]} />
            <Row label="Colore"><Tint value={look.shirt} onPick={(c) => set("shirt", c)} quick={CLOTH_COLORS} /></Row>
            <Row label="Rifiniture (colletto, bordi, alamari)"><Colors value={look.trim} colors={CLOTH_COLORS} onPick={(c) => set("trim", c)} /></Row>
            <Row label="Maniche e camicia sotto"><Colors value={look.sleeves} colors={["", ...CLOTH_COLORS]} onPick={(c) => set("sleeves", c)} /></Row>
            <Row label="Sotto"><Chips value={look.bottom} onChange={(v) => set("bottom", v)} options={[{ id: "pantaloni", label: "Pantaloni" }, { id: "jeans", label: "Jeans" }, { id: "pantaloncini", label: "Pantaloncini" }, { id: "calzamaglia", label: "Calzamaglia" }, { id: "brache", label: "Brache" }, { id: "larghi", label: "Pantaloni larghi" }]} /></Row>
            <Row label="Colore"><Tint value={look.pants} onPick={(c) => set("pants", c)} quick={["#2b3440", "#3a2a1e", "#1f3a5f", "#2a4a7a", "#4b4b4b", "#5b4a2e", "#e9e4d8", "#4b6b2e", "#3f4a2e", "#6b4a2e", "#1b1c1f", "#5a3a22"]} /></Row>
            <Row label="Ai piedi"><Chips value={look.footwear} onChange={(v) => set("footwear", v)} options={[{ id: "sportive", label: "Scarpe sportive" }, { id: "stivaletti", label: "Stivaletti" }, { id: "stivali", label: "Stivali" }, { id: "stivali-risvolto", label: "Stivali con risvolto" }, { id: "stivali-alti", label: "Stivali alti" }, { id: "sandali", label: "Sandali" }]} /></Row>
            <Row label="Cintura"><Chips value={look.belt} onChange={(v) => set("belt", v)} options={[{ id: "sottile", label: "Sottile" }, { id: "larga", label: "Larga con fibbia" }, { id: "nessuna", label: "Nessuna" }]} /></Row>
            {look.belt !== "nessuna" ? <Row label="Colore della cintura"><Colors value={look.beltColor} colors={["#5b3a1e", "#4a2c16", "#14181c", "#8a2f2f", "#7a4a26", "#c9a46a"]} onPick={(c) => set("beltColor", c)} /></Row> : null}
            <Row label="Bracciali di cuoio"><Colors value={look.bracers} colors={["", "#6b4224", "#4a2c16", "#14181c", "#8a2f2f", "#c9a46a"]} onPick={(c) => set("bracers", c)} /></Row>
            <Row label="Colore"><Colors value={look.shoes} colors={["#3a2a1e", "#14181c", "#e9e4d8", "#8a2f2f", "#2a5d8a", "#5e3b22"]} onPick={(c) => set("shoes", c)} /></Row>
            <Row label="Accessori">
              <div className="flex flex-wrap gap-1.5">
                <Toggle on={look.cape} label="Mantello" onChange={(v) => set("cape", v)} />
                <Toggle on={look.scarf} label="Sciarpa" onChange={(v) => set("scarf", v)} />
                <Toggle on={look.necklace} label="Collana" onChange={(v) => set("necklace", v)} />
                <Toggle on={look.pouch} label="Borsello" onChange={(v) => set("pouch", v)} />
                <Toggle on={look.gloves} label="Guanti" onChange={(v) => set("gloves", v)} />
                <Toggle on={look.cowl} label="Scialle a cappuccio" onChange={(v) => set("cowl", v)} />
                <Toggle on={look.fur} label="Pelliccia sulle spalle" onChange={(v) => set("fur", v)} />
                <Toggle on={look.sash} label="Fusciacca" onChange={(v) => set("sash", v)} />
                <Toggle on={look.straps} label="Cinghie incrociate" onChange={(v) => set("straps", v)} />
                <Toggle on={look.wraps} label="Fasce alle gambe" onChange={(v) => set("wraps", v)} />
              </div>
            </Row>
            {look.cape ? <Row label="Mantello"><Chips value={look.capeStyle} onChange={(v) => set("capeStyle", v)} options={[{ id: "liscio", label: "Lungo" }, { id: "frastagliato", label: "Frastagliato" }, { id: "corto", label: "Corto" }]} /></Row> : null}
            {look.cape ? <Row label="Colore del mantello"><Tint value={look.capeColor} onPick={(c) => set("capeColor", c)} quick={CLOTH_COLORS} /></Row> : null}
            {look.cowl || look.mask ? <Row label="Colore di scialle e maschera"><Colors value={look.cowlColor} colors={CLOTH_COLORS} onPick={(c) => set("cowlColor", c)} /></Row> : null}
            {look.fur ? <Row label="Colore della pelliccia"><Colors value={look.furColor} colors={["#6b5a48", "#3a2a1e", "#e9e4d8", "#8a7a6a", "#1d1d1f", "#b88a4a"]} onPick={(c) => set("furColor", c)} /></Row> : null}
            {look.sash ? <Row label="Colore della fusciacca"><Colors value={look.sashColor} colors={CLOTH_COLORS} onPick={(c) => set("sashColor", c)} /></Row> : null}
            {look.wraps ? <Row label="Colore delle fasce"><Colors value={look.wrapsColor} colors={["#6b5a48", "#7a6a52", "#d8cdb6", "#3a2a1e", "#55585a", "#8a2f2f"]} onPick={(c) => set("wrapsColor", c)} /></Row> : null}
            {look.scarf ? <Row label="Colore della sciarpa"><Colors value={look.scarfColor} colors={CLOTH_COLORS} onPick={(c) => set("scarfColor", c)} /></Row> : null}
            <Row label="Faretra"><Chips value={look.quiverPlace} onChange={(v) => set("quiverPlace", v)} options={[{ id: "fianco", label: "Al fianco" }, { id: "schiena", label: "Sulla schiena" }]} /></Row>
            <Slider label="Rotazione della faretra" value={tune(look.quiverRot, 0, -180, 180)} min={-180} max={180} onChange={(v) => set("quiverRot", String(Math.round(v)))} format={(v) => `${v}°`} ends={["-180°", "+180°"]} />
            <Row label="Colore della faretra"><Tint value={look.quiver} onPick={(c) => set("quiver", c)} quick={["#7a4a26", "#14181c", "#2f6f62", "#8a2f2f", "#1f3a5f", "#c9a46a"]} /></Row>
          </>
        ) : null}
        {tab === "posa" ? (
          <>
            <Row label="Come sta">
              <Chips value={look.pose} onChange={(v) => set("pose", v)} options={[{ id: "animata", label: "Tira in continuo" }, { id: "riposo", label: "Posizione" }, { id: "incocco", label: "Incocca" }, { id: "mira", label: "Mira" }, { id: "accompagna", label: "Accompagna" }, { id: "saluto", label: "Saluto" }, { id: "vittoria", label: "Vittoria" }, { id: "fiero", label: "Fiero" }]} />
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
                {SCENES.map((sc) => (
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
              <p className="text-xs text-muted">Così appari in squadra, nelle gare e nelle classifiche (se usi il volto come foto).</p>
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
                <Row label="Tipo di arco"><Chips value={look.bowType} onChange={(v) => set("bowType", v)} options={BOW_TYPES.map((t) => ({ id: t.id, label: t.label }))} /></Row>
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
      </Card>
      <Button variant="ghost" onClick={() => history.back()}>Fatto</Button>
    </div>
  );
}
