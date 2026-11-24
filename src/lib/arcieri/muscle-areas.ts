/**
 * Muscoli che lavorano in ogni zona del corpo dell'analisi del gesto, con il loro compito nel tiro,
 * e le immagini 3D che li mettono in evidenza sul corpo dell'arciere (stessa posa del video).
 */
import type { AreaId } from "./pose-pro";
import type { Hand, Landmark } from "./pose-analysis";
import { buildModel, v3, type Model, type V3 } from "./anatomy-model";
import { createAnatomyRenderer, viewFrom } from "./anatomy-render";

type Side = "corda" | "arco";
export type MuscleInfo = { ids: string[]; name: string; role: string };

const both = (m: string) => [`corda-${m}`, `arco-${m}`];
const one = (s: Side, m: string) => [`${s}-${m}`];

/** per ogni zona: muscoli coinvolti e da dove guardarli */
export const AREA_MUSCLES: Partial<Record<AreaId, { muscles: MuscleInfo[]; view: { at: string; side: "fronte" | "dietro" | "arco" | "corda"; dist: number; pitch?: number } }>> = {
  testa: {
    muscles: [
      { ids: both("scm"), name: "Sternocleidomastoideo", role: "Gira la testa verso il bersaglio: la testa resta dritta, non si inclina." },
      { ids: both("trapezio-sup"), name: "Trapezio superiore", role: "Va tenuto morbido: se si contrae le spalle salgono verso le orecchie." },
    ],
    view: { at: "headC", side: "arco", dist: 0.95 },
  },
  spalle: {
    muscles: [
      { ids: [...both("deltoide-med"), ...both("deltoide-ant"), ...both("deltoide-post")], name: "Deltoide", role: "Tiene le braccia all'altezza delle spalle." },
      { ids: both("trapezio-sup"), name: "Trapezio superiore", role: "Rilassato: spalla dell'arco bassa." },
      { ids: [...both("trapezio-inf"), ...one("arco", "dentato")], name: "Trapezio inferiore e dentato anteriore", role: "Abbassano e fissano la scapola: la spalla non sale durante la trazione." },
    ],
    view: { at: "shM", side: "dietro", dist: 1.35, pitch: 0.25 },
  },
  braccioArco: {
    muscles: [
      { ids: [...one("arco", "deltoide-med"), ...one("arco", "deltoide-ant")], name: "Deltoide (lato arco)", role: "Tiene il braccio dell'arco alto e fermo, puntato verso il bersaglio." },
      { ids: one("arco", "tricipite"), name: "Tricipite (lato arco)", role: "Tiene il braccio disteso senza bloccare il gomito." },
      { ids: [...one("arco", "sottospinato"), ...one("arco", "dentato")], name: "Sottospinato e dentato anteriore", role: "Spingono l'arco dalla scapola, non dalla mano." },
    ],
    view: { at: "bowArm", side: "arco", dist: 1.2 },
  },
  polsoArco: {
    muscles: [
      { ids: one("arco", "flessori"), name: "Flessori dell'avambraccio (arco)", role: "Da tenere rilassati: la mano spinge, non stringe l'impugnatura." },
      { ids: [...one("arco", "estensori"), ...one("arco", "brachioradiale")], name: "Estensori e brachioradiale (arco)", role: "Tengono il polso dritto dietro l'impugnatura." },
    ],
    view: { at: "bowWr", side: "fronte", dist: 0.75 },
  },
  gomito: {
    muscles: [
      { ids: one("corda", "romboidi"), name: "Romboidi", role: "Chiudono la scapola verso la colonna: sono il motore della trazione." },
      { ids: [...one("corda", "trapezio-med"), ...one("corda", "trapezio-inf")], name: "Trapezio medio e inferiore", role: "Portano la scapola dietro e in basso: gomito in linea con la freccia." },
      { ids: one("corda", "deltoide-post"), name: "Deltoide posteriore", role: "Porta il gomito della corda dietro, all'altezza della freccia." },
      { ids: [...one("corda", "dorsale"), ...one("corda", "sottospinato")], name: "Gran dorsale e sottospinato", role: "Tengono la spalla bassa e continuano l'espansione in ancoraggio." },
    ],
    view: { at: "drawArm", side: "dietro", dist: 1.25, pitch: 0.2 },
  },
  polsoCorda: {
    muscles: [
      { ids: one("corda", "flessori"), name: "Flessori delle dita (corda)", role: "Le dita fanno da ganci: tengono la corda senza stringere il polso." },
      { ids: [...one("corda", "estensori"), ...one("corda", "brachioradiale")], name: "Estensori e brachioradiale (corda)", role: "Dorso della mano piatto e polso rilassato." },
    ],
    view: { at: "drawWr", side: "corda", dist: 0.75 },
  },
  ancoraggio: {
    muscles: [
      { ids: [...one("corda", "bicipite"), ...one("corda", "brachiale")], name: "Bicipite e brachiale (corda)", role: "Tengono il gomito piegato; se tirano troppo la trazione la fa il braccio invece della schiena." },
      { ids: [...one("corda", "deltoide-post"), ...one("corda", "romboidi")], name: "Deltoide posteriore e romboidi", role: "Portano la mano all'ancoraggio dalla schiena." },
    ],
    view: { at: "anchorArm", side: "fronte", dist: 1.05, pitch: 0.15 },
  },
  busto: {
    muscles: [
      { ids: ["erettori"], name: "Erettori della colonna", role: "Busto dritto, senza inarcare la schiena." },
      { ids: ["addome", "obliqui"], name: "Addominali e obliqui", role: "Bacino sotto il busto e niente rotazioni durante la mira." },
    ],
    view: { at: "torso", side: "corda", dist: 1.6 },
  },
  gambe: {
    muscles: [
      { ids: ["glutei"], name: "Glutei", role: "Bacino fermo, peso al centro." },
      { ids: ["quadricipite", "femorali"], name: "Quadricipite e femorali", role: "Ginocchia morbide ma ferme, mai bloccate." },
      { ids: ["polpacci", "tibiale"], name: "Polpacci e tibiale", role: "Equilibrio sui piedi, 50 e 50." },
    ],
    view: { at: "knees", side: "fronte", dist: 1.7, pitch: 0.12 },
  },
};

