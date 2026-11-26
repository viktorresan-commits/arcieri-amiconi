import { useEffect, useState } from "react";
import { BowOptions } from "@/components/bow-options";
import { createFileRoute } from "@tanstack/react-router";
import { challengeBoard, listChallenges, respondChallenge, saveChallenge } from "@/lib/arcieri/club.api";
import { listRoster } from "@/lib/arcieri/members.api";
import { BOWS, DISCIPLINES, memberLabel } from "@/lib/arcieri/labels";
import { fmtAvg, fmtPct } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { GAME_LEVELS, GAME_MODES } from "@/lib/arcieri/game-modes";
import { KINDS, KIND_ORDER, type ActivityKind } from "@/lib/arcieri/kinds";
import { METRICS_BY_KIND, metricInfo, ruleKind, type Rule } from "@/lib/arcieri/challenge";
import { Button, Card, Empty, ErrorNote, Field, HoldDelete, Loading, PageHead, Select, TextInput, cx } from "@/components/kit";
import { KindChip, KindEmblem, KindHeading } from "@/components/kind-emblem";
import { Insignia } from "@/components/insignia";
import { useMember } from "@/components/shell";
import { ComparePanel } from "@/components/compare-panel";

export const Route = createFileRoute("/_app/sfide")({ component: Page });

const dayIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDay = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "");

/** la regola in parole: "miglior media · 30 frecce · 18 m · Olimpico" */
function ruleText(rule: Rule) {
  const kind = ruleKind(rule);
  const m = metricInfo(rule).short;
  if (kind === "minigioco") {
    const mode = GAME_MODES.find((x) => x.id === rule.gameMode)?.label ?? rule.gameMode ?? "";
    const level = GAME_LEVELS.find((x) => x.id === rule.gameLevel)?.label ?? rule.gameLevel ?? "";
    return [m, mode, level].filter(Boolean).join(" · ");
  }
  if (kind === "campionato") return `${m} · gare del calendario`;
  const bow = BOWS.find((b) => b.id === rule.bowType)?.label ?? rule.bowType;
  return [m, rule.arrows ? `${rule.arrows} frecce` : "", rule.distanceM != null ? `${rule.distanceM} m` : "", bow].filter(Boolean).join(" · ");
}

function valueText(rule: Rule, v: number) {
  const id = metricInfo(rule).id;
  if (id === "improvement") return fmtPct(v);
  if (id === "avg") return fmtAvg(v);
  if (id === "rank") return `${Math.round(v)}°`;
  return String(Math.round(v));
}

const EMPTY = { title: "", startsOn: "", endsOn: "", metric: "avg", arrows: "30", distanceM: "18", bowType: "tradizionale", face: "wa10", discipline: "indoor", gameMode: "fita", gameLevel: "normale", openJoin: true };

