import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listAvatars, saveAvatar } from "@/lib/arcieri/avatar.api";
import { AVATAR_DEFAULT, AVATAR_KEY, normalizeLook, type AvatarLook, type Pose } from "@/lib/arcieri/avatar";
import { useLocalState } from "@/lib/arcieri/local-store";
import { useMainGear } from "@/lib/arcieri/main-gear";
import { ArcherAvatar } from "./archer-avatar";

const SHAFT_BY_MATERIAL: Record<string, string> = { legno: "#c99a5e", carbonio: "#1d1f22", alluminio: "#9aa7b2", "carbo-alluminio": "#5b6670", bambu: "#c9b46a" };
const BOW_IDS = ["olimpico", "compound", "nudo", "longbow", "ricurvo", "storico", "asiatico", "flatbow"];

/** Aspetto salvato + (se scelto) arco e frecce dell'attrezzatura principale. */
export function useAvatar() {
  const [raw, setLook] = useLocalState<AvatarLook>(AVATAR_KEY, AVATAR_DEFAULT);
  const look = useMemo(() => normalizeLook(raw), [raw]);
  const main = useMainGear();
  const shown = useMemo<AvatarLook>(() => {
    if (!look.useMain || !main) return look;
    const b = main.bowSpecs ?? {};
    const a = main.arrowSpecs ?? {};
    return {
      ...look,
      bowType: BOW_IDS.includes(b.bowType) ? b.bowType : look.bowType,
      riser: b.riser || look.riser,
      limbs: b.limbs || look.limbs,
      fletch: a.fletch || look.fletch,
      cock: a.cock || look.cock,
      nock: a.nock || look.nock,
      shaft: a.shaft || SHAFT_BY_MATERIAL[a.material ?? ""] || look.shaft,
    };
  }, [look, main]);
  return { look, setLook, shown, main };
}

