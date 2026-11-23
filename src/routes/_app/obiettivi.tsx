import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { deleteGoal, listGadgets, listGoals, saveGoal } from "@/lib/arcieri/club.api";
import { memberLabel } from "@/lib/arcieri/labels";
import { fmtAvg } from "@/lib/arcieri/scoring";
import { fmtDay } from "@/lib/arcieri/time";
import { useLoad } from "@/lib/arcieri/use-load";
import { useMember } from "@/components/shell";
import { Button, Card, ErrorNote, Field, Loading, PageHead, Select, TextInput } from "@/components/kit";
import { MetalCoin, PrizeMark, prizeTier } from "@/components/prize-mark";
import { Confetti, Sparkle } from "@/components/celebrate";
import { AppIcon, Glyph, type IconName } from "@/components/icons";

export const Route = createFileRoute("/_app/obiettivi")({ component: Page });

function Page() {
  const { me } = useMember();
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useLoad(`g-${nonce}`, () => listGoals());
  const gadgets = useLoad(`prizes-${nonce}`, () => listGadgets());
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState("arrows");
  const [target, setTarget] = useState("100");
  const [collective, setCollective] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="grid gap-3">
      <PageHead title="Obiettivi" lede="Le medaglie premiano anche il salto di media e i giorni diversi, non solo il mucchio di frecce." />
      <Card className="grid gap-2">
        <Field label="Obiettivo"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
          <option value="arrows">Frecce</option>
          <option value="sessions">Allenamenti</option>
          <option value="days">Giorni diversi</option>
          <option value="avg">Media</option>
        </Select>
        <TextInput value={target} onChange={(e) => setTarget(e.target.value)} />
        {me.role === "admin" ? <label className="text-sm"><input type="checkbox" checked={collective} onChange={(e) => setCollective(e.target.checked)} /> Di tutto il gruppo</label> : null}
        {err ? <ErrorNote text={err} /> : null}
        <Button onClick={() => saveGoal({ data: { title, metric, target: Number(target), collective, bowType: "", distanceM: null } }).then(() => setNonce((n) => n + 1)).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"))}>Aggiungi</Button>
      </Card>
      {loading ? <Loading /> : null}
      <div className="grid gap-2">
        {(data?.goals ?? []).map((g, i) => {
          const pct = Math.min(100, g.target ? (g.progress / g.target) * 100 : 0);
          const label = g.metric === "avg" ? `${fmtAvg(g.progress)} / ${fmtAvg(g.target)}` : `${Math.round(g.progress)} / ${g.target}`;
          const done = pct >= 100;
          const C = 2 * Math.PI * 24;
          const icon: IconName = g.metric === "arrows" ? "quiver" : g.metric === "sessions" ? "bow" : g.metric === "days" ? "calendar" : "chart";
          return (
            <Card key={g.id} className={`aa-prize relative flex items-center gap-3 ${done ? "aa-prize-on" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
              {done ? <Confetti count={14} /> : null}
              <div className="relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center">
                <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="5" />
                  <circle cx="28" cy="28" r="24" fill="none" stroke={done ? "#e2b340" : "var(--primary)"} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)" }} />
                </svg>
                {/* moneta del traguardo: bronzo all'inizio, argento a metà strada, oro raggiunto (platino se di gruppo) */}
                <MetalCoin metal={done ? (g.collective ? "platinum" : "gold") : pct >= 50 ? "silver" : "bronze"} icon={done ? "trophy" : icon} size={50} ribbon={false} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{g.title}{g.collective ? " · gruppo" : ""}</p>
                <p className="text-sm tabular-nums text-muted">{label} · {Math.round(pct)}%</p>
                {done ? <p className="text-xs font-semibold text-amber-300">Raggiunto!</p> : null}
                {g.mine || me.role === "admin" ? <button type="button" className="mt-1 text-xs text-danger" onClick={() => deleteGoal({ data: { id: g.id } }).then(() => setNonce((n) => n + 1))}>Elimina</button> : null}
              </div>
            </Card>
          );
        })}
      </div>
      {(() => {
        const prizes = gadgets.data?.prizes ?? [];
        const got = prizes.filter((p) => p.holders.some((h) => h.userId === me.userId)).length;
        return (
          <div className="flex items-end justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-3xl"><AppIcon name="trophy" size={34} />Premi</h2>
            {prizes.length ? (
              <div className="grid min-w-32 gap-1 text-right">
                <span className="text-xs text-muted">{got} di {prizes.length} sbloccati</span>
                <span className="h-2 overflow-hidden rounded-full bg-white/10"><span className="aa-grow block h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-600" style={{ width: `${(got / prizes.length) * 100}%` }} /></span>
              </div>
            ) : null}
          </div>
        );
      })()}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[...(gadgets.data?.prizes ?? [])]
          .sort((a, b) => Number(b.holders.some((h) => h.userId === me.userId)) - Number(a.holders.some((h) => h.userId === me.userId)))
          .map((prize, i) => {
            const mine = prize.holders.some((holder) => holder.userId === me.userId);
            return (
              <Card key={prize.code} className={`aa-prize relative grid justify-items-center p-3 text-center ${mine ? "aa-prize-on border-accent" : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
                <div className={mine ? "" : "aa-prize-off"}><PrizeMark code={prize.code} locked={!mine} /></div>
                {!mine ? <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/40"><Glyph name="lock" size={12} /></span> : <Sparkle size={10} className="aa-twinkle absolute right-3 top-3" />}
                <p className="mt-2 font-semibold leading-tight">{prize.title}</p>
                <p className="text-xs text-muted">{[prizeTier(prize.code).label, mine ? "Sbloccato" : prize.hint].filter(Boolean).join(" · ")}</p>
                {prize.holders.length ? <p className="mt-1 text-[0.65rem] text-muted">{prize.holders.length} nel gruppo</p> : null}
              </Card>
            );
          })}
      </div>
      {(data?.badges ?? []).length ? (
        <div className="grid gap-2">
          {(data?.badges ?? []).map((b) => (
            <Card key={b.code} className="p-3"><p className="font-semibold">{b.title}</p><p className="text-xs text-muted">{fmtDay(b.unlockedAt)}</p></Card>
          ))}
        </div>
      ) : null}
      <h2 className="flex items-center gap-2 font-display text-3xl"><AppIcon name="book" size={32} />Albo</h2>
      <Card className="grid gap-1">
        {(data?.albo ?? []).map((b, i) => (
          <div key={`${b.title}-${i}`} className="aa-menu-row flex items-center gap-2 border-b border-white/5 py-1.5 text-sm last:border-0" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <span className="shrink-0"><MetalCoin metal="gold" icon="trophy" size={26} ribbon={false} /></span>
            <span className="min-w-0 flex-1 truncate">{b.title}</span>
            <span className="text-xs text-muted">{memberLabel(b, data?.albo ?? [])}</span>
          </div>
        ))}
        {!(data?.albo ?? []).length ? <p className="text-sm text-muted">Ancora vuoto.</p> : null}
      </Card>
    </div>
  );
}
