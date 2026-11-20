import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AvatarScene, useAvatar } from "@/components/avatar-hero";
import { Archer3D, RealFace } from "@/components/archer-3d";
import { BOW_TYPES } from "@/components/gear-icons";
import { Button, Card, Chips, PageHead, Segmented } from "@/components/kit";
import { Glyph } from "@/components/icons";
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
  type AvatarLook,
} from "@/lib/arcieri/avatar";

export const Route = createFileRoute("/_app/avatar")({
  component: Page,
});

type Tab = "corpo" | "viso" | "capelli" | "abiti" | "attrezzatura" | "posa";

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
        <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => onPick(c)} className={`h-9 w-9 rounded-full border-2 ${value === c ? "border-white shadow-[0_0_0_2px_rgba(0,0,0,0.4)]" : "border-transparent"}`} style={{ background: c }} />
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

/** Personalizzazione dell'arciere della Home: aspetto, abiti e attrezzatura. Si salva da sé. */
function Page() {
  const { look, setLook, shown, main } = useAvatar();
  const [tab, setTab] = useState<Tab>("corpo");
  const [in3d, setIn3d] = useState(false);
  const set = <K extends keyof AvatarLook>(k: K, v: AvatarLook[K]) => setLook((l) => ({ ...l, [k]: v }));
  const opts = <T extends string>(list: readonly T[]) => list.map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }));

  return (
    <div className="grid gap-3">
      <PageHead kicker="Home" title="Il tuo arciere" lede="Aspetto, abiti e attrezzatura. Le modifiche si salvano da sole e compaiono in Home." />
      <div className="sticky top-16 z-10">
        <div className="relative">
          {in3d ? (
            <Archer3D look={shown} height="h-64" />
          ) : (
            <AvatarScene look={shown} height="h-64">
              <span className="absolute left-3 top-3 grid h-16 w-16 place-items-center overflow-hidden rounded-full ring-2 ring-[#ffd27a]/80">
                <RealFace look={shown} className="h-16 w-16" />
              </span>
            </AvatarScene>
          )}
          <button type="button" aria-pressed={in3d} onClick={() => setIn3d((x) => !x)} className={`absolute right-2 top-2 z-10 min-h-9 rounded-full px-3 text-xs font-bold backdrop-blur ${in3d ? "bg-[#7cf0a8] text-[#0b120e]" : "bg-black/55 text-white"}`}>
            {in3d ? "Vista 2D" : "Vista 3D"}
          </button>
        </div>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {AVATAR_PRESETS.map((p) => (
          <button key={p.id} type="button" className="aa-chip shrink-0" onClick={() => setLook((l) => ({ ...l, ...p.look }))}>{p.label}</button>
        ))}
        <button type="button" className="aa-chip shrink-0" onClick={() => setLook((l) => randomLook(l))}><Glyph name="sparkle" size={14} /> Casuale</button>
        <button type="button" className="aa-chip shrink-0" onClick={() => setLook(AVATAR_DEFAULT)}>Ricomincia</button>
      </div>
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
              </div>
            </Row>
          </>
        ) : null}
        {tab === "capelli" ? (
          <>
            <Row label="Taglio"><Chips value={look.hair} onChange={(v) => set("hair", v)} options={opts(["corti", "rasati", "mossi", "ricci", "lunghi", "coda", "chignon", "treccia", "codini", "caschetto", "cresta", "calvo"] as const)} /></Row>
            <Row label="Colore (anche della barba)"><Colors value={look.hairColor} colors={HAIR_COLORS} onPick={(c) => set("hairColor", c)} /></Row>
            <Row label="In testa"><Chips value={look.hat} onChange={(v) => set("hat", v)} options={[{ id: "nessuno", label: "Niente" }, { id: "berretto", label: "Berretto" }, { id: "fascia", label: "Fascia" }, { id: "piuma", label: "Cappello con piuma" }, { id: "cappuccio", label: "Cappuccio" }, { id: "elmo", label: "Elmo" }]} /></Row>
            {look.hat !== "nessuno" || look.hair === "coda" || look.hair === "treccia" ? <Row label="Colore del copricapo / elastico"><Colors value={look.hatColor} colors={CLOTH_COLORS} onPick={(c) => set("hatColor", c)} /></Row> : null}
          </>
        ) : null}
        {tab === "abiti" ? (
          <>
            <Row label="Stile">
              <Chips value={look.style} onChange={(v) => setLook((l) => ({ ...l, style: v, top: TOPS[v][0].id, bottom: v === "medievale" ? "calzamaglia" : "pantaloni", footwear: v === "medievale" ? "stivali" : "sportive" }))} options={[{ id: "moderno", label: "Moderno" }, { id: "medievale", label: "Medievale" }]} />
            </Row>
            <Row label="Sopra"><Chips value={look.top} onChange={(v) => set("top", v)} options={TOPS[look.style]} /></Row>
            <Row label="Colore"><Colors value={look.shirt} colors={CLOTH_COLORS} onPick={(c) => set("shirt", c)} /></Row>
            <Row label="Rifiniture (colletto, bordi, maglia sotto)"><Colors value={look.trim} colors={CLOTH_COLORS} onPick={(c) => set("trim", c)} /></Row>
            <Row label="Sotto"><Chips value={look.bottom} onChange={(v) => set("bottom", v)} options={[{ id: "pantaloni", label: "Pantaloni" }, { id: "jeans", label: "Jeans" }, { id: "pantaloncini", label: "Pantaloncini" }, { id: "calzamaglia", label: "Calzamaglia" }]} /></Row>
            <Row label="Colore"><Colors value={look.pants} colors={["#2b3440", "#3a2a1e", "#1f3a5f", "#2a4a7a", "#4b4b4b", "#5b4a2e", "#e9e4d8", "#4b6b2e"]} onPick={(c) => set("pants", c)} /></Row>
            <Row label="Ai piedi"><Chips value={look.footwear} onChange={(v) => set("footwear", v)} options={[{ id: "sportive", label: "Scarpe sportive" }, { id: "stivaletti", label: "Stivaletti" }, { id: "stivali", label: "Stivali" }]} /></Row>
            <Row label="Colore"><Colors value={look.shoes} colors={["#3a2a1e", "#14181c", "#e9e4d8", "#8a2f2f", "#2a5d8a", "#5e3b22"]} onPick={(c) => set("shoes", c)} /></Row>
            <Row label="Accessori">
              <div className="flex flex-wrap gap-1.5">
                <Toggle on={look.cape} label="Mantello" onChange={(v) => set("cape", v)} />
                <Toggle on={look.scarf} label="Sciarpa" onChange={(v) => set("scarf", v)} />
                <Toggle on={look.necklace} label="Collana" onChange={(v) => set("necklace", v)} />
                <Toggle on={look.pouch} label="Borsello" onChange={(v) => set("pouch", v)} />
              </div>
            </Row>
            {look.cape ? <Row label="Colore del mantello"><Colors value={look.capeColor} colors={CLOTH_COLORS} onPick={(c) => set("capeColor", c)} /></Row> : null}
            {look.scarf ? <Row label="Colore della sciarpa"><Colors value={look.scarfColor} colors={CLOTH_COLORS} onPick={(c) => set("scarfColor", c)} /></Row> : null}
            <Row label="Faretra"><Chips value={look.quiverPlace} onChange={(v) => set("quiverPlace", v)} options={[{ id: "fianco", label: "Al fianco" }, { id: "schiena", label: "Sulla schiena" }]} /></Row>
            <Row label="Colore della faretra"><Colors value={look.quiver} colors={["#7a4a26", "#14181c", "#2f6f62", "#8a2f2f", "#1f3a5f", "#c9a46a"]} onPick={(c) => set("quiver", c)} /></Row>
          </>
        ) : null}
        {tab === "posa" ? (
          <Row label="Come sta in Home">
            <Chips value={look.pose} onChange={(v) => set("pose", v)} options={[{ id: "animata", label: "Tira in continuo" }, { id: "riposo", label: "A riposo" }, { id: "allungo", label: "In allungo" }, { id: "vittoria", label: "Vittoria" }, { id: "fiero", label: "Fiero" }]} />
            <p className="text-xs text-muted">Nelle pose ferme tocca l'arciere: scocca una freccia verso il paglione.</p>
          </Row>
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
