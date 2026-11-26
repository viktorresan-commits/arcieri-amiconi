import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { useSky } from "@/lib/arcieri/sky3d";
import { SceneBackdrop } from "./scene-2d";
import { ArcherFront } from "./archer-front";
import { ArcherAvatar } from "./archer-avatar";
import { Glyph } from "./icons";

/**
 * Il tuo arciere grande, su tutta la larghezza, nella sua scena. Si gira trascinando col dito
 * (o con le frecce): di fronte, di profilo verso destra, di profilo verso sinistra.
 */
const VIEWS = [
  { id: "fronte", label: "Di fronte" },
  { id: "destra", label: "Profilo destro" },
  { id: "sinistra", label: "Profilo sinistro" },
] as const;
type View = (typeof VIEWS)[number]["id"];

export function AvatarTurntable({ look, glow, children, onOpen }: { look: AvatarLook; /** colore dell'alone (quello del livello) */ glow?: string; /** sopra la scena: nome, livello, ecc. */ children?: ReactNode; /** tocco sull'arciere: apre l'editor */ onOpen?: () => void }) {
  const { sky } = useSky();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const turn = (d: 1 | -1) => {
    setDir(d);
    setI((v) => (v + d + VIEWS.length) % VIEWS.length);
    if (navigator.vibrate) navigator.vibrate(6);
  };
  const down = (e: ReactPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const move = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s || s.moved) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    // solo un trascinamento di lato gira l'arciere; in verticale la pagina scorre
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      s.moved = true;
      turn(dx < 0 ? 1 : -1);
    }
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    if (s && !s.moved) onOpen?.();
  };
  const view: View = VIEWS[i].id;
  const side = view !== "fronte";
  const straight = look.lefty ? { ...look, lefty: false } : look;
  return (
    <div className="aa-turntable relative h-[27rem] overflow-hidden rounded-[1.75rem]">
      <SceneBackdrop sky={sky} id="turn" scene={look.scene} />
      <div style={glow ? { ["--glow" as string]: glow } : undefined} className="aa-stage-glow aa-stage-glow-lv pointer-events-none absolute inset-x-0 bottom-[8%] top-[22%]" aria-hidden />
      <div className="aa-stage-shadow pointer-events-none absolute bottom-[3%] left-1/2 h-[4.5%] w-[36%] -translate-x-1/2" aria-hidden />
      <div
        className="absolute inset-x-0 bottom-[1%] top-[20%] flex touch-pan-y select-none justify-center"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => (start.current = null)}
        role="button"
        tabIndex={0}
        aria-label={`Il tuo arciere, ${VIEWS[i].label.toLowerCase()}. Trascina di lato per girarlo, tocca per modificarlo.`}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") turn(-1);
          else if (e.key === "ArrowRight") turn(1);
          else if (e.key === "Enter") onOpen?.();
        }}
      >
        <div key={`${view}${i}`} className="aa-turn-in flex h-full justify-center" style={{ ["--from" as string]: dir > 0 ? "18deg" : "-18deg" }}>
          {side ? (
            <div className={`h-full ${view === "sinistra" ? "aa-mirror" : ""}`}>
              <ArcherAvatar look={straight} pose="riposo" interactive={false} still className="h-full w-auto drop-shadow-[0_16px_24px_rgba(0,0,0,0.5)]" />
            </div>
          ) : (
            <ArcherFront look={look} fit className="h-full w-auto drop-shadow-[0_16px_24px_rgba(0,0,0,0.5)]" />
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[18%] bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
      {children}
      {/* per girarlo: frecce ai lati e i puntini delle tre viste */}
      <button type="button" onClick={() => turn(-1)} aria-label="Gira a sinistra" className="absolute left-2 top-[58%] grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white">
        <Glyph name="chevron" size={18} className="rotate-180" />
      </button>
      <button type="button" onClick={() => turn(1)} aria-label="Gira a destra" className="absolute right-2 top-[58%] grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white">
        <Glyph name="chevron" size={18} />
      </button>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[0.7rem] font-semibold text-white">
        {VIEWS.map((v, k) => <span key={v.id} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-white" : "w-1.5 bg-white/45"}`} />)}
        <span className="ml-1">{VIEWS[i].label}</span>
      </div>
    </div>
  );
}
