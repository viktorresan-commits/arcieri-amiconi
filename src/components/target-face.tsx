import { useRef, useState } from "react";
import { ringPoint, scoreAtRadius, type Face } from "@/lib/arcieri/scoring";

export function TargetFace({
  face,
  shots,
  onHit,
  onMove,
  onPick,
  picked,
  interactive = true,
  color = "var(--fg)",
  numbers = false,
}: {
  face: Face;
  shots: { nx: number | null; ny: number | null; score?: number; isX?: boolean; miss?: boolean; arrow?: number; tag?: number | null }[];
  onHit?: (nx: number, ny: number) => void;
  onMove?: (index: number, nx: number, ny: number, done: boolean) => void;
  /** Tocco breve su una freccia già segnata (senza trascinarla). */
  onPick?: (index: number) => void;
  picked?: number | null;
  interactive?: boolean;
  color?: string;
  numbers?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const grab = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { cx: number; cy: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loupe, setLoupe] = useState<{ x: number; y: number; label: string } | null>(null);
  const active = interactive && (Boolean(onHit) || Boolean(onMove) || Boolean(onPick));

  function local(clientX: number, clientY: number) {
    const svg = ref.current;
    const box = svg?.getScreenCTM();
    if (!svg || !box) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const mapped = point.matrixTransform(box.inverse());
    return { x: (mapped.x - pan.x) / zoom, y: (mapped.y - pan.y) / zoom };
  }

  function nearest(x: number, y: number) {
    let best = -1;
    let bestD = 0.16 / zoom;
    shots.forEach((shot, index) => {
      const placed = placeShot(face, shot, index);
      if (!placed) return;
      const distance = Math.hypot(placed.x - x, placed.y - y);
      if (distance < bestD) {
        bestD = distance;
        best = index;
      }
    });
    return best;
  }

  function zoomAt(next: number) {
    const z = Math.min(6, Math.max(1, next));
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  }

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox="-1.12 -1.12 2.24 2.24"
        className={`mx-auto aspect-square w-full max-w-md select-none ${active ? "touch-none" : "touch-pan-y"}`}
        onPointerDown={active ? (event) => {
          const point = local(event.clientX, event.clientY);
          if (!point) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { cx: event.clientX, cy: event.clientY });
          if (pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { dist: Math.hypot(a.cx - b.cx, a.cy - b.cy) || 1, zoom };
            drag.current = null;
            setLoupe(null);
            return;
          }
          const index = onMove || onPick ? nearest(point.x, point.y) : -1;
          if (index >= 0) {
            // si sposta solo se il dito si muove davvero: un tocco fermo apre la scelta del numero
            drag.current = index;
            grab.current = { x: point.x, y: point.y, moved: false };
            start.current = null;
            return;
          }
          drag.current = null;
          start.current = point;
        } : undefined}
        onPointerMove={active ? (event) => {
          const point = local(event.clientX, event.clientY);
          if (!point) return;
          if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { cx: event.clientX, cy: event.clientY });
          if (pointers.current.size >= 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy) || 1;
            zoomAt(pinch.current.zoom * (dist / pinch.current.dist));
            return;
          }
          if (drag.current == null || !onMove) return;
          if (grab.current && !grab.current.moved) {
            if (Math.hypot(point.x - grab.current.x, point.y - grab.current.y) < 0.035 / zoom) return;
            grab.current.moved = true;
          }
          const hit = scoreAtRadius(face, Math.hypot(point.x, point.y));
          setLoupe({ x: point.x, y: point.y, label: hit.miss ? "M" : hit.isX ? "X" : String(hit.score) });
          onMove?.(drag.current, point.x, point.y, false);
        } : undefined}
        onPointerUp={active ? (event) => {
          const point = local(event.clientX, event.clientY);
          pointers.current.delete(event.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          if (drag.current != null && point) {
            if (grab.current?.moved) onMove?.(drag.current, point.x, point.y, true);
            else if (onPick) {
              if (navigator.vibrate) navigator.vibrate(12);
              onPick(drag.current);
            }
          } else if (start.current && point && Math.hypot(point.x - start.current.x, point.y - start.current.y) < 0.08 / zoom) onHit?.(point.x, point.y);
          drag.current = null;
          grab.current = null;
          start.current = null;
          setLoupe(null);
        } : undefined}
        onPointerCancel={() => {
          pointers.current.clear();
          pinch.current = null;
          drag.current = null;
          start.current = null;
          setLoupe(null);
        }}
        role="img"
        aria-label={face.label}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <circle cx="0" cy="0" r="1.08" fill="var(--elev)" />
          {face.rings.map((ring) => (
            <circle key={`${ring.label}-${ring.outer}`} cx="0" cy="0" r={ring.outer} fill={ring.fill} />
          ))}
          {face.rings
            .filter((ring) => !ring.x)
            .map((ring) => (
              <text
                key={`label-${ring.outer}`}
                x="0"
                y={-((ring.inner + ring.outer) / 2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={ring.ink}
                fontSize={Math.max(0.055, (ring.outer - ring.inner) * 0.62)}
                fontFamily="var(--font-disp)"
              >
                {ring.label}
              </text>
            ))}
          {face.rings
            .filter((ring) => ring.x)
            .map((ring) => (
              <text key="x" y="0.02" textAnchor="middle" dominantBaseline="middle" fill={ring.ink} fontSize="0.07" fontFamily="var(--font-disp)">
                {ring.label}
              </text>
            ))}
          {shots.map((shot, index) => {
            const placed = placeShot(face, shot, index);
            if (!placed) return null;
            const n = shot.tag != null ? shot.tag : (shot.arrow ?? index) + 1;
            const sel = picked === index;
            if (placed.miss) {
              return (
                <text key={index} x={placed.x} y={placed.y} textAnchor="middle" fill="var(--fg)" fontSize="0.07" fontFamily="var(--font-disp)">
                  {numbers ? n : "M"}
                </text>
              );
            }
            return (
              <g key={index}>
                {sel ? <circle cx={placed.x} cy={placed.y} r={0.085} fill="none" stroke="var(--accent)" strokeWidth="0.014" className="aa-pulse" /> : null}
                <circle cx={placed.x} cy={placed.y} r={numbers ? 0.055 : 0.045} fill={shot.tag != null ? "var(--accent)" : color} stroke="#14181c" strokeWidth="0.012" />
                {numbers ? (
                  <text x={placed.x} y={placed.y + 0.018} textAnchor="middle" fill="#14181c" fontSize={n >= 10 ? 0.045 : 0.055} fontFamily="var(--font-disp)">
                    {n}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {loupe ? (
        <svg viewBox={`${loupe.x - 0.22} ${loupe.y - 0.22} 0.44 0.44`} className="pointer-events-none absolute right-2 top-2 h-28 w-28 rounded-full border border-line bg-elev shadow-card">
          {face.rings.map((ring) => (
            <circle key={`l-${ring.outer}`} cx="0" cy="0" r={ring.outer} fill={ring.fill} />
          ))}
          <circle cx={loupe.x} cy={loupe.y} r="0.02" fill="none" stroke="#fff" strokeWidth="0.008" />
          <text x={loupe.x} y={loupe.y - 0.05} textAnchor="middle" fill="#fff" fontSize="0.07" fontFamily="var(--font-disp)">
            {loupe.label}
          </text>
        </svg>
      ) : null}
      {active ? (
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="min-h-11 rounded-full border border-line px-3 text-sm" onClick={() => zoomAt(zoom / 1.25)} aria-label="Riduci">−</button>
          <button type="button" className="min-h-11 rounded-full border border-line px-3 text-sm" onClick={() => zoomAt(zoom * 1.25)} aria-label="Ingrandisci">+</button>
          {zoom !== 1 ? <button type="button" className="min-h-11 rounded-full border border-line px-3 text-sm" onClick={() => zoomAt(1)}>1:1</button> : null}
        </div>
      ) : null}
    </div>
  );
}

function placeShot(
  face: Face,
  shot: { nx: number | null; ny: number | null; score?: number; isX?: boolean; miss?: boolean },
  index: number,
) {
  const miss = Boolean(shot.miss) || shot.score === 0;
  if (shot.score == null && (shot.nx == null || shot.ny == null)) return null;
  if (shot.nx != null && shot.ny != null && shot.score == null) return { x: shot.nx, y: shot.ny, miss };
  if (shot.nx != null && shot.ny != null) {
    const hit = scoreAtRadius(face, Math.hypot(shot.nx, shot.ny));
    const same = miss ? hit.miss : shot.isX ? hit.isX : !hit.miss && !hit.isX && hit.score === shot.score;
    if (same) return { x: shot.nx, y: shot.ny, miss };
  }
  const spot = ringPoint(face, shot.score ?? 0, Boolean(shot.isX), miss, index);
  return { x: spot.nx, y: spot.ny, miss };
}