function Page() {
  const { me } = useMember();
  const [nonce, setNonce] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [kind, setKind] = useState<ActivityKind>("allenamento");
  const [filter, setFilter] = useState<ActivityKind | "tutte">("tutte");
  const list = useLoad(`ch-${nonce}`, () => listChallenges());
  const roster = useLoad("roster-sfide", () => listRoster());
  const board = useLoad(openId ? `board-${openId}-${nonce}` : "board-none", () => (openId ? challengeBoard({ data: { id: openId } }) : Promise.resolve(null)));
  // da Gareggia › Confronta (o dal vecchio indirizzo /confronta) si arriva qui con #confronta: scende alla sezione
  useEffect(() => {
    if (window.location.hash !== "#confronta") return;
    const t = window.setTimeout(() => document.getElementById("confronta")?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => window.clearTimeout(t);
  }, []);
  const today = new Date();
  const [form, setForm] = useState({ ...EMPTY, startsOn: dayIso(today), endsOn: dayIso(new Date(today.getTime() + 7 * 86_400_000)) });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const k = KINDS[kind];
  const metrics = METRICS_BY_KIND[kind];
  const metric = metrics.some((m) => m.id === form.metric) ? form.metric : metrics[0].id;
  const all = list.data ?? [];
  const shown = filter === "tutte" ? all : all.filter((ch) => ruleKind(ch.rules) === filter);

  const launch = async () => {
    setErr("");
    setBusy(true);
    try {
      await saveChallenge({
        data: {
          ...form,
          kind,
          metric,
          arrows: kind !== "allenamento" || metric === "sessions" || metric === "improvement" ? "" : Number(form.arrows),
          distanceM: kind === "allenamento" ? Number(form.distanceM) : "",
          invites: (roster.data ?? []).map((p) => p.userId).filter((id): id is string => Boolean(id) && !form.openJoin),
        },
      });
      setForm((f) => ({ ...f, title: "" }));
      setNonce((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <PageHead title="Sfide" lede="Tre tipi di sfida, mai mescolati: gare di campionato, allenamenti e minigioco. Regole uguali per tutti." />
      <Card className="grid gap-3">
        <p className="text-sm font-semibold">Che sfida lanci?</p>
        <div className="grid grid-cols-3 gap-2">
          {KIND_ORDER.map((id) => {
            const on = id === kind;
            const info = KINDS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setKind(id);
                  setForm((f) => ({ ...f, metric: METRICS_BY_KIND[id][0].id }));
                }}
                aria-pressed={on}
                className={cx("grid justify-items-center gap-1.5 rounded-2xl px-1.5 pb-2.5 pt-3 text-center transition", on ? "bg-white/[0.07]" : "bg-white/[0.025] opacity-75")}
                style={on ? { boxShadow: `inset 0 0 0 1.5px ${info.color}`, background: info.tint } : undefined}
              >
                <KindEmblem key={on ? `${id}-on` : id} kind={id} size={58} glow={on} pop={on} />
                <span className="text-[0.8rem] font-semibold leading-tight" style={{ color: on ? info.color : undefined }}>
                  {info.long}
                </span>
              </button>
            );
          })}
        </div>
        <p className="-mt-1 text-xs text-muted">{k.hint}</p>
        <Field label="Titolo">
          <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={kind === "campionato" ? "Es. Chi fa più punti nel campionato invernale" : kind === "minigioco" ? "Es. Re del bersaglio mobile" : "Es. Media a 18 m"} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dal">
            <TextInput type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
          </Field>
          <Field label="Al">
            <TextInput type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} />
          </Field>
        </div>
        <Field label="Cosa conta">
          <Select value={metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        {kind === "allenamento" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Frecce">
                <TextInput value={form.arrows} onChange={(e) => setForm({ ...form, arrows: e.target.value })} inputMode="numeric" />
              </Field>
              <Field label="Distanza (m)">
                <TextInput value={form.distanceM} onChange={(e) => setForm({ ...form, distanceM: e.target.value })} inputMode="decimal" />
              </Field>
            </div>
            <Field label="Arco">
              <Select value={form.bowType} onChange={(e) => setForm({ ...form, bowType: e.target.value })}>
                <BowOptions />
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Disciplina">
                <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
                  {DISCIPLINES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Bersaglio">
                <Select value={form.face} onChange={(e) => setForm({ ...form, face: e.target.value })}>
                  <option value="wa10">WA 10</option>
                  <option value="field6">Field</option>
                  <option value="threed">3D</option>
                </Select>
              </Field>
            </div>
          </>
        ) : null}
        {kind === "minigioco" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Bersaglio del gioco">
                <Select value={form.gameMode} onChange={(e) => setForm({ ...form, gameMode: e.target.value })}>
                  {GAME_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Livello">
                <Select value={form.gameLevel} onChange={(e) => setForm({ ...form, gameLevel: e.target.value })}>
                  {GAME_LEVELS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="rounded-xl px-3 py-2 text-xs" style={{ background: k.tint, color: k.color }}>
              Valgono i giri giocati nel gioco della Home fra le due date. Sono punti per divertirsi: non entrano nelle medie, nelle statistiche e nei record veri.
            </p>
          </>
        ) : null}
        {kind === "campionato" ? (
          <p className="rounded-xl px-3 py-2 text-xs" style={{ background: k.tint, color: k.color }}>
            Valgono i punteggi messi nelle gare del calendario fra le due date (anche quelli portati dal portale FITAST).
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.openJoin} onChange={(e) => setForm({ ...form, openJoin: e.target.checked })} /> Aperta a tutto il gruppo
        </label>
        {err ? <ErrorNote text={err} /> : null}
        <Button disabled={busy || form.title.trim().length < 3} onClick={() => void launch()}>
          Lancia la sfida
        </Button>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={cx("aa-chip", filter === "tutte" && "border-white/40")} onClick={() => setFilter("tutte")}>
          Tutte ({all.length})
        </button>
        {KIND_ORDER.map((id) => {
          const n = all.filter((ch) => ruleKind(ch.rules) === id).length;
          return (
            <button key={id} type="button" onClick={() => setFilter(id)} className={cx("rounded-full transition", filter === id ? "ring-1 ring-white/50" : "opacity-80")}>
              <KindChip kind={id} suffix={`(${n})`} className="pr-3" />
            </button>
          );
        })}
      </div>

      {list.loading ? <Loading /> : null}
      {list.data && shown.length === 0 ? <Empty title="Nessuna sfida" text={filter === "tutte" ? "Lanciane una con regole strette, non un 'chi tira di più'." : `Nessuna sfida di tipo ${KINDS[filter].long.toLowerCase()}.`} /> : null}
      {shown.map((ch) => {
        const ck = ruleKind(ch.rules);
        const info = KINDS[ck];
        const canDrop = !ch.cancelled && (ch.mine || me.role === "admin");
        const card = (
          <Card key={ch.id} className="grid gap-2" style={{ boxShadow: `inset 3px 0 0 ${info.color}` }}>
            <div className="flex items-start gap-3">
              <KindEmblem kind={ck} size={52} />
              <div className="min-w-0 flex-1">
                <KindChip kind={ck} />
                <h2 className="mt-1 break-words font-display text-2xl leading-tight">{ch.title}</h2>
                <p className="text-sm text-muted">
                  {fmtDay(ch.startsOn)} → {fmtDay(ch.endsOn)} · {ruleText(ch.rules)}
                  {ch.cancelled ? " · annullata" : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ch.state === "invited" ? <Button onClick={() => respondChallenge({ data: { id: ch.id, action: "accept", teamName: "" } }).then(() => setNonce((n) => n + 1))}>Accetta</Button> : null}
              {ch.state === "invited" ? (
                <Button variant="ghost" onClick={() => respondChallenge({ data: { id: ch.id, action: "decline", teamName: "" } }).then(() => setNonce((n) => n + 1))}>
                  Rifiuta
                </Button>
              ) : null}
              {ch.openJoin && ch.state !== "accepted" ? (
                <Button variant="ghost" onClick={() => respondChallenge({ data: { id: ch.id, action: "join", teamName: "" } }).then(() => setNonce((n) => n + 1))}>
                  Entra
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setOpenId(ch.id)}>
                Classifica
              </Button>
            </div>
          </Card>
        );
        if (!canDrop) return <div key={ch.id}>{card}</div>;
        return (
          <HoldDelete key={ch.id} label="Eliminare questa sfida?" onDelete={() => respondChallenge({ data: { id: ch.id, action: "cancel", teamName: "" } }).then(() => setNonce((n) => n + 1))}>
            {card}
          </HoldDelete>
        );
      })}

      {board.data ? (
        <Card className="grid gap-3">
          <KindHeading kind={ruleKind(board.data.rule)} title={board.data.title} sub={ruleText(board.data.rule)} />
          {board.data.rows.length === 0 ? (
            <p className="text-sm text-muted">
              {ruleKind(board.data.rule) === "minigioco" ? "Nessun giro del gioco con queste regole, per ora." : ruleKind(board.data.rule) === "campionato" ? "Nessun punteggio di gara nel periodo, per ora." : "Nessun allenamento rispetta ancora le regole."}
            </p>
          ) : null}
          <ul className="grid gap-1.5">
            {board.data.rows.map((r) => (
              <li key={r.userId} className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-2.5 py-2">
                {r.position <= 3 ? (
                  <Insignia symbol="star" shape="round" metal={r.position === 1 ? "gold" : r.position === 2 ? "silver" : "bronze"} enamel={r.position === 1 ? "ruby" : r.position === 2 ? "sapphire" : "emerald"} size={34} glow={r.position === 1} />
                ) : (
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-white/[0.07] text-sm font-semibold tabular-nums">{r.position}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{memberLabel(r, board.data?.rows ?? [])}</span>
                <span className="font-display text-xl tabular-nums">{valueText(board.data!.rule, r.value)}</span>
              </li>
            ))}
          </ul>
          {board.data.teams.length ? <p className="text-xs text-muted">Squadre in media, non in somma: {board.data.teams.map((t) => `${t.team} ${valueText(board.data!.rule, t.value)}`).join(" · ")}</p> : null}
        </Card>
      ) : null}

      {/* Confronta: tu e i compagni, e due tuoi allenamenti a fianco */}
      <section id="confronta" className="scroll-mt-[calc(env(safe-area-inset-top)+8.5rem)]">
        <ComparePanel />
      </section>
    </div>
  );
}