function targetOf(m: Model, at: string): V3 {
  const p = m.hud.pts;
  if (at === "bowArm") return v3.lerp(p.bowSh, p.bowEl, 0.6);
  if (at === "drawArm") return v3.lerp(p.drawSh, p.drawEl, 0.5);
  if (at === "torso") return v3.lerp(p.hipM, p.shM, 0.5);
  if (at === "anchorArm") return v3.lerp(p.drawEl, p.nock, 0.5);
  return p[at] ?? p.shM;
}

/** direzione della camera: davanti, dietro o dal lato del braccio dell'arco/della corda */
function yawOf(m: Model, side: string) {
  const p = m.hud.pts;
  // il davanti del corpo: perpendicolare alle spalle, verso la camera del video (z positivo)
  const sh = v3.sub(p.bowSh, p.drawSh);
  let f: V3 = v3.norm([-sh[2], 0, sh[0]]);
  if (f[2] < 0) f = v3.mul(f, -1);
  const front = Math.atan2(f[0], f[2]);
  if (side === "dietro") return front + Math.PI;
  if (side === "fronte") return front;
  const toward = v3.sub(side === "arco" ? p.bowSh : p.drawSh, v3.lerp(p.bowSh, p.drawSh, 0.5));
  return Math.atan2(toward[0], toward[2]) * 0.55 + front * 0.45;
}

let shared: { canvas: HTMLCanvasElement; R: NonNullable<ReturnType<typeof createAnatomyRenderer>> } | null = null;

/** immagini (data URL) dei muscoli in evidenza, una per zona */
export function renderAreaImages(lm: Landmark[], aspect: number, hand: Hand, areas: AreaId[], w = 640, h = 520): Record<string, string> {
  const model = buildModel(lm, aspect, hand);
  if (!model || typeof document === "undefined") return {};
  if (!shared) {
    const canvas = document.createElement("canvas");
    const R = createAnatomyRenderer(canvas, true);
    if (!R) return {};
    shared = { canvas, R };
  }
  const { canvas, R } = shared;
  canvas.width = w;
  canvas.height = h;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return {};
  const res: Record<string, string> = {};
  for (const id of areas) {
    const a = AREA_MUSCLES[id];
    if (!a) continue;
    const focus = new Set(a.muscles.flatMap((m) => m.ids));
    const { eye, VP } = viewFrom(targetOf(model, a.view.at), yawOf(model, a.view.side), a.view.pitch ?? 0.1, a.view.dist, w / h, 30);
    R.clear(w, h);
    R.draw(model, VP, eye, 0, { pelle: true, muscolo: true, osso: true }, focus);
    const g = ctx.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, "#14476a");
    g.addColorStop(0.55, "#0a2335");
    g.addColorStop(1, "#040b12");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(canvas, 0, 0);
    res[id] = out.toDataURL("image/jpeg", 0.88);
  }
  return res;
}
