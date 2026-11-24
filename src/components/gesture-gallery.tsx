import { IconTitle, StatusMark } from "./icons";
import { useState } from "react";
import { bestGestures, deleteGesture, listGestures, type GestureRow } from "@/lib/arcieri/gesture.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { Card, Loading } from "@/components/kit";
import { Anatomy3D } from "./anatomy-3d";
import { drawCmOf, postureOf, readRecord, unpackLm } from "@/lib/arcieri/gesture-record";
import { AREA_LABEL } from "@/lib/arcieri/pose-pro";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "2-digit" });
};
function checksOf(r: GestureRow): string[] {
  try {
    const d = JSON.parse(r.data) as { checks?: unknown };
    return Array.isArray(d.checks) ? d.checks.map(String) : [];
  } catch {
    return [];
  }
}

const deg = (v: number | null, d = 0) => (v == null ? "—" : `${v.toFixed(d)}°`);

function ScoreBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">foto</span>;
  const color = value >= 70 ? "#3ee08f" : value >= 50 ? "#e6b325" : "#d15c56";
  return <span className="rounded-full px-2 py-0.5 text-xs font-bold text-[#04140c]" style={{ background: color }}>{value}</span>;
}

/** Le mie analisi del gesto: galleria, dettaglio completo con il 3D, andamento e confronto fra due analisi. */
export function GestureGallery({ reloadKey = 0 }: { reloadKey?: number }) {
  const [nonce, setNonce] = useState(0);
  const list = useLoad(`gest-${nonce}-${reloadKey}`, () => listGestures());
  const [open, setOpen] = useState<number | null>(null);
  const [pick, setPick] = useState<number[]>([]);
  const rows = list.data ?? [];
  const scored = rows.filter((r) => r.score != null).slice().reverse();
  const a = rows.find((r) => r.id === pick[0]);
  const b = rows.find((r) => r.id === pick[1]);
  const sel = rows.find((r) => r.id === open) ?? null;

  return (
    <div className="grid gap-3">
      {list.loading ? <Loading /> : null}
      {!list.loading && !rows.length ? <Card><p className="text-sm text-muted">Nessuna analisi salvata, per ora. Fai un'analisi e tocca «Salva»: compare qui con tutti i dati.</p></Card> : null}
      {sel ? <GestureDetail row={sel} onClose={() => setOpen(null)} onDelete={() => deleteGesture({ data: { id: sel.id } }).then(() => { setOpen(null); setNonce((n) => n + 1); })} /> : null}
      {scored.length >= 2 ? <Card><Trend rows={scored} /></Card> : null}
      {a && b ? <Card><Compare a={a} b={b} onClose={() => setPick([])} /></Card> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.id} className={`overflow-hidden rounded-xl border ${open === r.id ? "border-[#5fd4ff]" : pick.includes(r.id) ? "border-accent" : "border-line"} bg-elev`}>
            <button type="button" onClick={() => { setOpen(open === r.id ? null : r.id); if (open !== r.id) window.scrollTo({ top: 0, behavior: "smooth" }); }} className="relative block w-full">
              {r.thumb ? <img src={r.thumb} alt="" className="aspect-[3/4] w-full object-cover" /> : <div className="aspect-[3/4] w-full bg-black/30" />}
              <span className="absolute left-1.5 top-1.5"><ScoreBadge value={r.score ?? postureOf(readRecord(r.data))?.total ?? null} /></span>
              {readRecord(r.data).lm ? <span className="absolute right-1.5 top-1.5 rounded-full bg-[#5fd4ff]/85 px-1.5 py-0.5 text-[10px] font-bold text-[#03101a]">3D</span> : null}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-left text-[11px] text-white">
                <b className="block truncate">{r.title || "Analisi"}</b>
                {fmtDate(r.createdAt)} · {r.kind}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPick((cur) => (cur.includes(r.id) ? cur.filter((x) => x !== r.id) : [...cur.slice(-1), r.id]))}
              className={`w-full border-t border-line py-1.5 text-xs ${pick.includes(r.id) ? "bg-accent text-accent-fg" : "text-muted"}`}
            >
              ⇄ {pick.includes(r.id) ? "nel confronto" : "confronta"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const cm = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(0)} cm`);
const sec = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} s`);
const dg = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}°`);

function Grid({ title, items }: { title: string; items: [string, string][] }) {
  const shown = items.filter(([, v]) => v !== "—");
  if (!shown.length) return null;
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-semibold text-muted">{title}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {shown.map(([k, v]) => (
          <span key={k} className="rounded-xl bg-white/[0.05] px-1.5 py-1.5 text-center">
            <span className="block text-[0.6rem] leading-tight text-muted">{k}</span>
            <b className="font-display text-base tabular-nums">{v}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Un'analisi salvata, completa: 3D, tempi, misure, angoli, postura per zone, controlli e note. */
export function GestureDetail({ row, onClose, onDelete }: { row: GestureRow; onClose?: () => void; onDelete?: () => void }) {
  const d = readRecord(row.data);
  const [view3d, setView3d] = useState(Boolean(d.lm));
  const lm = unpackLm(d.lm);
  const post = postureOf(d);
  const shot = d.shot;
  const ang = d.angles ?? {};
  const kit = d.kit;
  const legacy = d as unknown as { draw?: number | null; trunk?: number | null };
  return (
    <Card className="grid gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight">{row.title || "Analisi del gesto"}</p>
          <p className="text-xs text-muted">{new Date(row.createdAt).toLocaleString("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {row.kind} · arciere {row.hand}</p>
        </div>
        {onClose ? <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-lg leading-none">×</button> : null}
      </div>
      {lm || (d.seq && d.seq.length > 1) ? (
        <div className="flex gap-1.5">
          <button type="button" className={`aa-chip ${view3d ? "border-[#5fd4ff] text-white" : ""}`} onClick={() => setView3d(true)}>3D</button>
          <button type="button" className={`aa-chip ${!view3d ? "border-[#5fd4ff] text-white" : ""}`} onClick={() => setView3d(false)}>Fotogramma</button>
        </div>
      ) : null}
      {view3d && (lm || (d.seq && d.seq.length > 1)) ? (
        <Anatomy3D lm={lm} seq={d.seq && d.seq.length > 1 ? d.seq : null} aspect={d.aspect || 9 / 16} hand={row.hand === "mancino" ? "mancino" : "destro"} className="h-[30rem]" />
      ) : row.thumb ? (
        <img src={row.thumb} alt="" className="max-h-[30rem] w-full rounded-2xl object-contain bg-black" />
      ) : null}
      {!lm ? <p className="text-[0.7rem] text-muted">Analisi salvata prima della versione completa: il 3D e le misure in cm ci sono solo nelle analisi nuove.</p> : null}
      <Grid
        title="Tempi del tiro"
        items={[
          ["Trazione", sec(shot?.drawS ?? row.drawS)],
          ["Ancoraggio", sec(shot?.anchorS ?? row.anchorS)],
          ["Accompagnamento", sec(shot?.followS)],
          ["Tremolio mira", row.jitter == null ? "—" : row.jitter.toFixed(2).replace(".", ",")],
          ["Scivolamento", shot?.creep == null ? "—" : shot.creep.toFixed(2).replace(".", ",")],
          ["Punteggio tiro", shot?.score == null ? "—" : String(Math.round(shot.score))],
        ]}
      />
      <Grid
        title="Misure"
        items={[
          ["Allungo", cm(drawCmOf(d))],
          ["Ancoraggio dalla bocca", cm(kit?.anchorCm)],
          ["Occhio–freccia", cm(kit?.eyeArrowCm)],
          ["Corda–naso", cm(kit?.stringNoseCm)],
          ["Ripresa a", row.distanceM == null ? "—" : `${row.distanceM.toFixed(1).replace(".", ",")} m`],
          ["Altezza usata", d.heightCm ? `${d.heightCm} cm` : "—"],
        ]}
      />
      <Grid
        title="Angoli"
        items={[
          ["Gomito corda", dg(ang.draw ?? legacy.draw)],
          ["Gomito arco", dg(ang.bow ?? row.bowDeg)],
          ["Linea gomito", dg(ang.line ?? row.lineDeg)],
          ["Spalle", row.shoulderDeg == null && ang.shoulder == null ? "—" : `${Math.abs(ang.shoulder ?? row.shoulderDeg ?? 0).toFixed(1).replace(".", ",")}°`],
          ["Busto", dg(ang.trunk ?? legacy.trunk)],
          ["Freccia", dg(ang.arrowTilt)],
        ]}
      />
      {post ? (
        <div className="grid gap-1.5">
          <p className="text-xs font-semibold text-muted">Postura {Math.round(post.total)}/100</p>
          <ul className="grid gap-1.5">
            {Object.entries(post.areas).filter(([, v]) => typeof v === "number").map(([k, v]) => (
              <li key={k} className="grid gap-0.5">
                <div className="flex items-baseline justify-between text-sm"><span>{AREA_LABEL[k as keyof typeof AREA_LABEL] ?? k}</span><span className="text-xs tabular-nums">{Math.round(v as number)}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, v as number))}%`, background: (v as number) >= 75 ? "#3d8f5f" : (v as number) >= 55 ? "#e0b15a" : "#e07a72" }} /></div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {(d.posture?.issues?.length || d.pro?.issues?.length) ? (
        <div className="grid gap-1">
          <p className="text-xs font-semibold text-muted">Da migliorare</p>
          {(d.pro?.issues ?? d.posture?.issues ?? []).map((t) => <p key={t} className="text-sm">· {t}</p>)}
        </div>
      ) : null}
      {checksOf(row).length || shot?.notes?.length ? (
        <div className="grid gap-1 text-xs">
          {checksOf(row).map((c) => <p key={c} className="text-muted"><StatusMark state={c.startsWith("ok") ? "ok" : c.startsWith("attenzione") ? "warn" : "bad"} />{c.replace(/^[^:]+: /, "")}</p>)}
          {shot?.notes?.map((n) => <p key={n} className="text-muted">· {n}</p>)}
        </div>
      ) : null}
      {onDelete ? <button type="button" className="w-fit text-xs text-danger" onClick={onDelete}>Elimina questa analisi</button> : null}
    </Card>
  );
}

