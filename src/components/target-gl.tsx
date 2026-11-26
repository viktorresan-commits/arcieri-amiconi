import { useMemo, useRef, useState } from "react";
import type { Face } from "@/lib/arcieri/scoring";
import { basis, project, v3, type Vec3 } from "@/lib/arcieri/gl3d";
import { drawArrow3D, drawBoss, drawTrees, drawWorld, ringsTexture, type ArrowLook as Look3D } from "@/lib/arcieri/scene3d";
import { drawSkyOverlay, envOf, useSky, type Sky } from "@/lib/arcieri/sky3d";

const CLEAR_DAY: Sky = { tod: "pomeriggio", weather: "sereno" };
import { useMainArrowLook } from "@/lib/arcieri/main-gear";
import { orbit } from "./foc-3d";
import { GLStage, useGLScene } from "./gl-stage";
import { Target3D, type ArrowLook, type Picture } from "./target-3d";
import { SkyPicker } from "./archer-3d";
import { useAvatar } from "./avatar-hero";
import { drawArcher, poseAt, ROUTINE_END } from "@/lib/arcieri/mannequin";
import { bleed, buildSagomaVolume } from "@/lib/arcieri/sagoma-mesh";

type Shot = { x: number; y: number; end?: number; score?: number; miss?: boolean; color?: string; look?: ArrowLook };

const PRESETS: { id: string; label: string; eye: Vec3 }[] = [
  { id: "tre", label: "Tre quarti", eye: [-1.6, 1.75, -2.6] },
  { id: "fronte", label: "Di fronte", eye: [0, 1.4, -2.7] },
  { id: "lato", label: "Di lato", eye: [-3.0, 1.5, -0.3] },
  { id: "alto", label: "Dall'alto", eye: [-0.8, 3.6, -1.6] },
  { id: "arciere", label: "Dalla linea", eye: [0.3, 1.55, -12] },
  { id: "tira", label: "L'arciere tira", eye: [-1.9, 1.75, -14.6] },
];

// sequenza di tiro dell'arciere: ogni freccia ha la sua routine (pre-trazione → rilascio → accompagnamento)
const SEQ = 2.6;
const SEQ_RELEASE = 2.1;
const ARCHER: Vec3 = [-0.55, 0, -12.3];

