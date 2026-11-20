import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AvatarScene, useAvatar } from "@/components/avatar-hero";
import { BOW_TYPES } from "@/components/gear-icons";
import { Button, Card, Chips, PageHead, Segmented } from "@/components/kit";
import { Glyph } from "@/components/icons";
import {
  AVATAR_DEFAULT,
  AVATAR_PRESETS,
  CLOTH_COLORS,
  EYE_COLORS,
  GEAR_COLORS,
  HAIR_COLORS,
  SKINS,
  randomLook,
  type AvatarLook,
} from "@/lib/arcieri/avatar";

export const Route = createFileRoute("/_app/avatar")({
  component: Page,
});

type Tab = "corpo" | "viso" | "capelli" | "abiti" | "attrezzatura";

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
  const set = <K extends keyof AvatarLook>(k: K, v: AvatarLook[K]) => setLook((l) => ({ ...l, [k]: v }));
  const opts = <T extends string>(list: readonly T[]) => list.map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }));

  return (
    <div className="grid gap-3">
      <PageHead kicker="Home" title="Il tuo arciere" lede="Aspetto, abiti e attrezzatura. Le modifiche si salvano da sole e compaiono in Home." />
      <div className="sticky top-2 z-10">
        <AvatarScene look={shown} height="h-64" />
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
        ]}
      />
      <Card className="grid gap-3">
        {tab === "corpo" ? (
          <>
            <Row label="Chi è">
              <Chips value={look.body} onChange={(v) => set("body", v)} options={[{ id: "uomo", label: "Uomo" }, { id: "donna", label: "Donna" }, { id: "ragazzo", label: "Ragazzo/a" }]} />
            </Row>
            <Row label="Carnagione"><Colors value={look.skin} colors={SKINS} onPick={(c) => set("skin", c)} /></Row>
          </>
        ) : null}
        {tab === "viso" ? (
          <>
            <Row label="Forma del viso"><Chips value={look.face} onChange={(v) => set("face", v)} options={opts(["ovale", "tondo", "squadrato"] as const)} /></Row>
            <Row label="Occhi"><Colors value={look.eyes} colors={EYE_COLORS} onPick={(c) => set("eyes", c)} /></Row>
            <Row label="Sopracciglia"><Chips value={look.brows} onChange={(v) => set("brows", v)} options={opts(["sottili", "normali", "folte"] as const)} /></Row>
            <Row label="Barba e baffi"><Chips value={look.beard} onChange={(v) => set("beard", v)} options={opts(["nessuna", "accenno", "corta", "piena", "pizzetto", "baffi"] as const)} /></Row>
            <Row label="Dettagli">
              <div className="flex flex-wrap gap-1.5">
                <Toggle on={look.freckles} label="Lentiggini" onChange={(v) => set("freckles", v)} />
                <Toggle on={look.glasses} label="Occhiali" onChange={(v) => set("glasses", v)} />
              </div>
            </Row>
          </>
        ) : null}
        {tab === "capelli" ? (
          <>
            <Row label="Taglio"><Chips value={look.hair} onChange={(v) => set("hair", v)} options={opts(["corti", "rasati", "mossi", "ricci", "lunghi", "coda", "chignon", "treccia", "calvo"] as const)} /></Row>
            <Row label="Colore (anche della barba)"><Colors value={look.hairColor} colors={HAIR_COLORS} onPick={(c) => set("hairColor", c)} /></Row>
            <Row label="In testa"><Chips value={look.hat} onChange={(v) => set("hat", v)} options={[{ id: "nessuno", label: "Niente" }, { id: "berretto", label: "Berretto" }, { id: "fascia", label: "Fascia" }, { id: "piuma", label: "Cappello con piuma" }]} /></Row>
            {look.hat !== "nessuno" || look.hair === "coda" || look.hair === "treccia" ? <Row label="Colore del copricapo / elastico"><Colors value={look.hatColor} colors={CLOTH_COLORS} onPick={(c) => set("hatColor", c)} /></Row> : null}
          </>
        ) : null}
        {tab === "abiti" ? (
          <>
            <Row label="Maglia"><Colors value={look.shirt} colors={CLOTH_COLORS} onPick={(c) => set("shirt", c)} /></Row>
            <Row label="Pantaloni"><Colors value={look.pants} colors={["#2b3440", "#3a2a1e", "#1f3a5f", "#4b4b4b", "#5b4a2e", "#e9e4d8", "#4b6b2e"]} onPick={(c) => set("pants", c)} /></Row>
            <Row label="Scarpe"><Colors value={look.shoes} colors={["#3a2a1e", "#14181c", "#e9e4d8", "#8a2f2f", "#2a5d8a"]} onPick={(c) => set("shoes", c)} /></Row>
            <Row label="Faretra"><Colors value={look.quiver} colors={["#7a4a26", "#14181c", "#2f6f62", "#8a2f2f", "#1f3a5f", "#c9a46a"]} onPick={(c) => set("quiver", c)} /></Row>
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
