import { type AimAngle, type AimTarget } from "@/lib/arcieri/scoring";

const TARGETS: Array<[AimTarget, string]> = [
  ["padiglione", "Padiglione"],
  ["sagoma", "Sagoma"],
  ["piattello", "Piattello"],
  ["altro", "Altro"],
];

const ANGLES: Array<[AimAngle, string]> = [
  ["frontale", "Frontale"],
  ["destra", "A destra"],
  ["sinistra", "A sinistra"],
  ["alto", "Alto"],
  ["basso", "Basso"],
];

export function AimPick({
  target,
  angle,
  face,
  onChange,
}: {
  target: AimTarget;
  angle: AimAngle;
  face: string;
  onChange: (next: { aimTarget: AimTarget; aimAngle: AimAngle; face: string }) => void;
}) {
  function setTarget(next: AimTarget) {
    const altro = face === "wa10" || face.startsWith("sagoma") || face === "clay" || face === "threed" ? "field6" : face;
    const nextFace = next === "padiglione" ? "wa10" : next === "sagoma" ? "sagoma8" : next === "piattello" ? "clay" : altro;
    onChange({ aimTarget: next, aimAngle: angle, face: nextFace });
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <p className="text-sm font-medium text-muted">Cosa punti</p>
        <div className="grid grid-cols-2 gap-2">
          {TARGETS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTarget(id)} className={`min-h-12 rounded-xl px-2 text-sm font-semibold ${target === id ? "bg-primary text-primary-fg" : "border border-line"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {target === "sagoma" ? <p className="text-xs text-muted">Sulla sagoma lo spot, anche il centro, vale 8. Il corpo vale 5. Fuori è 0.</p> : null}
      <div className="grid gap-1.5">
        <p className="text-sm font-medium text-muted">Da che parte</p>
        <div className="grid grid-cols-2 gap-2">
          {ANGLES.map(([id, label]) => (
            <button key={id} type="button" onClick={() => onChange({ aimTarget: target, aimAngle: id, face })} className={`min-h-12 rounded-xl text-sm font-semibold ${angle === id ? "bg-accent text-accent-fg" : "border border-line"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
