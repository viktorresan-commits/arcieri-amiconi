import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { avatarChallenge } from "@/lib/arcieri/challenge.api";
import { coachNotes, groupWhere, volleyEstimate, type Form } from "@/lib/arcieri/coach";
import { useLoad } from "@/lib/arcieri/use-load";
import { AvatarFace } from "./archer-avatar";
import { Glyph } from "./icons";
import { Avatar, Card, ErrorNote, Loading, cx } from "./kit";

type Data = Awaited<ReturnType<typeof avatarChallenge>>;
type Row = Data["rows"][number];

const PARTS: { id: keyof Row["parts"]; label: string; how: string }[] = [
  { id: "precisione", label: "Precisione", how: "Sale con la media delle tue ultime 60 frecce." },
  { id: "costanza", label: "Costanza", how: "Sale quando le frecce finiscono vicine tra loro." },
  { id: "allenamento", label: "Allenamento", how: "Giorni di tiro negli ultimi 30 (al massimo con 12)." },
  { id: "frecce", label: "Frecce", how: "Frecce registrate negli ultimi 30 giorni (al massimo con 600)." },
  { id: "gare", label: "Gare", how: "Gare negli ultimi 4 mesi (al massimo con 4)." },
];

function daysLeft(iso: string | null) {
  if (!iso) return "";
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d <= 0 ? "scade oggi" : d === 1 ? "scade domani" : `ancora ${d} giorni`;
}

