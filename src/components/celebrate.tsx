import { useMemo } from "react";

/** Coriandoli che cadono una volta (solo CSS): per podio, premi sbloccati, obiettivi raggiunti. */
export function Confetti({ count = 28, className = "" }: { count?: number; className?: string }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 37) % 100,
        delay: ((i * 53) % 900) / 1000,
        dur: 1.6 + ((i * 29) % 900) / 1000,
        rot: (i * 47) % 360,
        drift: ((i * 31) % 60) - 30,
        color: ["#f6d24f", "#e2b340", "#7cf0a8", "#5aa6e8", "#e07a72", "#c4a2f2", "#fff1b0"][i % 7],
        w: 4 + (i % 3) * 2,
      })),
    [count],
  );
  return (
    <div aria-hidden className={`aa-confetti pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {bits.map((b, i) => (
        <span
          key={i}
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.w * 1.8,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            ["--rot" as string]: `${b.rot}deg`,
            ["--drift" as string]: `${b.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/** Scintilla a 4 punte (al posto dei caratteri ✦). */
export function Sparkle({ size = 12, color = "#fff1b0", className = "", style }: { size?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={className} style={style} aria-hidden>
      <path d="M10 0 C11 6 14 9 20 10 C14 11 11 14 10 20 C9 14 6 11 0 10 C6 9 9 6 10 0 Z" fill={color} />
    </svg>
  );
}