/** Il campo di tiro dietro l'arciere: cielo che si muove, colline, alberi e un paglione che riceve i tiri. */
export function AvatarScene({ look, children, height = "h-72", interactive = true, pose }: { look: AvatarLook; children?: ReactNode; height?: string; interactive?: boolean; pose?: Pose }) {
  const stage = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const [shots, setShots] = useState<{ id: number; x: number; y: number; dx: number; dy: number; score: number; hx: number; hy: number }[]>([]);
  const [marks, setMarks] = useState<{ id: number; hx: number; hy: number }[]>([]);
  const onShot = () => {
    const st = stage.current?.getBoundingClientRect();
    const tg = target.current?.getBoundingClientRect();
    if (!st || !tg) return;
    // dove finisce: quasi sempre nel giallo o nel rosso, ogni tanto più fuori
    const r = Math.random() ** 1.6 * 0.42;
    const a = Math.random() * Math.PI * 2;
    const hx = Math.cos(a) * r;
    const hy = Math.sin(a) * r * 0.9;
    const score = Math.max(6, 10 - Math.floor(r / 0.09));
    const x = st.width * 0.47;
    const y = st.height * 0.31;
    const ex = tg.left - st.left + tg.width * (0.5 + hx * 0.5);
    const ey = tg.top - st.top + tg.height * (0.38 + hy * 0.5);
    const id = Date.now();
    setShots((list) => [...list.slice(-2), { id, x, y, dx: ex - x, dy: ey - y, score, hx, hy }]);
    window.setTimeout(() => setMarks((m) => [...m.slice(-4), { id, hx, hy }]), 560);
    window.setTimeout(() => setShots((list) => list.filter((s2) => s2.id !== id)), 1700);
  };
  return (
    <div ref={stage} className={`aa-avatar-stage ${height}`}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="aa-sun" cx="78%" cy="22%" r="40%">
            <stop offset="0" stopColor="#fff2cc" stopOpacity="0.95" />
            <stop offset="0.25" stopColor="#ffd98a" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="300" fill="url(#aa-sun)" className="aa-sun-pulse" />
        <g className="aa-clouds" fill="#fff" opacity="0.5">
          {[[40, 40, 1], [170, 26, 0.8], [290, 54, 1.1], [420, 34, 0.9], [540, 48, 1]].map(([x, y, k]) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
              <ellipse cx="0" cy="0" rx="34" ry="8" />
              <ellipse cx="12" cy="-6" rx="16" ry="9" />
              <ellipse cx="-12" cy="-3" rx="14" ry="7" />
            </g>
          ))}
        </g>
        <g className="aa-birds" stroke="#2a3a46" strokeWidth="1.4" fill="none" strokeLinecap="round">
          <path d="M60 70 q4 -4 8 0 q4 -4 8 0" />
          <path d="M84 62 q3 -3 6 0 q3 -3 6 0" />
        </g>
        <path d="M0 196 C40 170 80 176 120 186 C170 160 220 168 260 182 C300 164 350 166 400 184 V220 H0 Z" fill="#5f7d8f" opacity="0.75" />
        <path d="M0 210 C50 194 110 200 160 208 C220 192 290 196 400 206 V230 H0 Z" fill="#46684f" />
        {Array.from({ length: 16 }, (_, i) => (
          <g key={i} transform={`translate(${i * 27 + (i % 2) * 6} ${206 - (i % 3) * 2})`}>
            <rect x="-1.2" y="0" width="2.4" height="8" fill="#3a2a1e" />
            <ellipse cx="0" cy="-3" rx={7 + (i % 3)} ry={9 + (i % 2) * 2} fill={i % 2 ? "#36583a" : "#2f4d33"} className="aa-tree" style={{ animationDelay: `${(i % 5) * 0.4}s` }} />
          </g>
        ))}
        <rect y="216" width="400" height="84" fill="#4f7340" />
        <path d="M0 236 H400 M0 258 H400 M0 284 H400" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="6" />
        <g className="aa-grass" stroke="#7da05a" strokeWidth="1.4" strokeLinecap="round">
          {Array.from({ length: 40 }, (_, i) => <path key={i} d={`M${i * 10 + 3} 300 l${(i % 3) - 1} -${6 + (i % 4) * 2}`} />)}
        </g>
        <path d="M312 66 L180 300 L240 300 Z" fill="#fff4d6" opacity="0.07" className="aa-ray" />
        <path d="M312 66 L300 300 L360 300 Z" fill="#fff4d6" opacity="0.06" className="aa-ray" style={{ animationDelay: "1.4s" }} />
      </svg>
      {/* paglione che riceve i tiri */}
      <div ref={target} className="absolute right-[5%] top-[50%] aspect-[1/1.35] w-[13%]">
        <svg viewBox="0 0 40 54" className="h-full w-full" aria-hidden>
          <path d="M10 34 L5 54 M30 34 L35 54 M20 30 L20 54" stroke="#6b4a2b" strokeWidth="2.4" />
          <rect x="1" y="2" width="38" height="36" rx="3" fill="#c9a46a" />
          <rect x="1" y="2" width="38" height="36" rx="3" fill="none" stroke="#8f6c3b" strokeWidth="1.2" />
          {["#f4f1ea", "#1a1c1e", "#2a6294", "#c4473d", "#e6b325"].map((c, i) => <circle key={c} cx="20" cy="20.5" r={16 - i * 3.2} fill={c} />)}
          {marks.map((m) => (
            <g key={m.id}>
              <circle cx={20 + m.hx * 20} cy={20.5 + m.hy * 20} r="1.3" fill="#14181c" />
              <line x1={20 + m.hx * 20} y1={20.5 + m.hy * 20} x2={20 + m.hx * 20 - 4} y2={20.5 + m.hy * 20 - 1.5} stroke={look.fletch} strokeWidth="1.4" />
            </g>
          ))}
        </svg>
      </div>
      {shots.map((s2) => (
        <div key={s2.id}>
          <span className="aa-scene-arrow pointer-events-none absolute" style={{ left: s2.x, top: s2.y, ["--dx" as string]: `${s2.dx}px`, ["--dy" as string]: `${s2.dy}px` }}>
            <svg width="54" height="10" viewBox="0 0 54 10" aria-hidden>
              <line x1="0" y1="5" x2="48" y2="5" stroke={look.shaft || "#1d1f22"} strokeWidth="2" />
              <path d="M48 2.6 L54 5 L48 7.4 Z" fill="#c9d0d8" />
              <path d="M1 5 L6 0 L16 1.5 L17 5 Z" fill={look.cock} />
              <path d="M1 5 L6 10 L16 8.5 L17 5 Z" fill={look.fletch} />
            </svg>
          </span>
          <span className="aa-scene-hit pointer-events-none absolute font-display text-lg text-white" style={{ left: s2.x + s2.dx, top: s2.y + s2.dy }}>
            {s2.score === 10 ? "X" : s2.score}
          </span>
        </div>
      ))}
      <div className="absolute bottom-0 left-[-6%] h-[96%]">
        <ArcherAvatar look={look} pose={pose} className="h-full w-auto drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]" interactive={interactive} onShot={onShot} hideFlight />
      </div>
      {children}
    </div>
  );
}

let teamCache: Promise<Record<string, Record<string, string | boolean>>> | null = null;

/** Aspetti degli arcieri della squadra (per podio e classifiche), caricati una volta. */
export function useTeamAvatars() {
  const [map, setMap] = useState<Record<string, AvatarLook>>({});
  useEffect(() => {
    let alive = true;
    teamCache ??= listAvatars().catch(() => ({}));
    teamCache.then((raw) => {
      if (!alive) return;
      const out: Record<string, AvatarLook> = {};
      for (const [id, look] of Object.entries(raw)) out[id] = normalizeLook(look);
      setMap(out);
    });
    return () => {
      alive = false;
    };
  }, []);
  return map;
}

/** Manda al profilo l'aspetto attuale (con un attimo di ritardo, solo se è cambiato). */
export function useAvatarSync(shown: AvatarLook) {
  useEffect(() => {
    const text = JSON.stringify(shown);
    let last = "";
    try {
      last = localStorage.getItem("aa-avatar-synced") || "";
    } catch {
      /* niente */
    }
    if (text === last) return;
    const id = window.setTimeout(() => {
      saveAvatar({ data: { look: shown } })
        .then(() => {
          try {
            localStorage.setItem("aa-avatar-synced", text);
          } catch {
            /* niente */
          }
          teamCache = null;
        })
        .catch(() => undefined);
    }, 1800);
    return () => window.clearTimeout(id);
  }, [shown]);
}
