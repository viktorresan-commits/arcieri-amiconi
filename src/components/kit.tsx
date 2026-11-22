import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type PointerEvent as ReactPointerEvent, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";
import type { AvatarLook } from "@/lib/arcieri/avatar";
import { AvatarFace } from "./archer-avatar";
import { useRouterState } from "@tanstack/react-router";
import { currentShortcut } from "@/lib/arcieri/shortcuts";
import { Glyph } from "./icons";

export function cx(...parts: Array<string | false | null | undefined>) {
  return clsx(parts);
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className ?? "h-9 w-9"} aria-hidden>
      <rect width="48" height="48" rx="12" fill="var(--primary)" />
      <circle cx="24" cy="20" r="9" fill="none" stroke="var(--primary-fg)" strokeWidth="1.6" />
      <circle cx="24" cy="20" r="4.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="24" cy="20" r="1.5" fill="var(--accent)" />
      <path d="M10 36c6-8 22-8 28 0" fill="none" stroke="var(--primary-fg)" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  variant = "accent",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "accent" | "primary" | "ghost" | "danger" }) {
  const look = {
    accent: "bg-accent text-accent-fg",
    primary: "bg-primary text-primary-fg",
    ghost: "border border-hair bg-white/5 text-fg",
    danger: "bg-danger text-danger-fg",
  }[variant];
  return (
    <button
      {...props}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold tracking-wide transition active:scale-[0.98] disabled:opacity-50",
        look,
        className,
      )}
    />
  );
}

export function Card({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return <section style={style} className={cx("aa-glow-panel rounded-[var(--radius-card)] border border-hair p-3.5 shadow-card", className)}>{children}</section>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-fg">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
      {children}
    </label>
  );
}

const control = "min-h-11 w-full rounded-xl border border-hair bg-black/20 px-3 text-sm text-fg outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(control, "min-h-24 py-3", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, props.className)} />;
}