function Trend({ rows }: { rows: GestureRow[] }) {
  const W = 320;
  const H = 90;
  const xs = rows.map((_, i) => 12 + (i / Math.max(1, rows.length - 1)) * (W - 24));
  const ys = rows.map((r) => H - 10 - ((r.score ?? 0) / 100) * (H - 20));
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const first = rows[0].score ?? 0;
  const last = rows[rows.length - 1].score ?? 0;
  return (
    <div className="rounded-xl border border-line p-2">
      <p className="text-xs text-muted">Punteggio del gesto nel tempo · {last - first >= 0 ? "▲" : "▼"} {Math.abs(last - first)} punti dal primo</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="gtr" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3ee08f" stopOpacity="0.45" />
            <stop offset="1" stopColor="#3ee08f" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={H - 10 - 0.7 * (H - 20)} y2={H - 10 - 0.7 * (H - 20)} stroke="var(--line)" strokeDasharray="3 4" />
        <path d={`${d} L${xs[xs.length - 1]} ${H} L${xs[0]} ${H} Z`} fill="url(#gtr)" />
        <path d={d} fill="none" stroke="#3ee08f" strokeWidth="2.5" strokeLinejoin="round" />
        {xs.map((x, i) => <circle key={rows[i].id} cx={x} cy={ys[i]} r="3.5" fill="#0b120e" stroke="#3ee08f" strokeWidth="2" />)}
      </svg>
    </div>
  );
}

