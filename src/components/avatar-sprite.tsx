import { useRef, useState, type ReactNode } from "react";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { ArcherAvatar, type AvatarDrive } from "./archer-avatar";

type Pt = { x: number; y: number } | null;

/** Dal tempo della routine (0 = rilascio) al comando dell'arciere disegnato. */
export function driveAt(tt: number): AvatarDrive {
  if (tt < -3.7) return { pull: 0, aim: 0, released: null };
  if (tt < -2.3) return { pull: (tt + 3.7) / 1.4, aim: 0, released: null };
  if (tt < 0) return { pull: 1, aim: 0, released: null };
  if (tt < 1.9) return { pull: 1, aim: 0, released: tt };
  return { pull: 0, aim: 0, released: null };
}

/**
 * L'arciere disegnato (2D, ben dettagliato) sopra una scena 3D: la scena calcola dove cadono piedi e
 * testa sullo schermo e il tempo della routine, e lo sprite si mette lì e si muove di conseguenza.
 */
export function useAvatarSprite(look: AvatarLook) {
  const box = useRef<HTMLDivElement>(null);
  const [drive, setDrive] = useState<AvatarDrive>({ pull: 0, aim: 0, released: null });
  const last = useRef(0);
  const lastKey = useRef("");
  const place = (feet: Pt, head: Pt, tt: number) => {
    const el = box.current;
    if (!el) return;
    if (!feet || !head || feet.y - head.y < 12) {
      el.style.opacity = "0";
      return;
    }
    // nel disegno i piedi stanno a y 338 e la cima della testa a y 57 (viewBox 40 0 300 350)
    const hpx = ((feet.y - head.y) * 350) / 281;
    const wpx = (hpx * 300) / 350;
    const left = feet.x - ((150 - 40) / 300) * wpx;
    const top = feet.y - (338 / 350) * hpx;
    el.style.opacity = "1";
    el.style.width = `${wpx.toFixed(1)}px`;
    el.style.height = `${hpx.toFixed(1)}px`;
    el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
    const now = performance.now();
    if (now - last.current > 30) {
      last.current = now;
      const d = driveAt(tt);
      const key = `${d.pull.toFixed(2)}|${d.released == null ? "-" : d.released.toFixed(2)}`;
      if (key !== lastKey.current) {
        lastKey.current = key;
        setDrive(d);
      }
    }
  };
  const node: ReactNode = (
    <div ref={box} className="pointer-events-none absolute left-0 top-0 will-change-transform" style={{ opacity: 0 }} aria-hidden>
      <ArcherAvatar look={look.lefty ? { ...look, lefty: false } : look} drive={drive} interactive={false} hideFlight className="h-full w-full" />
    </div>
  );
  return { node, place };
}
