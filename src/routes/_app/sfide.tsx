import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { challengeBoard, listChallenges, respondChallenge, saveChallenge } from "@/lib/arcieri/club.api";
import { listRoster } from "@/lib/arcieri/members.api";
import { BOWS, DISCIPLINES, memberLabel } from "@/lib/arcieri/labels";
import { fmtAvg, fmtPct } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, Empty, ErrorNote, Field, HoldDelete, Loading, PageHead, Select, TextInput } from "@/components/kit";
import { useMember } from "@/components/shell";

export const Route = createFileRoute("/_app/sfide")({ component: Page });

function Page() {
  const { me } = useMember();
  const [nonce, setNonce] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const list = useLoad(`ch-${nonce}`, () => listChallenges());
  const roster = useLoad("roster-sfide", () => listRoster());
  const board = useLoad(openId ? `board-${openId}-${nonce}` : "board-none", () => (openId ? challengeBoard({ data: { id: openId } }) : Promise.resolve(null)));
  const [form, setForm] = useState({ title: "", startsOn: "", endsOn: "", metric: "avg", arrows: "30", distanceM: "18", bowType: "olimpico", face: "wa10", discipline: "indoor", openJoin: true });
  const [err, setErr] = useState("");
  return (
    <div className="grid gap-3">
      <PageHead title="Sfide" lede="Stesse frecce, stesso arco, stessa distanza, stesso bersaglio. Altrimenti non è una sfida, è un racconto." />
      <Card className="grid gap-2">
        <Field label="Titolo"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dal"><TextInput type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></Field>
          <Field label="Al"><TextInput type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} /></Field>
        </div>
        <Select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
          <option value="avg">Miglior media sulle frecce indicate</option>
          <option value="total">Punteggio più alto sulle frecce indicate</option>
          <option value="tens">Più 10 nel periodo</option>
          <option value="sessions">Più allenamenti validi</option>
          <option value="improvement">Miglioramento rispetto al periodo prima</option>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <TextInput value={form.arrows} onChange={(e) => setForm({ ...form, arrows: e.target.value })} placeholder="Frecce" />
          <TextInput value={form.distanceM} onChange={(e) => setForm({ ...form, distanceM: e.target.value })} placeholder="Distanza" />
        </div>
        <Select value={form.bowType} onChange={(e) => setForm({ ...form, bowType: e.target.value })}>{BOWS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
        <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>{DISCIPLINES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</Select>
        <Select value={form.face} onChange={(e) => setForm({ ...form, face: e.target.value })}>
          <option value="wa10">WA 10</option>
          <option value="field6">Field</option>
          <option value="threed">3D</option>
        </Select>
        <label className="text-sm"><input type="checkbox" checked={form.openJoin} onChange={(e) => setForm({ ...form, openJoin: e.target.checked })} /> Aperta a tutto il gruppo</label>
        {err ? <ErrorNote text={err} /> : null}
        <Button onClick={() => saveChallenge({ data: { ...form, arrows: form.metric === "sessions" || form.metric === "improvement" ? "" : Number(form.arrows), distanceM: Number(form.distanceM), invites: (roster.data ?? []).map((p) => p.userId).filter((id): id is string => Boolean(id) && !form.openJoin) } }).then(() => setNonce((n) => n + 1)).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"))}>Lancia</Button>
      </Card>
      {list.loading ? <Loading /> : null}
      {list.data && list.data.length === 0 ? <Empty title="Nessuna sfida" text="Lanciane una con regole strette, non un 'chi tira di più'." /> : null}
      {(list.data ?? []).map((ch) => {
        const canDrop = !ch.cancelled && (ch.mine || me.role === "admin");
        const card = (
          <Card key={ch.id} className="grid gap-2">
            <h2 className="break-words font-display text-2xl leading-tight">{ch.title}</h2>
            <p className="text-sm text-muted">{ch.startsOn} → {ch.endsOn} · {ch.rules.metric} · {ch.rules.arrows ?? "—"} frecce · {ch.rules.distanceM} m{ch.cancelled ? " · annullata" : ""}</p>
            <div className="flex flex-wrap gap-2">
              {ch.state === "invited" ? <Button onClick={() => respondChallenge({ data: { id: ch.id, action: "accept", teamName: "" } }).then(() => setNonce((n) => n + 1))}>Accetta</Button> : null}
              {ch.state === "invited" ? <Button variant="ghost" onClick={() => respondChallenge({ data: { id: ch.id, action: "decline", teamName: "" } }).then(() => setNonce((n) => n + 1))}>Rifiuta</Button> : null}
              {ch.openJoin && ch.state !== "accepted" ? <Button variant="ghost" onClick={() => respondChallenge({ data: { id: ch.id, action: "join", teamName: "" } }).then(() => setNonce((n) => n + 1))}>Entra</Button> : null}
              <Button variant="ghost" onClick={() => setOpenId(ch.id)}>Classifica</Button>
            </div>
          </Card>
        );
        if (!canDrop) return <div key={ch.id}>{card}</div>;
        return (
          <HoldDelete
            key={ch.id}
            label="Eliminare questa sfida?"
            onDelete={() => respondChallenge({ data: { id: ch.id, action: "cancel", teamName: "" } }).then(() => setNonce((n) => n + 1))}
          >
            {card}
          </HoldDelete>
        );
      })}
      {board.data ? (
        <Card>
          <h2 className="font-display text-2xl">{board.data.title}</h2>
          {board.data.rows.length === 0 ? <p className="text-sm text-muted">Nessun allenamento rispetta ancora le regole.</p> : null}
          <ul className="mt-2 grid gap-1 text-sm">
            {board.data.rows.map((r) => (
              <li key={r.userId}>{r.position}. {memberLabel(r, board.data?.rows ?? [])} · {board.data?.rule.metric === "improvement" ? fmtPct(r.value) : board.data?.rule.metric === "avg" ? fmtAvg(r.value) : Math.round(r.value)}</li>
            ))}
          </ul>
          {board.data.teams.length ? <p className="mt-2 text-xs text-muted">Squadre in media, non in somma: {board.data.teams.map((t) => `${t.team} ${fmtAvg(t.value)}`).join(" · ")}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
