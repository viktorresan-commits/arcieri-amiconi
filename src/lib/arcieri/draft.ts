import { freshClock, type Clock } from "./clock";
import { asBody, asProgram, type BodyId, type ProgramId } from "./program";
import { asAimAngle, asAimTarget, type AimAngle, type AimTarget, type TallyShot } from "./scoring";

export type DraftMeta = {
  place: string;
  distanceM: number;
  discipline: string;
  bowType: string;
  bowCustom: string;
  face: string;
  setupId: number | null;
  arrowsPerEnd: number;
  endsPlanned: number;
  blocksPlanned: number;
  weather: string;
  feeling: string;
  rating: number | null;
  notes: string;
  stringNote: string;
  gearSnapshot: string;
  startedAt: string;
  endedAt: string;
  program: ProgramId | "";
  body: BodyId | "";
  arrowsChosen: number;
  dispersion: string;
  errors: string;
  targetPhoto: string;
  aimTarget: AimTarget;
  aimAngle: AimAngle;
};

export type DraftShot = TallyShot & { nx: number | null; ny: number | null; seq: number };

export type Draft = {
  clientKey: string;
  meta: DraftMeta;
  shots: DraftShot[];
  clock: Clock;
  endClock: Clock;
  totalLimitMs: number | null;
  endLimitMs: number | null;
  selected: number | null;
};

const KEY = "arcieri-amiconi-draft-v1";

function metaOf(raw: Partial<DraftMeta> | undefined): DraftMeta {
  const base = raw ?? {};
  return {
    place: "",
    distanceM: 18,
    discipline: "tradizionale",
    bowType: "tradizionale",
    bowCustom: "",
    face: "wa10",
    setupId: null,
    arrowsPerEnd: 3,
    endsPlanned: 10,
    blocksPlanned: 1,
    weather: "",
    feeling: "",
    rating: null,
    notes: "",
    stringNote: "",
    gearSnapshot: "",
    startedAt: new Date().toISOString(),
    arrowsChosen: Number(base.arrowsChosen) || 0,
    dispersion: String(base.dispersion ?? ""),
    errors: String(base.errors ?? ""),
    targetPhoto: String(base.targetPhoto ?? ""),
    ...base,
    program: asProgram(String(base.program ?? "")),
    body: asBody(String(base.body ?? "")),
    aimTarget: asAimTarget(base.aimTarget),
    aimAngle: asAimAngle(base.aimAngle),
    endedAt: String(base.endedAt ?? ""),
  };
}

export function loadDraft(): Draft | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (!parsed?.clientKey || !parsed.meta) return null;
    return { ...parsed, meta: metaOf(parsed.meta) };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft | null) {
  if (typeof localStorage === "undefined") return;
  try {
    if (!draft) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* quota: the in-memory draft still works until reload */
  }
}

export function newDraft(meta: DraftMeta, totalLimitMs: number | null, endLimitMs: number | null): Draft {
  return {
    clientKey: crypto.randomUUID(),
    meta,
    shots: [],
    clock: freshClock(),
    endClock: freshClock(),
    totalLimitMs,
    endLimitMs,
    selected: null,
  };
}
