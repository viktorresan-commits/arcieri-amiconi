import { useState, type ReactNode } from "react";
import { INKS, WEEK_GOALS, usePrefs, type Prefs } from "@/lib/arcieri/prefs";
import { AppIcon, Glyph } from "./icons";
import { cx } from "./kit";
import { ShortcutEditor } from "./shortcuts";

/** Riga di scelta: etichetta a sinistra, opzioni a pillola a destra. Ogni tocco salva da solo. */
function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-hair py-3 last:border-0">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {sub ? <p className="text-[0.7rem] text-muted">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Pills<T extends string | number>({ value, options, onChange }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="aa-seg w-full !grid-flow-col">
      {options.map((o) => (
        <button key={String(o.id)} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 py-1.5 text-left text-sm" aria-pressed={on}>
      {label}
      <span className={cx("grid h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-primary" : "bg-white/15")}>
        <span className={cx("h-6 w-6 rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "")} />
      </span>
    </button>
  );
}

/** Contenuto di "Personalizza": usato nel foglio del Menu e nel Profilo. */
export function PersonalizePanel() {
  const { prefs, update } = usePrefs();
  const [shortcuts, setShortcuts] = useState(false);
  const home = (k: keyof Prefs["home"], v: boolean) => update({ home: { ...prefs.home, [k]: v } });
  return (
    <div className="grid">
      <Row title="Colore dell'app">
        <div className="flex gap-2">
          {INKS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => update({ ink: item.id })}
              aria-pressed={prefs.ink === item.id}
              className={cx("grid flex-1 justify-items-center gap-1 rounded-xl border py-2 text-[0.65rem] font-semibold transition", prefs.ink === item.id ? "border-white/40 bg-white/[0.07]" : "border-transparent")}
            >
              <span className="h-7 w-7 rounded-full shadow-inner" style={{ background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${item.color} 60%, white), ${item.color})` }} />
              {item.label}
            </button>
          ))}
        </div>
      </Row>
      <Row title="Icone" sub="Oggetti realistici: a tema prendono il colore dell'app, colorate distinguono le sezioni. Sobrie: solo il disegno a linee.">
        <Pills
          value={prefs.icons}
          onChange={(icons) => update({ icons })}
          options={[
            { id: "tema", label: "A tema" },
            { id: "colori", label: "Colorate" },
            { id: "sobrie", label: "Sobrie" },
          ]}
        />
        <div className="flex justify-center gap-3 pt-1">
          {(["bow", "camera", "chart", "ballistics", "trophy"] as const).map((n, i) => (
            <AppIcon key={n} name={n} color={["#2c8a57", "#2b74c9", "#1b9097", "#cc4f3b", "#c39320"][i]} size={38} />
          ))}
        </div>
      </Row>
      <Row title="Animazioni">
        <Pills value={prefs.motion} onChange={(motion) => update({ motion })} options={[{ id: "piena", label: "Complete" }, { id: "ridotta", label: "Ridotte" }]} />
      </Row>
      <Row title="Sfondi" sub="Una scena sfocata per ogni sezione, che scorre piano con la pagina.">
        <Pills value={prefs.scenes} onChange={(scenes) => update({ scenes })} options={[{ id: "si", label: "Accesi" }, { id: "no", label: "Spenti" }]} />
      </Row>
      <Row title="Obiettivo della settimana" sub="Frecce da tirare da lunedì a domenica.">
        <Pills value={prefs.weekGoal} onChange={(weekGoal) => update({ weekGoal })} options={WEEK_GOALS.map((g) => ({ id: g, label: String(g) }))} />
      </Row>
      <Row title="Cosa vedere in Home">
        <div className="grid">
          <Toggle label="Scorciatoie «In un tocco»" on={prefs.home.shortcuts} onChange={(v) => home("shortcuts", v)} />
          <Toggle label="Il tuo percorso (livello, serie, settimana)" on={prefs.home.journey} onChange={(v) => home("journey", v)} />
          <Toggle label="Consigli «Lo sapevi?»" on={prefs.home.tips} onChange={(v) => home("tips", v)} />
          <Toggle label="I numeri del mese" on={prefs.home.numbers} onChange={(v) => home("numbers", v)} />
          <Toggle label="Ultime frecce" on={prefs.home.arrows} onChange={(v) => home("arrows", v)} />
        </div>
        <button type="button" className="aa-chip justify-self-start" onClick={() => setShortcuts(true)}>
          <Glyph name="edit" size={14} /> Scegli e ordina le scorciatoie
        </button>
      </Row>
      {shortcuts ? <ShortcutEditor onClose={() => setShortcuts(false)} /> : null}
    </div>
  );
}

/** Foglio a scomparsa con le preferenze. */
export function PersonalizeSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div className="aa-sheet grid max-h-[88dvh] w-full gap-1 overflow-y-auto rounded-t-3xl border-t border-hair bg-elev px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between">
          <p className="aa-section-title">Personalizza</p>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-white/5" onClick={onClose} aria-label="Chiudi">
            <Glyph name="close" size={18} />
          </button>
        </div>
        <PersonalizePanel />
      </div>
    </div>
  );
}