/** Raggio della visuale in metri dal tipo di bersaglio (122, 80, 60, 40 cm…). */
function radiusOf(face: Face) {
  const m = /(\d{2,3})/.exec(face.id + " " + face.label);
  const cm = m ? Number(m[1]) : 80;
  return cm >= 20 && cm <= 130 ? cm / 200 : 0.4;
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Bersaglio in 3D con WebGL: paglione su cavalletto (o sagoma ritagliata sul prato), cielo e luce
 * dell'ora scelta, frecce dettagliate dell'arciere che arrivano una dopo l'altra e restano piantate;
 * quelle fuori passano oltre e finiscono nel prato dietro. Se WebGL manca, resta la versione 2D.
 */
export function TargetGL({ face, shots, picture, look, bare, faceCanvas }: { face: Face; shots: Shot[]; picture?: Picture | null; look?: ArrowLook; /** senza ora e meteo: cielo sereno di giorno, niente comandi del cielo */ bare?: boolean; /** visuale disegnata a parte (es. con la mappa termica) al posto degli anelli */ faceCanvas?: { canvas: HTMLCanvasElement; key: string } | null }) {
  const { sky: chosenSky } = useSky();
  const sky = bare ? CLEAR_DAY : chosenSky;
  const avatar = useAvatar();
  const main = useMainArrowLook();
  const [preset, setPreset] = useState("tre");
  const presetRef = useRef(preset);
  presetRef.current = preset;
  const [end, setEnd] = useState<number | "tutte">("tutte");
  const ends = useMemo(() => [...new Set(shots.map((s) => s.end ?? 0))].sort((a, b) => a - b), [shots]);
  const shown = useMemo(() => (end === "tutte" ? shots : shots.filter((s) => (s.end ?? 0) === end)), [shots, end]);
  const started = useRef(0);
  const [nonce, setNonce] = useState(0);
  const key = `${shown.length}-${end}-${nonce}`;
  const lastKey = useRef("");

  const { ref, glRef, view, failed } = useGLScene((g, o, w, h, time, v) => {
    if (lastKey.current !== key) {
      lastKey.current = key;
      started.current = time;
    }
    const t = time - started.current;
    const R = radiusOf(face);
    const gH = picture ? 0 : 1.3;
    const k = picture ? 0.45 : R; // unità della faccia → metri
    const p = PRESETS.find((x) => x.id === presetRef.current) ?? PRESETS[0];
    const zoom = Math.max(0.6, R / 0.4);
    const seq = p.id === "tira";
    const eye: Vec3 = p.id === "arciere" || seq ? p.eye : [p.eye[0] * zoom, gH ? 1.3 + (p.eye[1] - 1.4) * zoom : p.eye[1] * 0.6 * zoom, p.eye[2] * zoom];
    const target: Vec3 = seq ? [0.1, 0.75, -1.5] : picture ? [0, picture.halfH * k, 0] : [0, gH, 0];
    const cam = orbit(eye, target, v);
    g.begin(cam.eye as Vec3, cam.target as Vec3, 42, envOf(sky));
    drawWorld(g, [0, 0, 0], 400, sky, time);
    drawTrees(g, 30, 11);
    // linea di tiro lontana
    g.draw("box", basis([0, 0.006, -12], [6, 0, 0], [0, 0.006, 0], [0, 0, 0.08]), [1, 1, 1], { unlit: true, alpha: 0.7 });
    let depthAt: ((x: number, y: number) => number) | null = null;
    if (picture) {
      const hw = picture.halfW * k;
      const hh = picture.halfH * k;
      // sagoma in volume, gonfiata dal contorno della foto come la schiuma vera
      const vol = g.once(`vol-${picture.img.src}-${hw.toFixed(3)}-${hh.toFixed(3)}`, () => {
        const v3d = buildSagomaVolume(picture.img, hw, hh);
        return v3d ? { mesh: g.mesh(v3d.geo), depthAt: v3d.depthAt, tex: g.textureFrom(v3d.skin, false, false) } : null;
      });
      const skinTex = picture.skin ? g.once(`skin-${picture.skinKey ?? "x"}`, () => g.textureFrom(bleed(picture.skin as HTMLCanvasElement), false, false)) : null;
      if (vol) {
        depthAt = vol.depthAt;
        g.draw(vol.mesh, basis([0, 0.02, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]), [1, 1, 1], { tex: skinTex ?? vol.tex, shine: 0.12 });
        // paletto e base di legno sotto le zampe
        g.draw("box", basis([0, 0.02, 0], [hw * 1.2, 0, 0], [0, 0.04, 0], [0, 0, 0.32 * k]), [0.36, 0.26, 0.17]);
        g.shadow([0.15, 0, 0.2], hw * 1.15, 0.42 * k, 0.4);
      } else {
        const tex = g.once(`pic-${picture.img.src}`, () => g.textureFrom(picture.img, false, false));
        for (const z of [0.06, 0.04, 0.02]) g.draw("plane", basis([0, hh, z * k], [-2 * hw, 0, 0], [0, 0, 1], [0, -2 * hh, 0]), [0.22, 0.2, 0.18], { tex, texAlpha: true });
        g.draw("plane", basis([0, hh, 0], [-2 * hw, 0, 0], [0, 0, 1], [0, -2 * hh, 0]), [1, 1, 1], { tex: skinTex ?? tex, texAlpha: true, shine: 0.08 });
        g.shadow([0.2, 0, 0.3], hw * 1.1, 0.35 * k, 0.35);
      }
    } else {
      const faceTex = faceCanvas ? g.once(`face-${faceCanvas.key}`, () => g.textureFrom(faceCanvas.canvas, true, false)) : ringsTexture(g, face.id, face.rings);
      drawBoss(g, 0, gH, 0, R, Math.max(0.6, R * 1.6), 10, faceTex);
    }
    // frecce
    const n = shown.length;
    const stag = n <= 1 ? 0 : Math.min(0.2, 2.4 / n);
    const FLY = seq ? 0.75 : 0.62;
    // l'arciere sulla linea: tira una freccia dopo l'altra, poi si rilassa
    if (seq) {
      const lastRel = (n - 1) * SEQ + SEQ_RELEASE;
      let tt: number;
      if (t >= lastRel) tt = Math.min(ROUTINE_END, (t - lastRel) * 1.2);
      else {
        const l = ((t % SEQ) + SEQ) % SEQ;
        tt = -4.2 + (l / SEQ_RELEASE) * 4.2;
        if (l > SEQ_RELEASE) tt = (l - SEQ_RELEASE) * 1.6;
      }
      drawArcher(g, ARCHER, [0, 0, 1], 1, poseAt(tt), avatar.shown, { ...main, ...(look ?? {}) }, 0.72);
    }
    const len = 0.72;
    const r = 0.0045 * 1.3;
    const flashes: { p: Vec3; k: number }[] = [];
    shown.forEach((shot, i) => {
      const lk: Look3D = { ...main, ...(look ?? {}), ...(shot.look ?? {}) };
      if (shot.color) {
        lk.fletch = shot.color;
        lk.cock = shot.color;
        lk.nock = shot.color;
      }
      const r1 = hash(i * 7 + 1);
      const r2 = hash(i * 13 + 5);
      const roll = hash(i * 3 + 11) * Math.PI * 2;
      const off = picture ? Boolean(shot.miss) : Math.abs(shot.x) > 1.2 || Math.abs(shot.y) > 1.2;
      let hit: Vec3;
      let dir: Vec3;
      if (off) {
        const y0 = (picture ? picture.halfH * k * 2 : gH) - shot.y * k;
        const fall = 0.16 + r2 * 0.1;
        const run = Math.min(6, Math.max(0.6, y0 / fall));
        hit = [-shot.x * k * (1 + run * 0.1), 0.02, run];
        dir = v3.norm([(r1 - 0.5) * 0.08, -fall * 1.4, 1]);
      } else {
        if (picture) {
          const hx = -shot.x * k;
          const hy = picture.halfH * k - shot.y * k + 0.02;
          hit = [hx, hy, depthAt ? -depthAt(hx, hy - 0.02) : 0];
        } else hit = [-shot.x * k, gH - shot.y * k, 0];
        dir = v3.norm([(r1 - 0.5) * 0.12 - shot.x * 0.03, -((r2 - 0.5) * 0.08 + 0.05), 1]);
      }
      const s0 = seq ? i * SEQ + SEQ_RELEASE : i * stag;
      const u = (t - s0) / FLY;
      if (u < 0) return;
      const depthIn = off ? len * 0.35 : 0.07;
      if (u < 1) {
        // in volo: arriva dalla linea di tiro con una piccola parabola
        const start: Vec3 = seq ? [ARCHER[0] + 0.12, 1.45, ARCHER[2] + 0.55] : [-shot.x * 0.15 * k + (r1 - 0.5) * 0.6, gH + 0.4 + r2 * 0.4, -12];
        const e = 1 - (1 - u) ** 2;
        const pos = v3.lerp(start, hit, e);
        pos[1] += Math.sin(Math.PI * e) * 0.25;
        const fdir = v3.norm(v3.sub(hit, start));
        drawArrow3D(g, v3.sub(pos, v3.scale(fdir, len)), fdir, len, roll + time * 22, r, lk);
        return;
      }
      drawArrow3D(g, v3.sub(v3.add(hit, v3.scale(dir, depthIn)), v3.scale(dir, len)), dir, len, roll, r, lk);
      if (!off && t - s0 - FLY < 0.45) flashes.push({ p: hit, k: (t - s0 - FLY) / 0.45 });
    });
    if (!bare) drawSkyOverlay(o, g, sky, w, h, time);
    for (const f of flashes) {
      const q = project(g.vp, f.p, w, h);
      if (!q) continue;
      o.strokeStyle = `rgba(255,248,220,${(1 - f.k) * 0.95})`;
      o.lineWidth = 2;
      o.beginPath();
      o.arc(q.x, q.y, 4 + f.k * 22, 0, Math.PI * 2);
      o.stroke();
    }
  });

  if (failed) return <Target3D face={face} shots={shots} picture={picture} look={look} />;
  return (
    <div className="grid gap-2">
      {ends.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          <button type="button" onClick={() => setEnd("tutte")} className={`min-h-10 shrink-0 rounded-full px-3 text-sm ${end === "tutte" ? "bg-accent text-accent-fg" : "border border-line"}`}>Tutte</button>
          {ends.map((value) => (
            <button key={value} type="button" onClick={() => setEnd(value)} className={`min-h-10 shrink-0 rounded-full px-3 text-sm ${end === value ? "bg-accent text-accent-fg" : "border border-line"}`}>Volée {value + 1}</button>
          ))}
        </div>
      ) : null}
      <GLStage glRef={glRef} overlayRef={ref} view={view} className="h-[26rem] w-full sm:h-80" label="Bersaglio in 3D con le frecce" hint={false}>
        <div className="absolute left-2 top-2 flex gap-1.5">
          <button type="button" onClick={() => setNonce((x) => x + 1)} className="min-h-9 rounded-full bg-black/55 px-3 text-xs font-semibold text-white backdrop-blur">Rivedi i tiri</button>
        </div>
        {bare ? null : <SkyPicker className="absolute bottom-11 left-2" />}
      </GLStage>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={preset === item.id}
            className="aa-chip shrink-0"
            onClick={() => {
              setPreset(item.id);
              const auto = view.current.auto;
              view.current = { yaw: 0, pitch: 0, zoom: 1, px: 0, py: 0, touched: false, auto, spin: 0 };
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

