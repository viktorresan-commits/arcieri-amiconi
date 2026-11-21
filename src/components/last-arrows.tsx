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
export function LastSummary({ shots }: { shots: LastShot[] }) {
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
  const r = max > 0 ? (score / max) * 10 : 0;
  if (r <= 0) return { bg: "linear-gradient(145deg,#4a4f57,#2a2e33)", fg: "#e9e4d8", trail: "#8a8f98" };
  if (r >= 9) return { bg: "radial-gradient(circle at 35% 30%,#ffe08a,#e2a925)", fg: "#2a1d0c", trail: "#ffd166" };
  if (r >= 7) return { bg: "radial-gradient(circle at 35% 30%,#ff7a6e,#c4302a)", fg: "#fff", trail: "#ff6b5e" };
  if (r >= 5) return { bg: "radial-gradient(circle at 35% 30%,#6fb2ff,#1f62b0)", fg: "#fff", trail: "#5aa6ff" };
  if (r >= 3) return { bg: "radial-gradient(circle at 35% 30%,#4a4f57,#14171a)", fg: "#fff", trail: "#9aa3ad" };
  return { bg: "radial-gradient(circle at 35% 30%,#ffffff,#d9d4c8)", fg: "#14171a", trail: "#f4f1ea" };
}

export function LastArrows({ shots }: { shots: LastShot[] }) {
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
  return (
    <ul ref={ref} className={`grid gap-1.5 ${seen ? "is-in" : "is-wait"}`}>
      {shots.map((shot, i) => {
        const sp = specsOf(shot.specs);
        const from = Number(sp.numFrom) || 1;
        const num = shot.tag != null ? shot.tag : shot.n + from - 1;
        const max = shot.max && shot.max > 0 ? shot.max : 10;
        const ratio = shot.miss ? 0 : (shot.isX ? max : shot.score) / max;
        // alone: verde se il colpo è buono, rosso se è debole o fuori, nessuno a metà strada
        const mood = shot.miss || ratio < 0.55 ? "neg" : ratio >= 0.8 ? "pos" : "mid";
        const delay = 150 + i * 220;
        // sfalsate come frecce piantate a profondità diverse
        const stagger = [0, 9, 4, 13, 2, 11, 6, 15][i % 8];
        return (
          <li
            key={`${shot.day}-${i}`}
            className={`aa-shot aa-shot-${mood} flex select-none items-center gap-2 ${pressed === i ? "aa-shot-press" : ""}`}
            style={{ ["--d" as string]: `${delay}ms`, WebkitTouchCallout: "none" }}
            onPointerDown={() => start(i, shot)}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onContextMenu={(e) => e.preventDefault()}
            title={shot.link ? (shot.link.kind === "allenamento" ? "Tieni premuto per aprire l'allenamento" : "Tieni premuto per aprire la gara") : undefined}
          >
            <div className="aa-shot-track relative h-16 min-w-0 flex-1 overflow-hidden" style={{ ["--trail" as string]: ringOf(shot.miss ? 0 : shot.isX ? max : shot.score, max).trail }}>
              <div className={`aa-launch aa-launch-far absolute inset-y-0 ${shot.miss ? "right-[44px] top-[7px] bottom-[-7px] opacity-70" : "right-[24px]"}`} style={{ width: `${80 + stagger * 0.6}%` }}>
                {/* la scia sfumata sta sotto la freccia e vola con lei */}
                <span aria-hidden className="aa-shot-trail" />
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
                  point={sp.pointType || "ogiva"}
                  number={num}
                  className="relative h-16 w-full"
                />
              </div>
              <svg aria-hidden viewBox="0 0 16 40" className="aa-shot-butt" preserveAspectRatio="none">
                {/* il bersaglio visto di taglio: anelli verticali, la punta entra nel colore del colpo */}
                <ellipse cx="8" cy="20" rx="7.5" ry="19.5" fill="#f4f1ea" />
                <ellipse cx="8" cy="20" rx="6" ry="15.6" fill="#1d2126" />
                <ellipse cx="8" cy="20" rx="4.5" ry="11.7" fill="#2f7fd1" />
                <ellipse cx="8" cy="20" rx="3" ry="7.8" fill="#d63a2f" />
                <ellipse cx="8" cy="20" rx="1.5" ry="3.9" fill="#f2c94c" />
                <ellipse cx="11" cy="20" rx="5" ry="19.5" fill="#000" opacity="0.25" />
              </svg>
            </div>
            <span className="aa-shot-label ml-3 grid w-9 shrink-0 justify-items-center gap-0.5 text-center leading-none">
              <span className="aa-shot-badge grid h-6 w-6 place-items-center rounded-full font-display text-[0.72rem] tabular-nums" style={{ background: ringOf(shot.miss ? 0 : shot.isX ? max : shot.score, max).bg, color: ringOf(shot.miss ? 0 : shot.isX ? max : shot.score, max).fg }}>
                {shot.miss ? "M" : shot.isX ? "X" : shot.score}
              </span>
              <span className="text-[0.5rem] font-semibold text-white/70">n.{num}</span>
              <span className="text-[0.5rem] text-muted">{shot.distance ? `${shot.distance} m` : "—"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
