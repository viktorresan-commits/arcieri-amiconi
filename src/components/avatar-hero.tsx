import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listAvatars, saveAvatar } from "@/lib/arcieri/avatar.api";
import { AVATAR_DEFAULT, AVATAR_KEY, normalizeLook, type AvatarLook, type Pose } from "@/lib/arcieri/avatar";
import { useLocalState } from "@/lib/arcieri/local-store";
import { useMainGear } from "@/lib/arcieri/main-gear";
import { useSky } from "@/lib/arcieri/sky3d";
import { ArcherAvatar } from "./archer-avatar";
import { SceneBackdrop } from "./scene-2d";

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
export function AvatarScene({ look, children, height = "h-72", interactive = true, pose, phase = false }: { look: AvatarLook; children?: ReactNode; height?: string; interactive?: boolean; pose?: Pose; phase?: boolean }) {
  const { sky } = useSky();
  const [phaseName, setPhaseName] = useState("");
  const unmirrored = useMemo(() => (look.lefty ? { ...look, lefty: false } : look), [look]);
  const stage = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const [shots, setShots] = useState<{ id: number; x: number; y: number; dx: number; dy: number; score: number; hx: number; hy: number }[]>([]);
  const [marks, setMarks] = useState<{ id: number; hx: number; hy: number }[]>([]);
  const onShot = () => {
    // misure di impaginazione (non quelle a schermo): restano giuste anche con la scena specchiata
    const sEl = stage.current;
    const tEl = target.current;
    if (!sEl || !tEl) return;
    const st = { width: sEl.offsetWidth, height: sEl.offsetHeight, left: 0, top: 0 };
    const tg = { left: tEl.offsetLeft, top: tEl.offsetTop, width: tEl.offsetWidth, height: tEl.offsetHeight };
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
      {/* mancino: tutta la scena si specchia, il paglione passa a sinistra */}
      <div className={`absolute inset-0 ${look.lefty ? "aa-mirror" : ""}`}>
      <SceneBackdrop sky={sky} id="hero" scene={look.scene} />
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
            <span className={look.lefty ? "aa-mirror inline-block" : "inline-block"}>{s2.score === 10 ? "X" : s2.score}</span>
          </span>
        </div>
      ))}
      <div className="absolute bottom-0 left-[-6%] h-[96%]">
        <ArcherAvatar look={unmirrored} pose={pose} className="h-full w-auto drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]" interactive={interactive} onShot={onShot} hideFlight onPhase={phase ? setPhaseName : undefined} />
      </div>
      </div>
      {phase && phaseName ? (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur" aria-live="polite">
          {phaseName}
        </p>
      ) : null}
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
