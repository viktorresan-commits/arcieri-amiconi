import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { RealIcon } from "@/components/real-icons";
import { useLocalState } from "@/lib/arcieri/local-store";
import { DRILLS, drillOfDay } from "@/lib/arcieri/learn";
import { award, levelOf, today, useXp } from "@/lib/arcieri/xp";

export const Route = createFileRoute("/_app/sfida-giorno")({ component: Page });

/** Un esercizio nuovo ogni giorno: fatto = punti e la serie di giorni cresce. */
function Page() {
  const [st, setSt] = useLocalState<{ done: string[] }>("aa-sfida-giorno-v1", { done: [] });
  const xp = useXp();
  const d = drillOfDay();
  const day = today();
  const done = st.done.includes(day);
  // serie: giorni consecutivi fino a oggi (o ieri, se oggi non è ancora fatta)
  let streak = 0;
  const probe = new Date();
  if (!done) probe.setDate(probe.getDate() - 1);
  while (st.done.includes(probe.toLocaleDateString("sv-SE"))) {
    streak += 1;
    probe.setDate(probe.getDate() - 1);
  }
  const lv = levelOf(xp.xp);
  const week = Array.from({ length: 7 }, (_, i) => {
    const x = new Date();
    x.setDate(x.getDate() - (6 - i));
    const k = x.toLocaleDateString("sv-SE");
    return { k, on: st.done.includes(k), label: x.toLocaleDateString("it-IT", { weekday: "narrow" }) };
  });
  return (
    <div className="grid gap-3">
      <PageHead kicker="Impara" title="Sfida del giorno" lede="Un esercizio diverso ogni giorno. Fallo e segnalo: punti e serie crescono." />
      <Card className="aa-daily grid gap-3">
        <div className="flex items-start gap-3">
          <RealIcon name="daily" size={60} />
          <div className="min-w-0">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">{d.kind} · +{d.xp} punti</p>
            <p className="font-display text-2xl leading-tight">{d.title}</p>
          </div>
        </div>
        <p className="text-sm">{d.how}</p>
        <button
          type="button"
          disabled={done}
          onClick={() => {
            setSt({ done: [...st.done, day].slice(-120) });
            award(d.xp, d.title, `sfida-${day}`);
          }}
          className={`aa-press flex min-h-12 items-center justify-center gap-2 rounded-2xl font-semibold ${done ? "bg-emerald-500/20 text-emerald-200" : "bg-primary text-primary-fg"}`}
        >
          <Glyph name="check" size={18} strokeWidth={2.4} /> {done ? "Fatta, torna domani" : "L'ho fatta"}
        </button>
      </Card>
      <Card className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Serie: {streak} {streak === 1 ? "giorno" : "giorni"}</p>
          <p className="text-xs text-muted">Livello {lv.level} · {xp.xp} punti</p>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((w) => (
            <div key={w.k} className="grid justify-items-center gap-1">
              <span className={`grid h-9 w-9 place-items-center rounded-full ${w.on ? "bg-amber-400 text-black" : "bg-white/[0.06] text-muted"}`}>{w.on ? <Glyph name="flame" size={16} /> : null}</span>
              <span className="text-[0.62rem] uppercase text-muted">{w.label}</span>
            </div>
          ))}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-700" style={{ width: `${(lv.into / lv.need) * 100}%` }} />
        </div>
        <p className="text-[0.7rem] text-muted">Al livello {lv.level + 1} mancano {lv.need - lv.into} punti. Quiz, giochi ed esercizi danno punti anche loro.</p>
      </Card>
      <Card className="grid gap-1">
        <p className="aa-section-title mb-1">Tutte le sfide</p>
        {DRILLS.map((x) => (
          <p key={x.id} className={`text-sm ${x.id === d.id ? "font-semibold text-primary" : "text-muted"}`}>{x.title}</p>
        ))}
      </Card>
    </div>
  );
}
