import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowArt } from "./arrow-art";

/**
 * Ultime frecce della Home: ogni freccia vola da sinistra con la scia del colore del colpo e si pianta
 * nel bersaglio, con il punteggio nel colore del suo anello. Tenendo premuto si apre la sessione.
 */
export type LastShot = { score: number; n: number; tag?: number | null; max?: number; distance: number; miss: boolean; isX: boolean; day: string; specs: string; link?: { kind: "allenamento" | "gara"; id: number } };

function specsOf(raw: string): Record<string, string> {
  try {
    const v = JSON.parse(raw || "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Le ultime frecce, disegnate come sono davvero (colori, penne, punta) con numero e distanza. */
/** Riassunto delle ultime frecce: media, X e colpi nel giallo. */
export function LastSummary({ shots: all }: { shots: LastShot[] }) {
  const shots = all.slice(0, 3);
  const pts = shots.map((s) => (s.miss ? 0 : s.isX ? (s.max && s.max > 0 ? s.max : 10) : s.score));
  const avg = pts.reduce((a, b) => a + b, 0) / Math.max(1, pts.length);
  const xs = shots.filter((s) => s.isX).length;
  const gold = shots.filter((s) => !s.miss && (s.isX ? 10 : (s.score / (s.max && s.max > 0 ? s.max : 10)) * 10) >= 9).length;
  return (
    <div className="mb-2 grid grid-cols-3 gap-1.5 text-center">
      {[["Media", avg.toFixed(2).replace(".", ","), "#e0b15a"], ["Nel giallo", `${gold}/${shots.length}`, "#f2c94c"], ["X", String(xs), "#7cf0a8"]].map(([k, v, c]) => (
        <div key={k} className="rounded-xl bg-white/[0.04] py-1.5">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-muted">{k}</p>
          <p className="font-display text-lg tabular-nums" style={{ color: c }}>{v}</p>
        </div>
      ))}
    </div>
  );
}

/** Colore dell'anello del colpo, come sul bersaglio: oro, rosso, blu, nero, bianco; grigio se fuori. */
function ringOf(score: number, max: number) {
  // semaforo: verde per i centri, giallo per i colpi medi, rosso per quelli bassi e gli errori
  const r = max > 0 ? (score / max) * 10 : 0;
  if (r >= 8) return { bg: "radial-gradient(circle at 35% 30%,#7ee2a0,#1f9d55)", fg: "#06240f", trail: "#3ccf74" };
  if (r >= 5) return { bg: "radial-gradient(circle at 35% 30%,#ffe58a,#e2a925)", fg: "#2a1d0c", trail: "#ffd23f" };
  return { bg: "radial-gradient(circle at 35% 30%,#ff8a7e,#c4302a)", fg: "#fff", trail: "#ff5a4c" };
}

/** anelli del bersaglio dall'esterno: bianco, nero, azzurro, rosso, oro (due zone per colore) */
const RINGS = ["#f4f1ea", "#f4f1ea", "#1d2024", "#1d2024", "#2b8fd6", "#2b8fd6", "#e2413a", "#e2413a", "#f2cf3b", "#f2cf3b"];
const LINE = ["#9a958c", "#9a958c", "#5a5f66", "#5a5f66", "#1d5f96", "#1d5f96", "#9c2620", "#9c2620", "#b0901c", "#b0901c"];

/** dove si pianta la freccia: più vicino al centro quanto più alto è il punto, in una direzione diversa per ogni freccia */
function impactOf(shot: LastShot, i: number, cx: number, cy: number, R: number) {
  const max = shot.max && shot.max > 0 ? shot.max : 10;
  const s10 = shot.miss ? 0 : shot.isX ? 10.6 : (shot.score / max) * 10;
  const ang = ((shot.n * 97 + i * 61) % 360) * (Math.PI / 180);
  if (shot.miss) return { x: cx - R - 9, y: cy + (i % 2 ? 14 : -15), inFace: false };
  const r = Math.max(0.6, ((10.8 - s10) / 10) * R);
  // in orizzontale la freccia arriva da sinistra: il colpo resta nella metà alta o bassa, non dietro il bersaglio
  return { x: cx + Math.cos(ang) * r * 0.55, y: cy + Math.sin(ang) * r, inFace: true };
}

export function LastArrows({ shots: all }: { shots: LastShot[] }) {
  const shots = all.slice(0, 3);
  const navigate = useNavigate();
  const hold = useRef<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  // tenendo premuta una freccia si apre l'allenamento o la gara in cui è stata segnata
  const open = (shot: LastShot) => {
    if (!shot.link) return;
    if (shot.link.kind === "allenamento") void navigate({ to: "/allenamento/$id", params: { id: String(shot.link.id) } });
    else void navigate({ to: "/gare", hash: `gara-${shot.link.id}` });
  };
  const start = (i: number, shot: LastShot) => {
    if (hold.current) window.clearTimeout(hold.current);
    setPressed(i);
    hold.current = window.setTimeout(() => {
      hold.current = null;
      setPressed(null);
      if (navigator.vibrate) navigator.vibrate(18);
      open(shot);
    }, 520);
  };
  const stop = () => {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
    setPressed(null);
  };
  // l'animazione parte quando la lista entra nello schermo, così si vede davvero
  const ref = useRef<HTMLUListElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((list) => {
      if (list.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const W = 300;
  const H = 64;
  const cx = 262;
  const cy = 32;
  const R = 27;
  return (
    <ul ref={ref} className={`grid gap-2 ${seen ? "is-in" : "is-wait"}`}>
      {shots.map((shot, i) => {
        const sp = specsOf(shot.specs);
        const from = Number(sp.numFrom) || 1;
        const num = shot.tag != null ? shot.tag : shot.n + from - 1;
        const max = shot.max && shot.max > 0 ? shot.max : 10;
        const ratio = shot.miss ? 0 : (shot.isX ? max : shot.score) / max;
        const mood = shot.miss || ratio < 0.55 ? "neg" : ratio >= 0.8 ? "pos" : "mid";
        const ring = ringOf(shot.miss ? 0 : shot.isX ? max : shot.score, max);
        const delay = 150 + i * 260;
        const hit = impactOf(shot, i, cx, cy, R);
        // la freccia (320×36 nel suo disegno, punta a 313) con la punta un po' dentro il bersaglio
        const aw = 214;
        const ah = (aw * 36) / 320;
        const ax = hit.x + 3 - aw * (313 / 320);
        const ay = hit.y - ah / 2;
        const day = shot.day ? new Date(`${shot.day.slice(0, 10)}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "";
        return (
          <li
            key={`${shot.day}-${i}`}
            className={`aa-shot2 aa-shot-${mood} flex select-none items-center gap-2 rounded-2xl p-1.5 pr-2.5 ${pressed === i ? "aa-shot-press" : ""}`}
            style={{ ["--d" as string]: `${delay}ms`, ["--trail" as string]: ring.trail, WebkitTouchCallout: "none" }}
            onPointerDown={() => start(i, shot)}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onContextMenu={(e) => e.preventDefault()}
            title={shot.link ? (shot.link.kind === "allenamento" ? "Tieni premuto per aprire l'allenamento" : "Tieni premuto per aprire la gara") : undefined}
          >
            <svg viewBox={`0 0 ${W} ${H}`} className="h-[4.4rem] min-w-0 flex-1" aria-hidden overflow="visible">
              <defs>
                <linearGradient id={`trail-${i}`} x1="0" x2="1">
                  <stop offset="0" stopColor={ring.trail} stopOpacity="0" />
                  <stop offset="0.75" stopColor={ring.trail} stopOpacity="0.55" />
                  <stop offset="1" stopColor={ring.trail} stopOpacity="0.9" />
                </linearGradient>
                <radialGradient id={`face-${i}`} cx="0.38" cy="0.32" r="0.8">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
                  <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
                  <stop offset="1" stopColor="#000" stopOpacity="0.28" />
                </radialGradient>
                <pattern id={`straw-${i}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
                  <rect width="4" height="0.8" fill="#7a5a24" opacity="0.5" />
                  <rect y="2.2" width="2.6" height="0.6" fill="#f2dc9a" opacity="0.45" />
                </pattern>
              </defs>
              {/* paglione e visuale a dieci zone */}
              <rect x={cx - R - 14} y="1" width={2 * R + 28} height={H - 2} rx="7" fill="#b89452" />
              <rect x={cx - R - 14} y="1" width={2 * R + 28} height={H - 2} rx="7" fill={`url(#straw-${i})`} />
              <rect x={cx - R - 14} y="1" width={2 * R + 28} height={H - 2} rx="7" fill="none" stroke="#000" strokeOpacity="0.35" />
              {RINGS.map((c, k) => (
                <circle key={k} cx={cx} cy={cy} r={R * (1 - k / 10)} fill={c} stroke={LINE[k]} strokeWidth="0.45" />
              ))}
              <circle cx={cx} cy={cy} r={R * 0.05} fill="none" stroke="#b0901c" strokeWidth="0.4" />
              <circle cx={cx} cy={cy} r={R} fill={`url(#face-${i})`} />
              {/* scia del colore del colpo */}
              <rect className="aa-shot2-trail" x="0" y={hit.y - 1.4} width={Math.max(12, ax + 26)} height="2.8" rx="1.4" fill={`url(#trail-${i})`} />
              {/* la freccia vola e si pianta */}
              <g className="aa-shot2-fly">
                <ellipse cx={hit.x - 4} cy={hit.y + 4} rx="10" ry="1.8" fill="#000" opacity="0.16" />
                <svg x={ax} y={ay} width={aw} height={ah} viewBox="0 0 320 36" overflow="visible">
                  <ArrowArt
                    material={sp.material || "carbonio"}
                    shaft={sp.shaft}
                    fletch={sp.fletch || "#d63a2f"}
                    cock={sp.cock || "#e6b325"}
                    nock={sp.nock || "#f4f1ea"}
                    wrap={sp.wrap}
                    fletchType={sp.fletchType || "alette"}
                    fletchStyle={sp.fletchStyle}
                    fletch2={sp.fletch2}
                    fletchLen={sp.fletchLen}
                    point={sp.pointType || "ogiva"}
                    number={num}
                    ground={false}
                    className=""
                  />
                </svg>
              </g>
              {/* foro e onda dell'impatto */}
              <circle cx={hit.x} cy={hit.y} r="1.6" fill="#0b0b0b" opacity="0.8" />
              <circle className="aa-shot2-ping" cx={hit.x} cy={hit.y} r="7" fill="none" stroke={ring.trail} strokeWidth="1.6" />
            </svg>
            <span className="aa-shot-label grid w-14 shrink-0 justify-items-center gap-0.5 text-center leading-none">
              <span className="aa-shot-badge grid h-9 w-9 place-items-center rounded-full font-display text-base tabular-nums" style={{ background: ring.bg, color: ring.fg }}>
                {shot.miss ? "M" : shot.isX ? "X" : shot.score}
              </span>
              <span className="mt-0.5 text-[0.6rem] font-semibold text-white/80">freccia {num}</span>
              <span className="whitespace-nowrap text-[0.56rem] text-muted">{shot.distance ? `${shot.distance} m` : "—"}</span>
              {day ? <span className="whitespace-nowrap text-[0.56rem] text-muted">{day}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