function Compare({ a, b, onClose }: { a: GestureRow; b: GestureRow; onClose: () => void }) {
  const lines: [string, (r: GestureRow) => number | null, string, boolean][] = [
    ["Punteggio", (r) => r.score, "", true],
    ["Ancoraggio s", (r) => r.anchorS, "s", false],
    ["Linea gomito", (r) => r.lineDeg, "°", true],
    ["Braccio arco", (r) => r.bowDeg, "°", true],
    ["Spalle (inclin.)", (r) => (r.shoulderDeg == null ? null : Math.abs(r.shoulderDeg)), "°", false],
    ["Mano arco mossa %", (r) => r.jitter, "", false],
  ];
  return (
    <div className="grid gap-2 rounded-xl border border-accent p-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Confronto</p>
        <button type="button" className="text-xs text-muted" onClick={onClose}>chiudi</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[a, b].map((r) => (
          <div key={r.id} className="overflow-hidden rounded-lg border border-line">
            {r.thumb ? <img src={r.thumb} alt="" className="aspect-[3/4] w-full object-cover" /> : null}
            <p className="truncate p-1 text-[11px]">{r.title} · {fmtDate(r.createdAt)}</p>
          </div>
        ))}
      </div>
      <table className="w-full text-xs tabular-nums">
        <tbody>
          {lines.map(([label, get, unit, higherBetter]) => {
            const va = get(a);
            const vb = get(b);
            const better = va != null && vb != null && va !== vb ? (higherBetter ? (vb > va ? "b" : "a") : (vb < va ? "b" : "a")) : "";
            return (
              <tr key={label} className="border-t border-line">
                <td className="py-1 text-muted">{label}</td>
                <td className={`text-right ${better === "a" ? "font-bold text-primary" : ""}`}>{va == null ? "—" : `${va.toFixed(1)}${unit}`}</td>
                <td className={`text-right ${better === "b" ? "font-bold text-primary" : ""}`}>{vb == null ? "—" : `${vb.toFixed(1)}${unit}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Nel gruppo: la postura migliore di ognuno, dal punteggio più alto. */
export function GroupBestPosture() {
  const best = useLoad("gest-best", () => bestGestures());
  const rows = best.data ?? [];
  if (best.loading) return <Loading />;
  return (
    <Card className="grid gap-2">
      <IconTitle icon="posture" color="#7652d1">Postura migliore del gruppo</IconTitle>
      {!rows.length ? <p className="text-sm text-muted">Nessuna analisi del gesto salvata, per ora. Salvane una da «Gesto (video)».</p> : null}
      {rows[0] ? (
        <div className="relative overflow-hidden rounded-2xl border border-accent">
          {rows[0].thumb ? <img src={rows[0].thumb} alt="" className="max-h-80 w-full object-cover" /> : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 text-white">
            <p className="text-xs uppercase tracking-wide text-[#e6b325]">Migliore</p>
            <p className="font-display text-2xl leading-none">{rows[0].name}</p>
            <p className="text-xs opacity-90">{rows[0].score}/100 · linea {deg(rows[0].lineDeg)} · ancoraggio {rows[0].anchorS == null ? "—" : `${rows[0].anchorS.toFixed(1)} s`}</p>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {rows.slice(1).map((r, i) => (
          <div key={r.id} className="overflow-hidden rounded-xl border border-line">
            {r.thumb ? <img src={r.thumb} alt="" className="aspect-[3/4] w-full object-cover" /> : null}
            <p className="truncate px-1.5 pt-1 text-xs font-semibold"><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: i === 0 ? "#c9ced6" : i === 1 ? "#c98a4b" : "transparent" }} />{r.name}</p>
            <p className="px-1.5 pb-1 text-[11px] text-muted">{r.score}/100</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
