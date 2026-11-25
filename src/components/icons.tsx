import { useId, type CSSProperties, type ReactNode } from "react";
import { DETAILED_MORE } from "./icons-more";
import { Insignia, type InsigniaProps } from "./insignia";

/** gare, premi, sfide, obiettivi e classifiche: al posto della tessera, un'insegna coniata */
const INSIGNIA_FOR: Partial<Record<string, Pick<InsigniaProps, "symbol" | "metal" | "enamel" | "shape">>> = {
  trophy: { symbol: "trophy", metal: "gold", enamel: "ruby", shape: "rosette" },
  medal: { symbol: "laurel", metal: "gold", enamel: "sapphire", shape: "rosette" },
  duel: { symbol: "duel", metal: "silver", enamel: "ruby", shape: "shield" },
  flag: { symbol: "peak", metal: "gold", enamel: "teal", shape: "round" },
  podium: { symbol: "podium", metal: "gold", enamel: "night", shape: "hex" },
  game: { symbol: "dice", metal: "silver", enamel: "amethyst", shape: "hex" },
};

/**
 * Set di icone dell'app, disegnato apposta (griglia 24×24, tratto 1.7, due toni).
 * Un solo stile per tutto: niente emoji. `Glyph` è l'icona nuda, `AppIcon` la tessera colorata.
 */

export type IconName =
  | "bolt" | "camera" | "bow" | "archer" | "notebook" | "history" | "trophy" | "chart" | "ballistics"
  | "quiver" | "team" | "calendar" | "podium" | "duel" | "flag" | "megaphone" | "compare" | "game"
  | "bag" | "user" | "breath" | "posture" | "timer" | "palette" | "pin" | "wind" | "follow" | "target"
  | "video" | "image" | "download" | "link" | "key" | "trash" | "shield" | "sparkle" | "import" | "ticket"
  | "gear" | "plus" | "check" | "play" | "stack" | "flame" | "level" | "arrow" | "hand" | "scan" | "edit"
  | "eye" | "save" | "share" | "close" | "chevron" | "broom" | "medal" | "crosshair" | "mountain" | "home" | "grid"
  | "sight" | "checklist" | "stopwatch" | "foc" | "wrench" | "hold"
  | "steps" | "lungs" | "scorecard" | "spine" | "windsock" | "energy" | "span" | "bareshaft" | "caliper" | "ruler"
  | "daily" | "quiz" | "binoculars" | "book" | "rules" | "lock" | "expand" | "search" | "help"
  | "footprints" | "trend"
  | "bowstring" | "rest" | "stabilizer" | "armguard" | "release" | "chestguard" | "bowcase" | "bowstand" | "shirt" | "shoe";

const A = 0.32; // opacità del secondo tono

