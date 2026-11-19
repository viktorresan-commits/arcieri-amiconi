import { useState } from "react";
import { bestGestures, deleteGesture, listGestures, type GestureRow } from "@/lib/arcieri/gesture.api";
import { useLoad } from "@/lib/arcieri/use-load";
import { Card, Loading } from "@/components/kit";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "2-digit" });
};
const deg = (v: number | null, d = 0) => (v == null ? "—" : `${v.toFixed(d)}°`);

function ScoreBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">foto</span>;
  const color = value >= 70 ? "#3ee08f" : value >= 50 ? "#e6b325" : "#d15c56";
  return <span className="rounded-full px-2 py-0.5 text-xs font-bold text-[#04140c]" style={{ background: color }}>{value}</span>;
}

/** Le mie analisi del gesto: galleria, andamento del punteggio e confronto fra due analisi. */
export function GestureGallery() {
  const [nonce, setNonce] = useState(0);
  const list = useLoad(`gest-${nonce}`, () => listGestures());
  const [open, setOpen] = useState<number | null>(null);
  const [pick, setPick] = useState<number[]>([]);
  const rows = list.data ?? [];
  const scored = rows.filter((r) => r.score != null).slice().reverse();
  const a = rows.find((r) => r.id === pick[0]);
  const b = rows.find((r) => r.id === pick[1]);

  return (
    <Card className="grid gap-3">
      <div>
        <h2 className="font-display text-2xl">Le mie analisi del gesto</h2>
        <p className="text-xs text-muted">Salvale da «Gesto (video)»: qui vedi l'andamento e puoi confrontarne due (tocca ⇄).</p>
      </div>
      {list.loading ? <Loading /> : null}
      {!list.loading && !rows.length ? <p className="text-sm text-muted">Nessuna analisi salvata, per ora.</p> : null}
      {scored.length >= 2 ? <Trend rows={scored} /> : null}
      {a && b ? <Compare a={a} b={b} onClose={() => setPick([])} /> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.id} className={`overflow-hidden rounded-xl border ${pick.includes(r.id) ? "border-accent" : "border-line"} bg-elev`}>
            <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="relative block w-full">
              {r.thumb ? <img src={r.thumb} alt="" className="aspect-[3/4] w-full object-cover" /> : <div className="aspect-[3/4] w-full bg-black/30" />}
              <span className="absolute left-1.5 top-1.5"><ScoreBadge value={r.score} /></span>
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-left text-[11px] text-white">
                <b className="block truncate">{r.title || "Analisi"}</b>
                {fmtDate(r.createdAt)} · {r.kind}
              </span>
            </button>
            {open === r.id ? (
              <div className="grid gap-1 p-2 text-xs">
                <p>Ancoraggio {r.anchorS == null ? "—" : `${r.anchorS.toFixed(1)} s`} · trazione {r.drawS == null ? "—" : `${r.drawS.toFixed(1)} s`}</p>
                <p>Linea gomito {deg(r.lineDeg)} · braccio arco {deg(r.bowDeg)} · spalle {deg(r.shoulderDeg, 1)}</p>
                {r.distanceM ? <p>Ripresa a {r.distanceM.toFixed(1)} m</p> : null}
                {Array.isArray(r.data.checks) ? (r.data.checks as string[]).map((c) => <p key={c} className="text-muted">{c.startsWith("ok") ? "✅" : c.startsWith("attenzione") ? "⚠️" : "❌"} {c.replace(/^[^:]+: /, "")}</p>) : null}
                <button type="button" className="mt-1 w-fit text-danger" onClick={() => deleteGesture({ data: { id: r.id } }).then(() => setNonce((n) => n + 1))}>Elimina</button>
              </div>
            ) : null}
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
      <h2 className="font-display text-2xl">🏹 Postura migliore del gruppo</h2>
      {!rows.length ? <p className="text-sm text-muted">Nessuna analisi del gesto salvata, per ora. Salvane una da «Gesto (video)».</p> : null}
      {rows[0] ? (
        <div className="relative overflow-hidden rounded-2xl border border-accent">
          {rows[0].thumb ? <img src={rows[0].thumb} alt="" className="max-h-80 w-full object-cover" /> : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 text-white">
            <p className="text-xs uppercase tracking-wide text-[#e6b325]">🥇 Migliore</p>
            <p className="font-display text-2xl leading-none">{rows[0].name}</p>
            <p className="text-xs opacity-90">{rows[0].score}/100 · linea {deg(rows[0].lineDeg)} · ancoraggio {rows[0].anchorS == null ? "—" : `${rows[0].anchorS.toFixed(1)} s`}</p>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {rows.slice(1).map((r, i) => (
          <div key={r.id} className="overflow-hidden rounded-xl border border-line">
            {r.thumb ? <img src={r.thumb} alt="" className="aspect-[3/4] w-full object-cover" /> : null}
            <p className="truncate px-1.5 pt-1 text-xs font-semibold">{i === 0 ? "🥈 " : i === 1 ? "🥉 " : ""}{r.name}</p>
            <p className="px-1.5 pb-1 text-[11px] text-muted">{r.score}/100</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