export function PageHead({ title, lede, action, kicker, children }: { title: string; lede?: string; action?: ReactNode; kicker?: string; children?: ReactNode }) {
  // ogni sezione prende il colore e l'icona della sua voce di menu
  const path = useRouterState({ select: (st) => st.location.pathname });
  const here = currentShortcut(path);
  return (
    <div className={cx("aa-hero mb-3 px-4 pb-4 pt-4", here ? "has-page" : "")} style={here ? ({ "--page": here.color } as CSSProperties) : undefined}>
      {here ? (
        <span aria-hidden className="aa-hero-mark pointer-events-none absolute -bottom-6 right-2 text-white">
          <Glyph name={here.icon} size={118} strokeWidth={1.1} detailed />
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {kicker ? <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/60">{kicker}</p> : null}
          <h1 className="font-display text-[2.1rem] leading-none tracking-tight">{title}</h1>
        </div>
        {action}
      </div>
      {lede ? <p className="mt-1.5 max-w-xl text-[0.8rem] leading-snug text-white/70">{lede}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

/** Riga di chip-filtro scorrevole (stile "pill"). */
export function Chips<T extends string>({ value, options, onChange, className }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx("-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]", className)}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)} className="aa-chip">
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Controllo segmentato compatto. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  // pastiglia che scivola sotto la voce scelta
  const box = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const idx = options.findIndex((o) => o.id === value);
  useLayoutEffect(() => {
    const measure = () => {
      const btn = box.current?.children[idx + 1] as HTMLElement | undefined;
      setThumb(btn ? { x: btn.offsetLeft, w: btn.offsetWidth } : null);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" && box.current ? new ResizeObserver(measure) : null;
    if (ro && box.current) ro.observe(box.current);
    return () => ro?.disconnect();
  }, [idx, options.length]);
  return (
    <div ref={box} className={cx("aa-seg relative", thumb ? "has-thumb" : "")} role="group">
      <span aria-hidden className="aa-seg-thumb" style={thumb ? { transform: `translateX(${thumb.x}px)`, width: thumb.w } : { opacity: 0 }} />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => {
            if (o.id !== value && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(6);
            onChange(o.id);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Titolo di sezione con eventuale azione a destra. */
export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="aa-section-title">{title}</h2>
        {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Tessera KPI con colore e variazione. */
export function Kpi({ label, value, unit, delta, color, icon }: { label: string; value: string; unit?: string; delta?: number | null; color?: string; icon?: ReactNode }) {
  const up = delta != null && delta >= 0;
  return (
    <div className="aa-kpi aa-rise" style={color ? ({ "--kpi": color } as CSSProperties) : undefined}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
        {icon ? <span className="text-sm opacity-80">{icon}</span> : null}
      </div>
      <p className="mt-1 font-display text-[1.7rem] leading-none tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-sm font-sans text-muted">{unit}</span> : null}
      </p>
      {delta != null && Number.isFinite(delta) ? (
        <p className={cx("mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[0.68rem] font-semibold tabular-nums", up ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300")}>
          {up ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
        </p>
      ) : null}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <Card className="aa-empty">
      <div className="flex items-center gap-3">
        <span className="aa-empty-ring grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <Glyph name="target" size={22} />
        </span>
        <div className="min-w-0">
          <h2 className="aa-section-title">{title}</h2>
          {text ? <p className="mt-1 text-xs text-muted">{text}</p> : null}
        </div>
      </div>
    </Card>
  );
}

export function Loading() {
  return (
    <div className="grid gap-3" aria-busy>
      <span className="sr-only">Caricamento…</span>
      <div className="aa-skel h-8 w-40 rounded-lg" />
      <div className="aa-skel h-28 rounded-2xl" style={{ animationDelay: "120ms" }} />
      <div className="aa-skel h-28 rounded-2xl" style={{ animationDelay: "240ms" }} />
    </div>
  );
}

export function ErrorNote({ text }: { text: string }) {
  return <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{text}</p>;
}

export function Avatar({ label, color, photo, className, size = "md", look, admin = false }: { label: string; color: string; photo?: string | null; className?: string; size?: "sm" | "md" | "lg" | "xl"; look?: AvatarLook | null; /** privilegio dello staff: anello che gira attorno alla foto */ admin?: boolean }) {
  if (admin) {
    return (
      <span className={cx("aa-admin-ring relative inline-grid shrink-0 place-items-center rounded-full", size === "sm" ? "p-[2px]" : "p-[3px]", className)} title="Staff">
        <Avatar label={label} color={color} photo={photo} size={size} look={look} className="relative z-[1] ring-2 ring-bg" />
      </span>
    );
  }
  const box = size === "xl" ? "h-24 w-24 text-2xl" : size === "lg" ? "h-14 w-14 text-base" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-sm";
  if (photo) return <img src={photo} alt="" className={cx(box, "rounded-full object-cover", className)} />;
  // senza foto: il volto del suo arciere, se l'ha creato
  if (look) return <AvatarFace look={look} className={cx(box, "rounded-full", className)} />;
  return (
    <span
      className={cx(box, "grid place-items-center rounded-full font-semibold text-primary-fg", className)}
      style={{ background: color }}
    >
      {label.slice(0, 2)}
    </span>
  );
}

export function HoldDelete({
  children,
  label,
  onDelete,
  hint = true,
}: {
  children: ReactNode;
  label: string;
  onDelete: () => Promise<unknown> | unknown;
  hint?: boolean;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function clearTimer() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }

  function down(e: ReactPointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-hold-actions]")) return;
    if (held.current) return;
    setErr("");
    clearTimer();
    timer.current = window.setTimeout(() => {
      held.current = true;
      setArmed(true);
      if (navigator.vibrate) navigator.vibrate(12);
    }, 420);
  }

  function up() {
    if (held.current) return;
    clearTimer();
  }

  function confirmDelete() {
    setBusy(true);
    setErr("");
    Promise.resolve(onDelete())
      .then(() => {
        held.current = false;
        setArmed(false);
      })
      .catch((error: unknown) => {
        setErr(error instanceof Error ? error.message : "Non eliminato.");
      })
      .finally(() => setBusy(false));
  }

  return (
    <div
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => {
        // su Android la pressione lunga arriva come menu contestuale: vale come "tenuto premuto"
        e.preventDefault();
        const target = e.target as HTMLElement | null;
        if (target?.closest?.("[data-hold-actions]") || held.current) return;
        clearTimer();
        held.current = true;
        setArmed(true);
        if (navigator.vibrate) navigator.vibrate(12);
      }}
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (!held.current) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest?.("[data-hold-actions]")) {
          held.current = false;
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        held.current = false;
      }}
      className={cx("aa-hold touch-pan-y select-none", armed && "rounded-2xl ring-2 ring-accent")}
      style={{ WebkitTouchCallout: "none" }}
    >
      {children}
      {armed ? (
        <div data-hold-actions className="mt-2 grid gap-2">
          <p className="text-sm">{label}</p>
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={confirmDelete} className="min-h-11 rounded-xl bg-danger px-3 text-sm font-semibold text-danger-fg disabled:opacity-60">
              {busy ? "Tolgo…" : "Elimina"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                held.current = false;
                setArmed(false);
                setErr("");
              }}
              className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">Tieni premuto, poi tocca Elimina.</p>
      ) : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="aa-kpi">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-display text-[1.7rem] tabular-nums leading-none">{value}</p>
      {hint ? <p className="mt-1 text-[0.7rem] text-muted">{hint}</p> : null}
    </div>
  );
}
