import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { deleteGoal, listGadgets, listGoals, saveGoal } from "@/lib/arcieri/club.api";
import { memberLabel } from "@/lib/arcieri/labels";
import { fmtAvg } from "@/lib/arcieri/scoring";
import { fmtDay } from "@/lib/arcieri/time";
import { useLoad } from "@/lib/arcieri/use-load";
import { useMember } from "@/components/shell";
import { Button, Card, ErrorNote, Field, Loading, PageHead, Select, TextInput } from "@/components/kit";
import { PrizeMark, prizeTier } from "@/components/prize-mark";

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
      {(data?.goals ?? []).map((g) => {
        const pct = Math.min(100, g.target ? (g.progress / g.target) * 100 : 0);
        const label = g.metric === "avg" ? `${fmtAvg(g.progress)} / ${fmtAvg(g.target)}` : `${Math.round(g.progress)} / ${g.target}`;
        return (
          <Card key={g.id}>
            <p className="font-semibold">{g.title}{g.collective ? " · gruppo" : ""}</p>
            <p className="text-sm text-muted tabular-nums">{label}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
            {g.mine || me.role === "admin" ? <button type="button" className="mt-2 text-xs text-danger" onClick={() => deleteGoal({ data: { id: g.id } }).then(() => setNonce((n) => n + 1))}>Elimina</button> : null}
          </Card>
        );
      })}
      <h2 className="font-display text-3xl">Premi</h2>
      <div className="grid grid-cols-2 gap-2">
        {(gadgets.data?.prizes ?? []).map((prize) => {
          const mine = prize.holders.some((holder) => holder.userId === me.userId);
          return (
            <Card key={prize.code} className={`p-3 ${mine ? "border-accent" : "opacity-60"}`}>
              <PrizeMark code={prize.code} locked={!mine} />
              <p className="mt-2 font-semibold">{prize.title}</p>
              <p className="text-xs text-muted">{[prizeTier(prize.code).label, mine ? "Sbloccato" : prize.hint].filter(Boolean).join(" · ")}</p>
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
      <h2 className="font-display text-3xl">Albo</h2>
      <ul className="grid gap-1 text-sm">
        {(data?.albo ?? []).map((b, i) => <li key={`${b.title}-${i}`}>{b.title} · {memberLabel(b, data?.albo ?? [])}</li>)}
      </ul>
    </div>
  );
}