// ogni icona: tratti (stroke) e riempimenti tenui (fill, secondo tono)
const ICONS: Partial<Record<IconName, ReactNode>> = {
  // attrezzatura: stessi tratti e stesso secondo tono delle altre icone
  bowstring: (<><path d="M7 3c5 4 5 14 0 18" /><path d="M7 3v18" strokeDasharray="2 2.2" /><path d="M4 9.5c1.6.6 3 .6 4.6 0M4 14.5c1.6-.6 3-.6 4.6 0" /><circle cx="7" cy="12" r="1.4" fill="currentColor" fillOpacity={A} /><path d="M14 8l5-3M14 16l5 3" /></>),
  rest: (<><rect x="3" y="13" width="11" height="7" rx="1.6" fill="currentColor" fillOpacity={A} /><path d="M12 15l7-7" /><circle cx="19.5" cy="7.5" r="1.6" /><path d="M2 9h20" strokeOpacity={0.55} /></>),
  stabilizer: (<><path d="M3 12h13" /><rect x="15" y="9.5" width="6" height="5" rx="1.4" fill="currentColor" fillOpacity={A} /><path d="M3 9.5v5M7 10.5v3M11 10.5v3" /></>),
  armguard: (<><path d="M6 3h8c3 4 3 14 0 18H6c2-6 2-12 0-18z" fill="currentColor" fillOpacity={A} /><path d="M8.5 7h5M8.5 12h6M8.5 17h5" /></>),
  release: (<><path d="M6 4h5v6a4 4 0 0 1-4 4H6z" fill="currentColor" fillOpacity={A} /><path d="M8 14v6M6 20h4" /><path d="M11 7h4l3 2-3 2h-4" /><circle cx="18.5" cy="9" r="1" /></>),
  chestguard: (<><path d="M5 5c4-2 10-2 14 0v9c-3 4-11 4-14 0z" fill="currentColor" fillOpacity={A} /><path d="M5 5 3 3M19 5l2-2M9 9h6M8 12.5h8" /></>),
  bowcase: (<><rect x="2.5" y="7" width="19" height="12" rx="2.4" fill="currentColor" fillOpacity={A} /><path d="M9 7V5h6v2M2.5 12h19M11 12v2h2v-2" /></>),
  bowstand: (<><path d="M12 3v10M12 13l-6 8M12 13l6 8M12 13v8" /><path d="M9 4c2-1 4-1 6 0" /><circle cx="12" cy="13" r="1.6" fill="currentColor" fillOpacity={A} /></>),
  shirt: (<><path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.6 1.6-2 2.4-4 2.4S8.6 4.6 8 3z" fill="currentColor" fillOpacity={A} /><path d="M10 12h4" /></>),
  shoe: (<><path d="M3 9c3 0 5-1 6-4h3l1 5c3 1 6 2 8 4v3H3z" fill="currentColor" fillOpacity={A} /><path d="M3 17h18M10 8h2M10.5 10.5h2.5" /></>),
  expand: (<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />),
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" fillOpacity={A} /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  steps: (<><path d="M5 6h4M5 12h4M5 18h4" /><path d="M12 6h7M12 12h7M12 18h5" /><circle cx="3" cy="6" r="0.6" /></>),
  lungs: (<><path d="M12 4v8M12 12l-3 2M12 12l3 2" /><path d="M9 7C5 8 4 13 4 17c0 2 2 3 4 2l2-1V9zM15 7c4 1 5 6 5 10 0 2-2 3-4 2l-2-1V9z" fill="currentColor" fillOpacity={A} /></>),
  scorecard: (<><rect x="4" y="3" width="16" height="18" rx="2" fill="currentColor" fillOpacity={A} /><path d="M8 8h8M8 12h8M8 16h5M12 6v12" /></>),
  spine: (<><path d="M3 15c5-5 13-5 18 0" /><path d="M3 13l-1 2 1 2M21 13l1 2-1 2" /><path d="M12 6v3M10.5 7.5 12 9l1.5-1.5" /></>),
  windsock: (<><path d="M4 3v18" /><path d="M4 5l14 2v6L4 15z" fill="currentColor" fillOpacity={A} /><path d="M9 5.7v8.6M14 6.4v7.2" /></>),
  energy: (<><path d="M13 2 5 13h6l-1 9 8-11h-6z" fill="currentColor" fillOpacity={A} /></>),
  span: (<><circle cx="12" cy="5" r="2" /><path d="M2 10h20M12 7v8l-3 6M12 15l3 6" /></>),
  bareshaft: (<><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="10" cy="13" r="2.5" fill="currentColor" fillOpacity={A} /><circle cx="15" cy="9" r="1.2" /></>),
  caliper: (<><path d="M4 4h4v16H4zM8 6h12M8 10h9M17 10v4" /><path d="M11 6v2M14 6v2" /></>),
  ruler: (<><rect x="2" y="8" width="20" height="8" rx="1.5" fill="currentColor" fillOpacity={A} /><path d="M6 8v3M10 8v4M14 8v3M18 8v4" /></>),
  daily: (<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4" /><path d="M12 10l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 16l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" fill="currentColor" fillOpacity={A} /></>),
  quiz: (<><path d="M4 5h16v11H9l-5 4z" fill="currentColor" fillOpacity={A} /><path d="M10 9a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.5M12 14v.01" /></>),
  binoculars: (<><circle cx="7" cy="15" r="4" /><circle cx="17" cy="15" r="4" /><path d="M9 7l-2 4M15 7l2 4M10 13h4" /></>),
  book: (<><path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z" fill="currentColor" fillOpacity={A} /><path d="M20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z" /></>),
  rules: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity={A} /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>),
  foc: (
    <>
      <path d="M3 10h18M19 8l2 2-2 2M3 8.5v3" />
      <path d="M12 10l-3.5 8h7z" fill="currentColor" fillOpacity={A} />
      <path d="M7 20h10" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2z" fill="currentColor" fillOpacity={A} />
      <path d="M4 7c2-2 5-2 7 0" />
    </>
  ),
  hold: (
    <>
      <path d="M5 11c3 4 11 4 14 0M5 11c3-3 11-3 14 0" />
      <rect x="2" y="8.5" width="3" height="5" rx="1" fill="currentColor" fillOpacity={A} />
      <rect x="19" y="8.5" width="3" height="5" rx="1" fill="currentColor" fillOpacity={A} />
      <circle cx="12" cy="18.5" r="2.5" />
    </>
  ),
  bolt: (
    <>
      <path d="M13.2 2.8 5.6 13.1h5.6l-1.3 8.1 8.5-11.3h-5.8l.6-7.1Z" fill="currentColor" fillOpacity={A} />
      <path d="M13.2 2.8 5.6 13.1h5.6l-1.3 8.1 8.5-11.3h-5.8l.6-7.1Z" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8.2c0-1 .8-1.8 1.8-1.8h2.2l1.4-2h6.2l1.4 2h2.2c1 0 1.8.8 1.8 1.8v9.3c0 1-.8 1.8-1.8 1.8H5.3c-1 0-1.8-.8-1.8-1.8V8.2Z" fill="currentColor" fillOpacity={A} />
      <path d="M3.5 8.2c0-1 .8-1.8 1.8-1.8h2.2l1.4-2h6.2l1.4 2h2.2c1 0 1.8.8 1.8 1.8v9.3c0 1-.8 1.8-1.8 1.8H5.3c-1 0-1.8-.8-1.8-1.8V8.2Z" />
      <circle cx="12" cy="12.8" r="3.9" />
      <circle cx="12" cy="12.8" r="1.4" fill="currentColor" />
    </>
  ),
  bow: (
    <>
      <path d="M8.5 3.2c.9.1 1.6.6 1.8 1.3 4 2.1 5.5 4.9 5.5 7.5s-1.5 5.4-5.5 7.5c-.2.7-.9 1.2-1.8 1.3" fill="none" />
      <path d="M10.3 4.5c4 2.1 5.5 4.9 5.5 7.5s-1.5 5.4-5.5 7.5" strokeWidth={3.2} strokeOpacity={A} />
      <path d="M8.6 3.4v17.2" strokeOpacity={0.6} />
      <path d="M3.2 12h17" />
      <path d="m17.4 9.5 3 2.5-3 2.5" />
      <path d="M3.2 12 5 10.2M3.2 12 5 13.8M5.2 12 7 10.2M5.2 12 7 13.8" strokeOpacity={0.75} />
    </>
  ),
  archer: (
    <>
      <circle cx="8.6" cy="5" r="2" fill="currentColor" fillOpacity={A} />
      <circle cx="8.6" cy="5" r="2" />
      <path d="M8.6 7.3v6.4l-2.4 7M8.6 13.7l2.6 7" />
      <path d="M8.6 9.2h7.9M8.6 9.2l-2.8.4 1.8-2.6" />
      <path d="M16.3 3.5c1.9 1.6 2.9 3.6 2.9 5.7s-1 4.1-2.9 5.7" />
      <path d="M16.3 3.5v11.4" strokeOpacity={0.5} />
      <path d="M6 9.2h14.5" strokeOpacity={0.4} strokeDasharray="1 1.6" />
    </>
  ),
  notebook: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.2" fill="currentColor" fillOpacity={A} />
      <rect x="5" y="3" width="14" height="18" rx="2.2" />
      <path d="M8.6 3v18" strokeOpacity={0.55} />
      <path d="m11.2 12.3 1.9 1.9 3.6-4" />
    </>
  ),
  history: (
    <>
      <circle cx="12.5" cy="12" r="8" fill="currentColor" fillOpacity={A} />
      <path d="M4.5 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4.2v3.6h3.6" />
      <path d="M12.5 7.6V12l3 2" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 3.5h9v5.2a4.5 4.5 0 0 1-9 0V3.5Z" fill="currentColor" fillOpacity={A} />
      <path d="M7.5 3.5h9v5.2a4.5 4.5 0 0 1-9 0V3.5Z" />
      <path d="M7.5 5.5H4.6c0 3 1.2 4.6 3.2 4.9M16.5 5.5h2.9c0 3-1.2 4.6-3.2 4.9" />
      <path d="M12 13.2v3.4M8.6 20.5h6.8M9.6 16.6h4.8l.6 3.9H9l.6-3.9Z" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <rect x="5.5" y="12" width="3" height="8" rx="1" fill="currentColor" fillOpacity={A} />
      <rect x="10.5" y="8.5" width="3" height="11.5" rx="1" fill="currentColor" fillOpacity={A} />
      <rect x="15.5" y="5" width="3" height="15" rx="1" fill="currentColor" fillOpacity={A} />
      <path d="m4.5 10 5-4 4 2.5 6-5" />
      <circle cx="19.5" cy="3.5" r="1" fill="currentColor" />
    </>
  ),
  ballistics: (
    <>
      <path d="M3 19.5C6 9 12 5.5 16.5 8.5" strokeDasharray="2.2 2.2" />
      <path d="m15.2 6.2 2.6 2.7-3.3 1" />
      <circle cx="18.5" cy="15" r="3.5" fill="currentColor" fillOpacity={A} />
      <circle cx="18.5" cy="15" r="3.5" />
      <circle cx="18.5" cy="15" r="1.1" fill="currentColor" />
      <path d="M3 20.5h18" strokeOpacity={0.55} />
    </>
  ),
  quiver: (
    <>
      <path d="M7.3 9.2 9.7 21h4.6l2.4-11.8H7.3Z" fill="currentColor" fillOpacity={A} />
      <path d="M7.3 9.2 9.7 21h4.6l2.4-11.8H7.3Z" />
      <path d="M9.4 9.2 8 3.5M12 9.2V2.8M14.6 9.2 16 3.5" />
      <path d="m7 4.4 1-1.6 1 1.6M11 3.6l1-1.6 1 1.6M15 4.4l1-1.6 1 1.6" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3.2" fill="currentColor" fillOpacity={A} />
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5c.5-3.4 3-5.3 6-5.3s5.5 1.9 6 5.3" />
      <circle cx="16.6" cy="7.4" r="2.5" />
      <path d="M17 12.6c2.3.3 3.8 2 4.1 4.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.4" fill="currentColor" fillOpacity={A} />
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.4" />
      <path d="M3.5 9.6h17M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="2.2" />
    </>
  ),
  podium: (
    <>
      <rect x="9" y="8.5" width="6" height="12" rx="1" fill="currentColor" fillOpacity={A} />
      <path d="M9 20.5v-12h6v12M3.5 20.5v-7H9M15 11.5h5.5v9M2.8 20.5h18.4" />
      <path d="m12 3.2.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3.9-1.8Z" fill="currentColor" />
    </>
  ),
  duel: (
    <>
      <path d="m4 20 16-16M20 20 4 4" />
      <path d="M16.2 4H20v3.8M7.8 4H4v3.8" />
      <path d="m4.8 17.2 2 2M19.2 17.2l-2 2" strokeOpacity={0.6} />
      <circle cx="12" cy="12" r="2.3" fill="currentColor" fillOpacity={A} />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V3.5" />
      <path d="M6 4.2c3.8-1.8 6.2 1.6 10.5 0v8.2c-4.3 1.6-6.7-1.8-10.5 0V4.2Z" fill="currentColor" fillOpacity={A} />
      <path d="M6 4.2c3.8-1.8 6.2 1.6 10.5 0v8.2c-4.3 1.6-6.7-1.8-10.5 0" />
      <circle cx="6" cy="21" r="1" fill="currentColor" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10.2v3.6c0 .7.5 1.2 1.2 1.2h2.3l7.5 4.5V4.5L7.5 9H5.2C4.5 9 4 9.5 4 10.2Z" fill="currentColor" fillOpacity={A} />
      <path d="M4 10.2v3.6c0 .7.5 1.2 1.2 1.2h2.3l7.5 4.5V4.5L7.5 9H5.2C4.5 9 4 9.5 4 10.2Z" />
      <path d="M8 15l1 5h2.2l-.8-3.6M18 9.2a4 4 0 0 1 0 5.6M20.2 7a7 7 0 0 1 0 10" />
    </>
  ),
  compare: (
    <>
      <path d="M12 3.5v17M6 20.5h12M5 6.5h14" />
      <path d="m5 6.5-2.6 6.2a2.8 2.8 0 0 0 5.2 0L5 6.5ZM19 6.5l-2.6 6.2a2.8 2.8 0 0 0 5.2 0L19 6.5Z" fill="currentColor" fillOpacity={A} />
      <path d="m5 6.5-2.6 6.2h5.2L5 6.5ZM19 6.5l-2.6 6.2h5.2L19 6.5Z" />
    </>
  ),
  game: (
    <>
      <path d="M7.2 7.5h9.6a4.2 4.2 0 0 1 4.1 5l-.9 4.2a2.3 2.3 0 0 1-3.9 1.1L14 15.5h-4l-2.1 2.3A2.3 2.3 0 0 1 4 16.7l-.9-4.2a4.2 4.2 0 0 1 4.1-5Z" fill="currentColor" fillOpacity={A} />
      <path d="M7.2 7.5h9.6a4.2 4.2 0 0 1 4.1 5l-.9 4.2a2.3 2.3 0 0 1-3.9 1.1L14 15.5h-4l-2.1 2.3A2.3 2.3 0 0 1 4 16.7l-.9-4.2a4.2 4.2 0 0 1 4.1-5Z" />
      <path d="M8 10v3M6.5 11.5h3" />
      <circle cx="15.6" cy="10.6" r=".9" fill="currentColor" />
      <circle cx="17.4" cy="12.4" r=".9" fill="currentColor" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12.5H6L5 8Z" fill="currentColor" fillOpacity={A} />
      <path d="M5 8h14l-1 12.5H6L5 8Z" />
      <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.8" fill="currentColor" fillOpacity={A} />
      <circle cx="12" cy="8.2" r="3.8" />
      <path d="M4.5 20.5c.8-4 3.8-6.3 7.5-6.3s6.7 2.3 7.5 6.3" />
    </>
  ),
  breath: (
    <>
      <path d="M4 9h10.5a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M4 13h14a3 3 0 1 1-3 3" />
      <path d="M4 17h6" strokeOpacity={0.6} />
    </>
  ),
  posture: (
    <>
      <circle cx="12" cy="4.5" r="2" fill="currentColor" fillOpacity={A} />
      <path d="M12 7v7.5M12 14.5l-3 6M12 14.5l3 6" />
      <path d="M4 9.5h16" />
      <path d="M7 9.5 9 7.4M17 9.5 15 7.4" strokeOpacity={0.6} />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7" fill="currentColor" fillOpacity={A} />
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 9.5v4l2.6 1.6M9.5 2.8h5M12 2.8v3.7M18.5 6.8l1.4-1.4" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.8-.9 1.3-2-.6-1.3.2-2.6 1.6-2.6h1.8a3.8 3.8 0 0 0 3.8-3.8C20.5 7.3 16.7 3.5 12 3.5Z" fill="currentColor" fillOpacity={A} />
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.8-.9 1.3-2-.6-1.3.2-2.6 1.6-2.6h1.8a3.8 3.8 0 0 0 3.8-3.8C20.5 7.3 16.7 3.5 12 3.5Z" />
      <circle cx="7.8" cy="11" r="1.2" fill="currentColor" />
      <circle cx="10.5" cy="7.3" r="1.2" fill="currentColor" />
      <circle cx="15.2" cy="7.6" r="1.2" fill="currentColor" />
    </>
  ),
  pin: (
    <>
      <path d="M9 3.5h6l-1 5 3 3H7l3-3-1-5Z" fill="currentColor" fillOpacity={A} />
      <path d="M9 3.5h6l-1 5 3 3H7l3-3-1-5ZM12 11.5v9" />
    </>
  ),
  wind: (
    <>
      <path d="M3 9h11a3 3 0 1 0-3-3" />
      <path d="M3 13h15a3 3 0 1 1-3 3" />
      <path d="M3 17h7" strokeOpacity={0.6} />
    </>
  ),
  follow: (
    <>
      <path d="M3 12h13" />
      <path d="m13 8.5 3.5 3.5-3.5 3.5" />
      <path d="M19.5 6v12" strokeOpacity={0.5} />
      <path d="M3 9.5 5 12l-2 2.5" strokeOpacity={0.6} />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity={A} />
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5.2" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6.5" width="12.5" height="11" rx="2.2" fill="currentColor" fillOpacity={A} />
      <rect x="3" y="6.5" width="12.5" height="11" rx="2.2" />
      <path d="m15.5 10.2 5.5-3v9.6l-5.5-3" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" fill="currentColor" fillOpacity={A} />
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="m3.8 17.5 5-5 3.6 3.6 2.6-2.6 5.2 5.2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11.5M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 16.5v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.5" fill="currentColor" fillOpacity={A} />
      <circle cx="8" cy="15" r="4.5" />
      <path d="m11.3 11.7 8.2-8.2M16.5 6.5l2.5 2.5M14.2 8.8l2 2" />
    </>
  ),
  trash: (
    <>
      <path d="M6 7h12l-1 13.5H7L6 7Z" fill="currentColor" fillOpacity={A} />
      <path d="M6 7h12l-1 13.5H7L6 7ZM4 7h16M9.5 7V4h5v3M10 10.5v6.5M14 10.5v6.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 5.8v5.6c0 4.4 3 8 7 9.6 4-1.6 7-5.2 7-9.6V5.8L12 3Z" fill="currentColor" fillOpacity={A} />
      <path d="M12 3 5 5.8v5.6c0 4.4 3 8 7 9.6 4-1.6 7-5.2 7-9.6V5.8L12 3Z" />
      <path d="m9 12 2.2 2.2 4-4.2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" fill="currentColor" fillOpacity={A} />
      <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" />
      <path d="M18.5 16.5v4M16.5 18.5h4" />
    </>
  ),
  import: (
    <>
      <path d="M4 13.5v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" />
    </>
  ),
  ticket: (
    <>
      <path d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4V7.5Z" fill="currentColor" fillOpacity={A} />
      <path d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4V7.5Z" />
      <path d="M14.5 6v12" strokeDasharray="1.6 1.8" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity={A} />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
      <circle cx="12" cy="12" r="6.6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  play: (
    <>
      <path d="M7 4.8v14.4a1 1 0 0 0 1.5.9l11.2-7.2a1 1 0 0 0 0-1.8L8.5 3.9A1 1 0 0 0 7 4.8Z" fill="currentColor" fillOpacity={A} />
      <path d="M7 4.8v14.4a1 1 0 0 0 1.5.9l11.2-7.2a1 1 0 0 0 0-1.8L8.5 3.9A1 1 0 0 0 7 4.8Z" />
    </>
  ),
  stack: (
    <>
      <path d="m12 3 9 4.6-9 4.6-9-4.6L12 3Z" fill="currentColor" fillOpacity={A} />
      <path d="m12 3 9 4.6-9 4.6-9-4.6L12 3Z" />
      <path d="m3 12 9 4.6 9-4.6M3 16.4 12 21l9-4.6" />
    </>
  ),
  flame: (
    <>
      <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 3.2-5.5 3.7-9.6 2.8 1.6 4.2 3.8 4.2 6 .9-.5 1.6-1.6 1.8-2.9 2 1.6 3.3 3.9 3.3 6.5 0 3.6-2.6 6.2-6.5 6.2Z" fill="currentColor" fillOpacity={A} />
      <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 3.2-5.5 3.7-9.6 2.8 1.6 4.2 3.8 4.2 6 .9-.5 1.6-1.6 1.8-2.9 2 1.6 3.3 3.9 3.3 6.5 0 3.6-2.6 6.2-6.5 6.2Z" />
      <path d="M12 21c-1.6 0-2.7-1.1-2.7-2.6 0-1.6 1.4-2.4 2.7-4 1.3 1.6 2.7 2.4 2.7 4 0 1.5-1.1 2.6-2.7 2.6Z" />
    </>
  ),
  level: (
    <>
      <path d="m12 2.8 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6-4.3-4.2 6-.9L12 2.8Z" fill="currentColor" fillOpacity={A} />
      <path d="m12 2.8 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6-4.3-4.2 6-.9L12 2.8Z" />
    </>
  ),
  arrow: (
    <>
      <path d="M3 12h15" />
      <path d="m16 8.8 4.5 3.2-4.5 3.2" fill="currentColor" fillOpacity={A} />
      <path d="m16 8.8 4.5 3.2-4.5 3.2M3 12l2-3h3l-2 3M3 12l2 3h3l-2-3" />
    </>
  ),
  hand: (
    <>
      <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11V4a1.5 1.5 0 0 1 3 0v7V5.5a1.5 1.5 0 0 1 3 0v8.5c0 4-2.5 7-6.3 7-2.6 0-4-1.2-5.3-3.3L3.6 14a1.5 1.5 0 0 1 2.4-1.8L8 14.5" fill="currentColor" fillOpacity={A} />
      <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11V4a1.5 1.5 0 0 1 3 0v7V5.5a1.5 1.5 0 0 1 3 0v8.5c0 4-2.5 7-6.3 7-2.6 0-4-1.2-5.3-3.3L3.6 14a1.5 1.5 0 0 1 2.4-1.8L8 14.5" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity={A} />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" fill="currentColor" fillOpacity={A} />
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="currentColor" fillOpacity={A} />
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  save: (
    <>
      <path d="M5 3.5h11l3.5 3.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" fill="currentColor" fillOpacity={A} />
      <path d="M5 3.5h11l3.5 3.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5ZM7.5 3.5v5h8v-5M7 20.5v-6h10v6" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" fill="currentColor" fillOpacity={A} />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity={A} />
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.4 15.4 5.1 5.1" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.2" fill="currentColor" fillOpacity={A} />
      <circle cx="12" cy="12" r="9.2" />
      <path d="M9.4 9.4a2.7 2.7 0 1 1 3.7 2.5c-.7.3-1.1.9-1.1 1.6v.6" />
      <circle cx="12" cy="17" r=".6" fill="currentColor" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  broom: (
    <>
      <path d="M14 3.5 10.5 10" />
      <path d="M8.2 9.5c2.4-.9 5.3.6 6.1 3l1.2 3.7c.4 1.1-.3 2.3-1.4 2.6l-4.3 1.6c-1.1.4-2.4-.2-2.8-1.3L5.6 15c-.9-2.4.3-4.7 2.6-5.5Z" fill="currentColor" fillOpacity={A} />
      <path d="M8.2 9.5c2.4-.9 5.3.6 6.1 3l1.2 3.7c.4 1.1-.3 2.3-1.4 2.6l-4.3 1.6c-1.1.4-2.4-.2-2.8-1.3L5.6 15c-.9-2.4.3-4.7 2.6-5.5ZM7.2 14.6l7.6-2.8M9 20l-.7-2.4M12.5 18.7l-.8-2.4" />
    </>
  ),
  medal: (
    <>
      <path d="M8 3h3l1.8 5M16 3h-3l-1.8 5" />
      <circle cx="12" cy="14.5" r="6" fill="currentColor" fillOpacity={A} />
      <circle cx="12" cy="14.5" r="6" />
      <path d="m12 11.4.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2.9-1.9Z" fill="currentColor" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" fill="currentColor" fillOpacity={A} />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" fill="currentColor" fillOpacity={A} />
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" fill="currentColor" fillOpacity={A} />
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" fill="currentColor" fillOpacity={A} />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
    </>
  ),
  mountain: (
    <>
      <path d="m2.5 19.5 6.5-11 4 6.5 2.5-3.5 6 8H2.5Z" fill="currentColor" fillOpacity={A} />
      <path d="m2.5 19.5 6.5-11 4 6.5 2.5-3.5 6 8H2.5Z" />
      <circle cx="17" cy="6" r="2" />
    </>
  ),
};


// ── Versioni dettagliate (tre livelli di tono + tratti fini) per le icone delle sezioni ──
const L1 = 0.16;
const L2 = 0.36;
const L3 = 0.7;
const FINE = { strokeWidth: 1.1 } as const;

const DETAILED: Partial<Record<IconName, ReactNode>> = {
  bolt: (
    <>
      <circle cx="12" cy="12" r="9.2" fill="currentColor" fillOpacity={L1} stroke="none" />
      <path d="M13.4 2.6 5.4 13.3h5.5l-1.2 8.1 8.9-11.7h-5.9l.7-7.1Z" fill="currentColor" fillOpacity={L2} />
      <path d="M13.4 2.6 5.4 13.3h5.5l-1.2 8.1 8.9-11.7h-5.9l.7-7.1Z" />
      <path d="m12.2 6.4-3.6 5" {...FINE} strokeOpacity={0.8} />
      <path d="M20 4.5h1.6M20.8 3.7v1.6M3.2 18.6h1.4M3.9 17.9v1.4" {...FINE} />
    </>
  ),
  camera: (
    <>
      <path d="M3.2 8.3c0-1.1.9-2 2-2h2.4l1.5-2.1h5.8l1.5 2.1h2.4c1.1 0 2 .9 2 2v9.4c0 1.1-.9 2-2 2H5.2c-1.1 0-2-.9-2-2V8.3Z" fill="currentColor" fillOpacity={L1} />
      <path d="M3.2 8.3c0-1.1.9-2 2-2h2.4l1.5-2.1h5.8l1.5 2.1h2.4c1.1 0 2 .9 2 2v9.4c0 1.1-.9 2-2 2H5.2c-1.1 0-2-.9-2-2V8.3Z" />
      <circle cx="12" cy="12.9" r="4.4" fill="currentColor" fillOpacity={L2} />
      <circle cx="12" cy="12.9" r="4.4" />
      <circle cx="12" cy="12.9" r="2.6" {...FINE} />
      <circle cx="12" cy="12.9" r="0.9" fill="currentColor" stroke="none" />
      <path d="M10.4 11.2a2.4 2.4 0 0 1 1.6-.7" {...FINE} strokeOpacity={0.9} />
      <circle cx="17.6" cy="9" r=".7" fill="currentColor" stroke="none" />
      <path d="M5.6 9.2h1.8" {...FINE} />
    </>
  ),
  bow: (
    <>
      <path d="M10.3 4.5c4 2.1 5.5 4.9 5.5 7.5s-1.5 5.4-5.5 7.5" strokeWidth={3.4} strokeOpacity={L2} />
      <path d="M8.5 3.2c.9.1 1.6.6 1.8 1.3 4 2.1 5.5 4.9 5.5 7.5s-1.5 5.4-5.5 7.5c-.2.7-.9 1.2-1.8 1.3" />
      <rect x="14.4" y="10.2" width="2.6" height="3.6" rx="1" fill="currentColor" fillOpacity={L3} stroke="none" />
      <path d="M8.6 3.4v17.2" {...FINE} strokeOpacity={0.75} />
      <path d="M3.2 12h17" />
      <path d="m17.6 9.6 2.9 2.4-2.9 2.4Z" fill="currentColor" fillOpacity={L3} />
      <path d="M3.2 12 5 10.1M3.2 12 5 13.9M5.3 12l1.8-1.9M5.3 12l1.8 1.9" {...FINE} />
      <circle cx="8.6" cy="12" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  archer: (
    <>
      <circle cx="12" cy="12" r="9.3" fill="currentColor" fillOpacity={L1} stroke="none" />
      <circle cx="8.4" cy="5" r="2" fill="currentColor" fillOpacity={L3} />
      <path d="M8.4 7.4c-.6 2-.6 4.2 0 6.4l-2.2 6.9M8.4 13.8l2.7 6.9" />
      <path d="M8.6 9.1h8.1M8.6 9.1 6 9.5l1.7-2.4" />
      <path d="M16.6 3.4c2 1.6 3 3.7 3 5.8s-1 4.2-3 5.8" strokeWidth={2.4} strokeOpacity={L2} />
      <path d="M16.6 3.4c2 1.6 3 3.7 3 5.8s-1 4.2-3 5.8" />
      <path d="M16.6 3.4v11.6" {...FINE} strokeOpacity={0.7} />
      <path d="M5.6 9.1h15.6" {...FINE} strokeDasharray="1 1.5" strokeOpacity={0.6} />
      <path d="m20.1 8.2 1.4.9-1.4.9" {...FINE} />
    </>
  ),
  notebook: (
    <>
      <rect x="5" y="2.8" width="14.2" height="18.4" rx="2.2" fill="currentColor" fillOpacity={L1} />
      <rect x="5" y="2.8" width="14.2" height="18.4" rx="2.2" />
      <path d="M5 2.8h3.8v18.4H5" fill="currentColor" fillOpacity={L2} stroke="none" />
      <path d="M8.8 2.8v18.4" {...FINE} />
      <path d="M11.4 6.8h5M11.4 9.2h3.4" {...FINE} strokeOpacity={0.8} />
      <circle cx="14.6" cy="15.2" r="3" fill="currentColor" fillOpacity={L3} stroke="none" />
      <path d="m13.3 15.2 1 1 1.8-2" stroke="#000" strokeOpacity={0.45} strokeWidth={1.3} />
      <path d="M3.6 6.5h2.6M3.6 10h2.6M3.6 13.5h2.6M3.6 17h2.6" {...FINE} />
    </>
  ),
  history: (
    <>
      <circle cx="12.6" cy="12.2" r="8.4" fill="currentColor" fillOpacity={L1} stroke="none" />
      <circle cx="12.6" cy="12.2" r="5.6" fill="currentColor" fillOpacity={L2} stroke="none" />
      <path d="M4.3 12.2a8.3 8.3 0 1 0 2.5-6" />
      <path d="M3.9 4.1v3.8h3.8" />
      <path d="M12.6 8v4.3l2.9 1.9" />
      <path d="M12.6 4.6v1M12.6 18.8v1M20.2 12.2h-1M6.2 12.2h-1" {...FINE} />
      <circle cx="12.6" cy="12.3" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.4 3.2h9.2v5.6a4.6 4.6 0 0 1-9.2 0V3.2Z" fill="currentColor" fillOpacity={L2} />
      <path d="M7.4 3.2h9.2v5.6a4.6 4.6 0 0 1-9.2 0V3.2Z" />
      <path d="M9.4 4.6v3.8a2.6 2.6 0 0 0 1.2 2.2" {...FINE} strokeOpacity={0.9} />
      <path d="M7.4 5.2H4.4c0 3.2 1.3 4.9 3.4 5.2M16.6 5.2h3c0 3.2-1.3 4.9-3.4 5.2" />
      <path d="M12 13.4v3" />
      <path d="M9.2 16.4h5.6l.9 4.1H8.3l.9-4.1Z" fill="currentColor" fillOpacity={L3} />
      <path d="M7.2 20.5h9.6" />
      <path d="m12 5.4.6 1.2 1.3.2-1 .9.3 1.3-1.2-.6-1.2.6.3-1.3-1-.9 1.3-.2.6-1.2Z" fill="currentColor" stroke="none" />
    </>
  ),
  chart: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fillOpacity={L1} stroke="none" />
      <path d="M5 18.5h14.5" {...FINE} />
      <rect x="6" y="12.5" width="2.6" height="6" rx=".8" fill="currentColor" fillOpacity={L2} stroke="none" />
      <rect x="10.7" y="9.5" width="2.6" height="9" rx=".8" fill="currentColor" fillOpacity={L2} stroke="none" />
      <rect x="15.4" y="6.5" width="2.6" height="12" rx=".8" fill="currentColor" fillOpacity={L3} stroke="none" />
      <path d="m5.6 10.6 4.6-3.7 3.8 2.3 5-4.6" />
      <circle cx="10.2" cy="6.9" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="9.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="4.6" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  ballistics: (
    <>
      <path d="M2.8 20.6h18.4" {...FINE} />
      <path d="M2.8 19.8C5.4 10 11.6 5.4 16 8.3" strokeDasharray="2.2 1.8" />
      <path d="m14.6 6 2.8 2.8-3.5 1" fill="currentColor" fillOpacity={L3} />
      <circle cx="18.4" cy="15.2" r="4" fill="currentColor" fillOpacity={L1} />
      <circle cx="18.4" cy="15.2" r="4" />
      <circle cx="18.4" cy="15.2" r="2.5" fill="currentColor" fillOpacity={L2} {...FINE} />
      <circle cx="18.4" cy="15.2" r="1" fill="currentColor" stroke="none" />
      <path d="M16.4 19.1 15 20.6M20.4 19.1l1.4 1.5" {...FINE} />
      <circle cx="2.8" cy="19.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  quiver: (
    <>
      <path d="M7 9.2 9.5 21.2h5L17 9.2H7Z" fill="currentColor" fillOpacity={L2} />
      <path d="M7 9.2 9.5 21.2h5L17 9.2H7Z" />
      <path d="M7.6 12.2h8.8M8.3 15.6h7.4" {...FINE} strokeOpacity={0.8} />
      <path d="M9.6 9.2 8.2 3.8M12 9.2V3.1M14.4 9.2l1.4-5.4" />
      <path d="m7.2 4.6.9-1.8 1.1 1.7M11 3.9l1-1.9 1 1.9M14.8 4.5l1.1-1.7.9 1.8" fill="currentColor" fillOpacity={L3} {...FINE} />
      <path d="M17 9.6c1.8.4 2.6 2 2.2 4.4" {...FINE} />
    </>
  ),
  team: (
    <>
      <circle cx="12" cy="12" r="9.4" fill="currentColor" fillOpacity={L1} stroke="none" />
      <circle cx="16.8" cy="7.6" r="2.4" fill="currentColor" fillOpacity={L2} />
      <path d="M17.2 12.4c2.2.4 3.6 2 4 4.4" />
      <circle cx="9" cy="8.2" r="3.2" fill="currentColor" fillOpacity={L3} />
      <circle cx="9" cy="8.2" r="3.2" />
      <path d="M2.8 19.6c.6-3.4 3.1-5.4 6.2-5.4s5.6 2 6.2 5.4" fill="currentColor" fillOpacity={L2} />
      <path d="M2.8 19.6c.6-3.4 3.1-5.4 6.2-5.4s5.6 2 6.2 5.4" />
      <circle cx="16.8" cy="7.6" r="2.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.4" y="4.8" width="17.2" height="15.8" rx="2.4" fill="currentColor" fillOpacity={L1} />
      <path d="M3.4 7.2c0-1.3 1.1-2.4 2.4-2.4h12.4c1.3 0 2.4 1.1 2.4 2.4v2.4H3.4V7.2Z" fill="currentColor" fillOpacity={L3} stroke="none" />
      <rect x="3.4" y="4.8" width="17.2" height="15.8" rx="2.4" />
      <path d="M8 2.8v4M16 2.8v4" />
      <path d="M6.8 13h1.4M11.3 13h1.4M15.8 13h1.4M6.8 16.6h1.4M11.3 16.6h1.4" {...FINE} />
      <circle cx="16.5" cy="16.6" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  podium: (
    <>
      <rect x="9" y="9" width="6" height="11.5" rx=".8" fill="currentColor" fillOpacity={L3} />
      <rect x="3.4" y="13" width="5.6" height="7.5" rx=".8" fill="currentColor" fillOpacity={L2} />
      <rect x="15" y="15" width="5.6" height="5.5" rx=".8" fill="currentColor" fillOpacity={L1} />
      <path d="M9 20.5V9h6v11.5M3.4 20.5V13H9M15 15h5.6v5.5M2.6 20.5h18.8" />
      <path d="m12 2.6.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3.9-1.8Z" fill="currentColor" />
      <path d="M11.4 12.4 12 12v3.6M5.6 15.8h1.4M17.2 17.5h1.4" {...FINE} />
    </>
  ),
  duel: (
    <>
      <circle cx="12" cy="12" r="9.4" fill="currentColor" fillOpacity={L1} stroke="none" />
      <path d="m4.2 19.8 15.4-15.4M19.8 19.8 4.4 4.4" />
      <path d="M15.8 4.2h4v4" fill="currentColor" fillOpacity={L3} />
      <path d="M8.2 4.2h-4v4" fill="currentColor" fillOpacity={L3} />
      <path d="m4.6 17 2.4 2.4M3.4 18.6l1.9 1.9M19.4 17 17 19.4M20.6 18.6l-1.9 1.9" {...FINE} />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" fillOpacity={L2} />
    </>
  ),
  flag: (
    <>
      <circle cx="7" cy="19.6" r="3" fill="currentColor" fillOpacity={L1} stroke="none" />
      <path d="M6 21V3.2" />
      <path d="M6 4c3.8-1.8 6.2 1.6 10.8 0v8.4C12.2 14 9.8 10.6 6 12.4V4Z" fill="currentColor" fillOpacity={L2} />
      <path d="M6 4c3.8-1.8 6.2 1.6 10.8 0v8.4C12.2 14 9.8 10.6 6 12.4" />
      <circle cx="11.4" cy="8.2" r="2.3" {...FINE} />
      <circle cx="11.4" cy="8.2" r=".8" fill="currentColor" stroke="none" />
      <circle cx="6" cy="21" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10.1v3.8c0 .7.6 1.3 1.3 1.3h2.4l7.6 4.6V4.2L7.7 8.8H5.3c-.7 0-1.3.6-1.3 1.3Z" fill="currentColor" fillOpacity={L2} />
      <path d="M4 10.1v3.8c0 .7.6 1.3 1.3 1.3h2.4l7.6 4.6V4.2L7.7 8.8H5.3c-.7 0-1.3.6-1.3 1.3Z" />
      <path d="M7.7 8.8v6.4" {...FINE} />
      <path d="m8.1 15.2 1 5h2.3l-.9-3.8" fill="currentColor" fillOpacity={L3} />
      <path d="M18.2 9a4 4 0 0 1 0 6M20.4 6.8a7 7 0 0 1 0 10.4" />
    </>
  ),
  compare: (
    <>
      <path d="M12 3.2v17.3M6.2 20.5h11.6" />
      <circle cx="12" cy="4.2" r="1.2" fill="currentColor" stroke="none" />
      <path d="M4.6 6.6h14.8" />
      <path d="M2.2 12.8h5.2a2.6 2.6 0 0 1-5.2 0ZM16.6 12.8h5.2a2.6 2.6 0 0 1-5.2 0Z" fill="currentColor" fillOpacity={L3} />
      <path d="m4.8 6.6-2.6 6.2M4.8 6.6l2.6 6.2M19.2 6.6l-2.6 6.2M19.2 6.6l2.6 6.2" {...FINE} />
      <rect x="9.6" y="17.6" width="4.8" height="2.9" rx=".8" fill="currentColor" fillOpacity={L2} stroke="none" />
    </>
  ),
  game: (
    <>
      <path d="M7.2 7.3h9.6a4.3 4.3 0 0 1 4.2 5.1l-.9 4.3a2.4 2.4 0 0 1-4.1 1.2L14 15.6h-4l-2 2.3a2.4 2.4 0 0 1-4.1-1.2L3 12.4a4.3 4.3 0 0 1 4.2-5.1Z" fill="currentColor" fillOpacity={L2} />
      <path d="M7.2 7.3h9.6a4.3 4.3 0 0 1 4.2 5.1l-.9 4.3a2.4 2.4 0 0 1-4.1 1.2L14 15.6h-4l-2 2.3a2.4 2.4 0 0 1-4.1-1.2L3 12.4a4.3 4.3 0 0 1 4.2-5.1Z" />
      <path d="M8 9.8v3.2M6.4 11.4h3.2" />
      <circle cx="15.6" cy="10.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.6" cy="12.4" r="1" fill="currentColor" stroke="none" />
      <path d="M11 9.6h2" {...FINE} />
      <path d="M12 7.3V5.2c0-1 .8-1.8 1.8-1.8" {...FINE} />
    </>
  ),
  bag: (
    <>
      <path d="M4.8 7.8h14.4l-1.1 12.8H5.9L4.8 7.8Z" fill="currentColor" fillOpacity={L2} />
      <path d="M4.8 7.8h14.4l-1.1 12.8H5.9L4.8 7.8Z" />
      <path d="M9 10.6V6.8a3 3 0 0 1 6 0v3.8" />
      <circle cx="9" cy="10.6" r=".9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10.6" r=".9" fill="currentColor" stroke="none" />
      <path d="M8.2 16.8h7.6" {...FINE} strokeOpacity={0.8} />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="12" r="9.4" fill="currentColor" fillOpacity={L1} stroke="none" />
      <circle cx="12" cy="8.4" r="3.8" fill="currentColor" fillOpacity={L3} />
      <circle cx="12" cy="8.4" r="3.8" />
      <path d="M4.6 20.2c.9-3.9 3.8-6 7.4-6s6.5 2.1 7.4 6" fill="currentColor" fillOpacity={L2} />
      <path d="M4.6 20.2c.9-3.9 3.8-6 7.4-6s6.5 2.1 7.4 6" />
      <path d="m12 14.2-.9 2 .9 3.3.9-3.3-.9-2Z" fill="currentColor" stroke="none" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.4a8.6 8.6 0 1 0 0 17.2c1.3 0 1.9-.9 1.3-2-.6-1.3.2-2.7 1.7-2.7h1.8a3.8 3.8 0 0 0 3.8-3.8c0-4.8-3.8-8.7-8.6-8.7Z" fill="currentColor" fillOpacity={L2} />
      <path d="M12 3.4a8.6 8.6 0 1 0 0 17.2c1.3 0 1.9-.9 1.3-2-.6-1.3.2-2.7 1.7-2.7h1.8a3.8 3.8 0 0 0 3.8-3.8c0-4.8-3.8-8.7-8.6-8.7Z" />
      <circle cx="7.6" cy="11.2" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="7.2" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="7.4" r="1.4" fill="currentColor" fillOpacity={L3} stroke="none" />
      <circle cx="8.8" cy="15.6" r="1.4" fill="currentColor" fillOpacity={L3} stroke="none" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity={L1} />
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.2" fill="currentColor" fillOpacity={L2} {...FINE} />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity={L3} {...FINE} />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <path d="m12 12 7.4-7.4M17.4 4.2l2.4.2.2 2.4" {...FINE} />
    </>
  ),
  sight: (
    <>
      <rect x="9.5" y="2.8" width="3.2" height="18.4" rx="1.2" fill="currentColor" fillOpacity={L2} />
      <rect x="9.5" y="2.8" width="3.2" height="18.4" rx="1.2" />
      <path d="M9.5 6h1.4M9.5 8.6h2M9.5 11.2h1.4M9.5 13.8h2M9.5 16.4h1.4M9.5 19h2" {...FINE} />
      <path d="M12.7 12h3.4" />
      <circle cx="18.6" cy="12" r="2.6" fill="currentColor" fillOpacity={L3} />
      <circle cx="18.6" cy="12" r="2.6" />
      <circle cx="18.6" cy="12" r=".8" fill="currentColor" stroke="none" />
      <path d="M3 9.2h3.4M3 14.8h3.4" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  checklist: (
    <>
      <rect x="4.4" y="3.6" width="15.2" height="17.6" rx="2.4" fill="currentColor" fillOpacity={L1} />
      <rect x="4.4" y="3.6" width="15.2" height="17.6" rx="2.4" />
      <rect x="8.6" y="2.2" width="6.8" height="3.2" rx="1.2" fill="currentColor" fillOpacity={L3} />
      <path d="m7.4 10 1.2 1.2 2-2.2M7.4 14.6l1.2 1.2 2-2.2" />
      <path d="M12.6 10.2h4.2M12.6 14.8h4.2" {...FINE} />
      <path d="M7.6 18.6h2.6M12.6 18.6h2.6" {...FINE} strokeOpacity={0.6} />
    </>
  ),
  stopwatch: (
    <>
      <circle cx="12" cy="13.6" r="7.4" fill="currentColor" fillOpacity={L1} />
      <path d="M12 6.2a7.4 7.4 0 0 1 7.4 7.4H12V6.2Z" fill="currentColor" fillOpacity={L3} stroke="none" />
      <circle cx="12" cy="13.6" r="7.4" />
      <path d="M10 2.6h4M12 2.6v3.6M18.4 6.4l1.5-1.5" />
      <path d="M12 13.6 8.8 11" />
      <path d="M12 7.6v1M12 18.6v1M6 13.6h1M17 13.6h1" {...FINE} />
      <circle cx="12" cy="13.6" r="1" fill="currentColor" stroke="none" />
    </>
  ),
};

Object.assign(DETAILED, DETAILED_MORE);

/** Il disegno di un'icona (versione dettagliata se c'è), da incidere dentro altri SVG. */
export function glyphArt(name: IconName): ReactNode {
  return DETAILED[name] ?? ICONS[name];
}

export function Glyph({ name, size = 20, className, strokeWidth = 1.7, title, detailed = false }: { name: IconName; size?: number; className?: string; strokeWidth?: number; title?: string; detailed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {(detailed ? DETAILED[name] : undefined) ?? ICONS[name] ?? DETAILED[name]}
    </svg>
  );
}

/** Tessera d'icona: placca scura con riflesso e cornice, disegno inciso in metallo del colore dell'app.
 *  Stesso aspetto ovunque. `accent` (solo nel Menu) dà a una sezione la sua tinta, sullo stesso materiale. */
export function AppIcon({ name, size = 52, className, accent, color, fluid = false, plain = false }: { name: IconName; color?: string; size?: number; className?: string; accent?: string; /** riempie il contenitore invece di una misura fissa */ fluid?: boolean; /** tessera semplice (vecchio stile) */ plain?: boolean }) {
  const id = `ai${(useId().replace(/[^a-zA-Z0-9]/g, "") + "_")}`;
  if (!plain && !fluid) {
    // insegna coniata: gare, premi, sfide e obiettivi in oro con il loro simbolo; le altre voci in argento,
    // smalto del colore della sezione e il loro disegno in rilievo
    const ins = INSIGNIA_FOR[name];
    return (
      <span className={["aa-appicon-ins relative grid shrink-0 place-items-center", className].filter(Boolean).join(" ")} style={{ width: size, height: size }}>
        {ins ? (
          <Insignia {...ins} size={Math.round(size * 1.04)} glow={size >= 56} />
        ) : (
          <Insignia art={DETAILED[name] ?? ICONS[name]} metal="silver" enamel={accent ?? color ?? "#2c8a57"} size={Math.round(size * 1.02)} />
        )}
      </span>
    );
  }
  const art = DETAILED[name] ?? ICONS[name];
  const sw = size >= 56 ? 1.45 : size >= 40 ? 1.6 : 1.75;
  const g = Math.round(size * 0.6);
  return (
    <span
      className={["aa-appicon relative grid shrink-0 place-items-center", className].filter(Boolean).join(" ")}
      data-accent={accent ? "" : undefined}
      style={{ width: fluid ? "100%" : size, height: fluid ? "100%" : size, borderRadius: fluid ? "30%" : size * 0.3, ...(accent ? { "--acc": accent } : null) } as CSSProperties}
    >
      <svg id={id} viewBox="0 0 24 24" width={fluid ? "60%" : g} height={fluid ? "60%" : g} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="aa-line relative z-[1]" aria-hidden>
        <defs>
          {/* metallo: luce in alto, tinta piena al centro, tono scuro in basso */}
          <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1="6" y1="2" x2="16" y2="23">
            <stop offset="0" style={{ stopColor: "var(--ig-a)" }} />
            <stop offset="0.5" style={{ stopColor: "var(--ig-b)" }} />
            <stop offset="1" style={{ stopColor: "var(--ig-c)" }} />
          </linearGradient>
        </defs>
<style>{`#${id} .m{stroke:url(#${id}s)}#${id} .m [fill="currentColor"]{fill:url(#${id}s)}#${id} .m [stroke="currentColor"]{stroke:url(#${id}s)}`}</style>
        {/* incisione: copia scura spostata in basso, poi il disegno in metallo */}
        <g className="aa-ig-shadow" transform="translate(0 0.7)" style={{ color: "rgb(0 0 0 / 0.55)" }}>{art}</g>
        <g className="m">{art}</g>
      </svg>
    </span>
  );
}

/** Testo con icona davanti, allineati (per pulsanti, chip, titoli). */
export function IconLabel({ icon, children, size = 16, className }: { icon: IconName; children?: ReactNode; size?: number; className?: string }) {
  return (
    <span className={["inline-flex items-center gap-1.5", className].filter(Boolean).join(" ")}>
      <Glyph name={icon} size={size} className="shrink-0" />
      {children}
    </span>
  );
}

/** Esito di un controllo: pallino verde, ambra o rosso con il segno dentro. */
export function StatusMark({ state }: { state: "ok" | "warn" | "bad" }) {
  const color = state === "ok" ? "#2fbf71" : state === "warn" ? "#e3a21a" : "#e5484d";
  return (
    <span className="mr-1.5 inline-grid h-4 w-4 translate-y-[2px] place-items-center rounded-full align-baseline" style={{ background: color }}>
      <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {state === "ok" ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : state === "warn" ? <path d="M12 6v7M12 18v.01" /> : <path d="M7 7l10 10M17 7 7 17" />}
      </svg>
    </span>
  );
}

/** Titolo di sezione con tessera d'icona. */
export function IconTitle({ icon, color, children, sub }: { icon: IconName; color: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <AppIcon name={icon} color={color} size={34} />
      <div className="min-w-0">
        <h2 className="aa-section-title">{children}</h2>
        {sub ? <p className="text-xs text-muted">{sub}</p> : null}
      </div>
    </div>
  );
}
