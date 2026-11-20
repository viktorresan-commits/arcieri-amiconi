import type { CSSProperties, ReactNode } from "react";

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
  | "eye" | "save" | "share" | "close" | "chevron" | "broom" | "medal" | "crosshair" | "mountain" | "home" | "grid";

const A = 0.32; // opacità del secondo tono

// ogni icona: tratti (stroke) e riempimenti tenui (fill, secondo tono)
const ICONS: Record<IconName, ReactNode> = {
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

export function Glyph({ name, size = 20, className, strokeWidth = 1.7, title }: { name: IconName; size?: number; className?: string; strokeWidth?: number; title?: string }) {
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
      {ICONS[name]}
    </svg>
  );
}

/** Tessera d'icona: vetro colorato con luce in alto, ombra morbida e glifo bianco. */
export function AppIcon({ name, color, size = 52, className }: { name: IconName; color: string; size?: number; className?: string }) {
  return (
    <span
      className={["aa-appicon relative grid shrink-0 place-items-center", className].filter(Boolean).join(" ")}
      style={{ "--c": color, width: size, height: size, borderRadius: size * 0.3 } as CSSProperties}
    >
      <Glyph name={name} size={Math.round(size * 0.5)} strokeWidth={1.8} className="relative z-[1] text-white drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.35)]" />
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