/** I privilegi: si sbloccano con l'attività vera e scadono, per tenerli bisogna continuare. */
export function PerkList({ perks, compact = false }: { perks: Data["perks"]; compact?: boolean }) {
  const icon: Record<string, Parameters<typeof Glyph>[0]["name"]> = { fuoco: "flame", aura: "sparkle", stendardo: "flag", corona: "trophy" };
  const tint: Record<string, string> = { fuoco: "#ff8a3d", aura: "#ffd27a", stendardo: "#7cf0a8", corona: "#ffcf5a" };
  return (
    <ul className={cx("grid gap-2", compact ? "grid-cols-2" : "")}>
      {perks.map((p) => (
        <li key={p.id} className={cx("aa-perk relative overflow-hidden rounded-2xl p-3", p.active ? "is-on" : "")} style={{ "--c": tint[p.id] } as CSSProperties}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: p.active ? tint[p.id] : "rgb(255 255 255 / 0.08)", color: p.active ? "#1a1408" : tint[p.id] }}>
              <Glyph name={icon[p.id]} size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">{p.label}</span>
              <span className="block text-[0.68rem] text-muted">{p.active ? daysLeft(p.until) : "da sbloccare"}</span>
            </span>
          </div>
          {!compact ? <p className="mt-1.5 text-xs text-muted">{p.active ? p.text : p.goal}</p> : null}
          {!p.active ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${Math.round(p.progress * 100)}%`, background: tint[p.id] }} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** "Il tuo arciere tira come te": dove vanno le frecce, cosa migliorare, la stima e i privilegi. */
export function CoachCard({ form, perks, lefty, look }: { form: Form; perks: Data["perks"]; lefty: boolean; look: AvatarLook }) {
  const notes = coachNotes(form, lefty);
  const est = volleyEstimate(form);
  const where = groupWhere(form);
  const first = notes[0];
  return (
    <Card className="aa-coach grid gap-3">
      <div className="flex items-center gap-3">
        <AvatarFace look={look} className="h-12 w-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Il tuo arciere tira come te</p>
          <p className="text-sm font-semibold leading-tight">
            {form.n >= 6 ? `Ultime ${form.n} frecce · media ${form.avg.toFixed(1).replace(".", ",")}${where ? ` · gruppo ${where}` : ""}` : "Ancora pochi dati"}
          </p>
        </div>
        {est != null ? (
          <div className="grid shrink-0 justify-items-center rounded-2xl bg-white/[0.06] px-2.5 py-1.5">
            <span className="font-display text-2xl leading-none tabular-nums">{est}</span>
            <span className="text-[0.58rem] text-muted">stima 3 frecce</span>
          </div>
        ) : null}
      </div>
      <div className={cx("rounded-2xl p-3", first.tone === "warn" ? "bg-[#ff8a3d]/12" : first.tone === "ok" ? "bg-[#7cf0a8]/12" : "bg-white/[0.05]")}>
        <p className="text-sm font-semibold">{first.title}</p>
        <p className="mt-0.5 text-xs text-muted">{first.tip}</p>
        {notes.length > 1 ? <p className="mt-1.5 text-[0.68rem] text-muted">Altro: {notes.slice(1).map((n) => n.title.toLowerCase()).join(" · ")}</p> : null}
      </div>
      <PerkList perks={perks} compact />
    </Card>
  );
}

/** La sfida degli avatar: la forza di ogni arciere nasce dai suoi dati veri. */
export function AvatarChallenge({ looks }: { looks: Record<string, AvatarLook> }) {
  const { data, error, loading } = useLoad("avatar-challenge", () => avatarChallenge());
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  const me = data.rows.find((r) => r.userId === data.meId);
  const weakest = me ? [...PARTS].sort((a, b) => me.parts[a.id] - me.parts[b.id])[0] : null;
  const podium = data.rows.slice(0, 3);
  return (
    <div className="grid gap-3">
      <Card className="aa-duel-hero relative overflow-hidden" style={{ "--c": data.company.color } as CSSProperties}>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/70">{data.company.name}</p>
        <h2 className="font-display text-3xl leading-none">Sfida degli avatar</h2>
        <p className="mt-1 text-xs text-white/75">Ogni arciere è forte quanto i dati veri di chi lo guida: precisione, costanza, allenamenti, frecce e gare.</p>
        <div className="mt-4 grid grid-cols-3 items-end gap-2">
          {[podium[1], podium[0], podium[2]].map((r, i) =>
            r ? (
              <div key={r.userId} className={cx("aa-duel-step grid justify-items-center gap-1 text-center", i === 1 ? "is-first" : "")} style={{ animationDelay: `${i * 120}ms` }}>
                {data.crownId === r.userId ? <Glyph name="trophy" size={16} className="text-[#ffcf5a]" /> : <span className="h-4" />}
                {looks[r.userId] ? <AvatarFace look={looks[r.userId]} className={cx("rounded-full", i === 1 ? "h-20 w-20" : "h-14 w-14")} /> : <Avatar label={r.name} color={r.color} photo={r.photoUrl} size={i === 1 ? "xl" : "lg"} />}
                <p className="w-full truncate text-xs font-semibold">{r.name}</p>
                <div className={cx("grid w-full place-items-center rounded-t-xl bg-white/10 font-display tabular-nums", i === 1 ? "h-16 text-3xl" : "h-10 text-2xl")}>{r.power}</div>
              </div>
            ) : <span key={i} />,
          )}
        </div>
      </Card>

      {me ? (
        <Card className="grid gap-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-2xl">Il tuo arciere</h3>
            <span className="font-display text-3xl tabular-nums">{me.power}<span className="text-sm text-muted">/100</span></span>
          </div>
          <ul className="grid gap-2">
            {PARTS.map((p) => (
              <li key={p.id} className="grid gap-1">
                <div className="flex justify-between text-xs"><span className="font-semibold">{p.label}</span><span className="tabular-nums text-muted">{me.parts[p.id]}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="aa-duel-bar h-full rounded-full" style={{ width: `${me.parts[p.id]}%`, background: p.id === weakest?.id ? "#ff8a3d" : "var(--primary)" }} />
                </div>
              </li>
            ))}
          </ul>
          {weakest ? <p className="rounded-2xl bg-[#ff8a3d]/12 p-3 text-xs"><b>Per salire:</b> lavora su {weakest.label.toLowerCase()}. {weakest.how}</p> : null}
        </Card>
      ) : null}

      <Card className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-2xl">Privilegi</h3>
          <span className="text-xs text-muted">si sbloccano tirando, poi scadono</span>
        </div>
        <PerkList perks={data.perks} />
        <div className="grid gap-1 rounded-2xl bg-white/[0.04] p-3">
          <div className="flex justify-between text-xs"><span className="font-semibold">Frecce della compagnia in settimana</span><span className="tabular-nums">{data.teamWeek}/{data.teamGoal}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#7cf0a8]" style={{ width: `${Math.min(100, (data.teamWeek / data.teamGoal) * 100)}%` }} /></div>
        </div>
      </Card>

      <Card className="grid gap-1.5">
        <h3 className="font-display text-2xl">Classifica</h3>
        {data.rows.map((r, i) => (
          <Link key={r.userId} to="/arciere/$id" params={{ id: String(r.memberId) }} className={cx("flex items-center gap-3 rounded-2xl p-2", r.userId === data.meId ? "bg-primary/15" : "bg-white/[0.03]")}>
            <span className="w-6 text-center font-display text-lg tabular-nums text-muted">{i + 1}</span>
            {looks[r.userId] ? <AvatarFace look={looks[r.userId]} className="h-10 w-10 rounded-full" /> : <Avatar label={r.name} color={r.color} photo={r.photoUrl} />}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 truncate text-sm font-semibold">{r.name}{data.crownId === r.userId ? <Glyph name="trophy" size={13} className="text-[#ffcf5a]" /> : null}</span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-primary" style={{ width: `${r.power}%` }} /></span>
            </span>
            <span className="font-display text-xl tabular-nums">{r.power}</span>
          </Link>
        ))}
        {data.rows.every((r) => r.shots < 6) ? <p className="text-xs text-muted">Ancora pochi dati: ogni allenamento registrato rende gli avatar più forti.</p> : null}
      </Card>
    </div>
  );
}
