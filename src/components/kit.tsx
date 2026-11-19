import { useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type PointerEvent as ReactPointerEvent, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

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
    ghost: "border border-line bg-surface text-fg",
    danger: "bg-danger text-danger-fg",
  }[variant];
  return (
    <button
      {...props}
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-opacity disabled:opacity-50",
        look,
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("aa-glow-panel rounded-3xl border border-line p-4 shadow-card", className)}>{children}</section>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

const control = "min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(control, "min-h-24 py-3", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, props.className)} />;
}

export function PageHead({ title, lede, action }: { title: string; lede?: string; action?: ReactNode }) {
  return (
    <div className="aa-glow-panel mb-4 overflow-hidden rounded-3xl border border-line px-5 py-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-5xl leading-none">{title}</h1>
        {action}
      </div>
      {lede ? <p className="mt-2 max-w-xl text-sm text-white/70">{lede}</p> : null}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <Card>
      <h2 className="font-display text-2xl">{title}</h2>
      {text ? <p className="mt-1 text-sm text-muted">{text}</p> : null}
    </Card>
  );
}

export function Loading() {
  return (
    <div className="grid gap-3" aria-busy>
      <p className="text-sm text-muted">Caricamento…</p>
      <div className="h-8 w-40 animate-pulse rounded-lg bg-line" />
      <div className="h-28 animate-pulse rounded-2xl bg-line" />
      <div className="h-28 animate-pulse rounded-2xl bg-line" />
    </div>
  );
}

export function ErrorNote({ text }: { text: string }) {
  return <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{text}</p>;
}

export function Avatar({ label, color, photo, className, size = "md" }: { label: string; color: string; photo?: string | null; className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const box = size === "xl" ? "h-24 w-24 text-2xl" : size === "lg" ? "h-14 w-14 text-base" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-sm";
  if (photo) return <img src={photo} alt="" className={cx(box, "rounded-full object-cover", className)} />;
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
      onContextMenu={(e) => e.preventDefault()}
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
      className={cx("touch-pan-y select-none", armed && "rounded-2xl ring-2 ring-accent")}
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
    <Card className="p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-3xl tabular-nums leading-none">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
