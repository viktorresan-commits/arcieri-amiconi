import type { ReactNode } from "react";
import type { IconName } from "./icons";

/**
 * Versioni dettagliate delle icone (griglia 24×24) per le tessere: stesso linguaggio di quelle
 * già disegnate in icons.tsx — sagoma piena tenue (L1), volumi (L2), accenti (L3), tratti fini.
 */
const L1 = 0.16;
const L2 = 0.36;
const L3 = 0.7;
const FINE = { strokeWidth: 1.1 } as const;
const DOT = { fill: "currentColor", stroke: "none" } as const;

export const DETAILED_MORE: Partial<Record<IconName, ReactNode>> = {
  arrow: (
    <>
      <path d="M3.4 20.6 18.2 5.8" />
      <path d="m15.2 4.4 5.4-1-1 5.4-1.6-1.6" fill="currentColor" fillOpacity={L3} />
      <path d="m15.2 4.4 2 2" {...FINE} />
      <path d="M3.4 20.6 3 17l2.6-2.6.4 3.6Z M3.4 20.6l3.6.4 2.6-2.6-3.6-.4Z" fill="currentColor" fillOpacity={L2} />
      <path d="M6.6 17.4 3 17M6.6 17.4l.4 3.6" {...FINE} />
      <path d="M9.6 14.4h.01M11.8 12.2h.01" strokeWidth={2} />
    </>
  ),
  hand: (
    <>
      <path d="M7.6 11.2V5.6a1.5 1.5 0 0 1 3 0v4.6V4.2a1.5 1.5 0 0 1 3 0v6V5.4a1.5 1.5 0 0 1 3 0v7.8l.9-1.6a1.6 1.6 0 0 1 2.8 1.5l-2.6 5.2a5.6 5.6 0 0 1-5 3.1h-1.2a5 5 0 0 1-5-5v-3.6a1.5 1.5 0 0 1 3 0" fill="currentColor" fillOpacity={L1} />
      <path d="M7.6 11.2V5.6a1.5 1.5 0 0 1 3 0v4.6V4.2a1.5 1.5 0 0 1 3 0v6V5.4a1.5 1.5 0 0 1 3 0v7.8l.9-1.6a1.6 1.6 0 0 1 2.8 1.5l-2.6 5.2a5.6 5.6 0 0 1-5 3.1h-1.2a5 5 0 0 1-5-5v-3.6a1.5 1.5 0 0 1 3 0" />
      <path d="M7.6 14.2h9" strokeWidth={3} strokeOpacity={L2} />
      <path d="M8.2 16.4c1.6.6 4 .6 6.4 0" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  gear: (
    <>
      <path d="m10.3 2.8h3.4l.6 2.4 1.7.9 2.3-1 2.4 2.4-1 2.3.9 1.7 2.4.6v3.4l-2.4.6-.9 1.7 1 2.3-2.4 2.4-2.3-1-1.7.9-.6 2.4h-3.4l-.6-2.4-1.7-.9-2.3 1-2.4-2.4 1-2.3-.9-1.7-2.4-.6v-3.4l2.4-.6.9-1.7-1-2.3 2.4-2.4 2.3 1 1.7-.9Z" fill="currentColor" fillOpacity={L1} />
      <path d="m10.3 2.8h3.4l.6 2.4 1.7.9 2.3-1 2.4 2.4-1 2.3.9 1.7 2.4.6v3.4l-2.4.6-.9 1.7 1 2.3-2.4 2.4-2.3-1-1.7.9-.6 2.4h-3.4l-.6-2.4-1.7-.9-2.3 1-2.4-2.4 1-2.3-.9-1.7-2.4-.6v-3.4l2.4-.6.9-1.7-1-2.3 2.4-2.4 2.3 1 1.7-.9Z" />
      <circle cx="12" cy="12" r="3.6" fill="currentColor" fillOpacity={L2} />
      <circle cx="12" cy="12" r="1.4" {...FINE} />
      <path d="M7.4 9.2a5.6 5.6 0 0 1 3-2.6" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity={L1} />
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.4" fill="currentColor" fillOpacity={L2} stroke="none" />
      <path d="m7.8 12.4 2.9 2.9 5.6-6" strokeWidth={2.2} />
      <path d="M6.4 8.2a6.8 6.8 0 0 1 3-2.6" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="8.6" fill="currentColor" fillOpacity={L1} />
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="4.6" fill="currentColor" fillOpacity={L2} />
      <circle cx="12" cy="12" r="4.6" {...FINE} />
      <path d="M12 1.8v5M12 17.2v5M1.8 12h5M17.2 12h5" />
      <circle cx="12" cy="12" r="1.3" {...DOT} />
      <path d="M8.6 3.8h.01M20.2 8.6h.01M15.4 20.2h.01M3.8 15.4h.01" strokeWidth={1.8} />
    </>
  ),
  home: (
    <>
      <path d="M3.6 10.6 12 3.4l8.4 7.2v9.4a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1Z" fill="currentColor" fillOpacity={L1} />
      <path d="M2.4 11.4 12 3.2l9.6 8.2" />
      <path d="M4.4 9.8V20a1 1 0 0 0 1 1h13.2a1 1 0 0 0 1-1V9.8" />
      <path d="M9.6 21v-5.4a1.2 1.2 0 0 1 1.2-1.2h2.4a1.2 1.2 0 0 1 1.2 1.2V21" fill="currentColor" fillOpacity={L2} />
      <path d="M16.4 6.2V3.6h2v4.3" fill="currentColor" fillOpacity={L3} />
      <circle cx="12" cy="10.6" r="1.6" {...FINE} />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.6s-6.8-6.4-6.8-11.6a6.8 6.8 0 0 1 13.6 0c0 5.2-6.8 11.6-6.8 11.6Z" fill="currentColor" fillOpacity={L1} />
      <path d="M12 21.6s-6.8-6.4-6.8-11.6a6.8 6.8 0 0 1 13.6 0c0 5.2-6.8 11.6-6.8 11.6Z" />
      <circle cx="12" cy="10" r="3.2" fill="currentColor" fillOpacity={L2} />
      <circle cx="12" cy="10" r="1.3" {...DOT} />
      <path d="M8 7.6a4.6 4.6 0 0 1 2.4-2.2" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.4" r="7.8" fill="currentColor" fillOpacity={L1} />
      <path d="M12 5.6a7.8 7.8 0 0 1 0 15.6V13.4Z" fill="currentColor" fillOpacity={L2} stroke="none" />
      <circle cx="12" cy="13.4" r="7.8" />
      <path d="M9.6 2.4h4.8M12 2.4v3.2M18.6 6.6l1.4-1.4" />
      <path d="M12 13.4V9" strokeWidth={2} />
      <path d="M12 6.8v.8M12 19.2v.8M5.4 13.4h.8M17.8 13.4h.8M7.3 8.7l.6.6M16.1 17.5l.6.6" {...FINE} />
      <circle cx="12" cy="13.4" r="1.1" {...DOT} />
    </>
  ),
  wind: (
    <>
      <path d="M2.8 8.6h11a2.8 2.8 0 1 0-2.8-2.8" />
      <path d="M2.8 12.4h15.6a3 3 0 1 1-3 3" strokeWidth={2.2} />
      <path d="M2.8 16.2h7.6a2.4 2.4 0 1 1-2.4 2.4" />
      <path d="M17.4 8.6h3.8M14.2 20h2.4" {...FINE} strokeOpacity={0.7} />
      <circle cx="11" cy="5.8" r="0.8" {...DOT} opacity={L3} />
    </>
  ),
  windsock: (
    <>
      <path d="M4.2 2.6v19" strokeWidth={2} />
      <path d="M2.6 21.6h3.2" />
      <path d="M4.6 5 20 7.4v5.4L4.6 15.2Z" fill="currentColor" fillOpacity={L1} />
      <path d="M4.6 5 20 7.4v5.4L4.6 15.2Z" />
      <path d="M9.2 5.7v8.8M14 6.4v7.4" />
      <path d="M4.6 5h4.6v9.6H4.6Z M14 6.4l3 .5v6.4l-3 .5Z" fill="currentColor" fillOpacity={L3} stroke="none" />
      <path d="M20.6 9.2h1.4M20.6 11.2h1.4" {...FINE} />
    </>
  ),
  posture: (
    <>
      <circle cx="12" cy="12" r="9.3" fill="currentColor" fillOpacity={L1} stroke="none" />
      <circle cx="12" cy="4.6" r="2.1" fill="currentColor" fillOpacity={L3} />
      <path d="M12 7v7.6M12 14.6l-3 6.4M12 14.6l3 6.4" />
      <path d="M5 9.6h14" />
      <path d="M12 2v19.8" {...FINE} strokeDasharray="1.2 1.6" strokeOpacity={0.6} />
      <path d="M8.4 11.4 12 9.6l3.6 1.8" {...FINE} />
      <circle cx="5" cy="9.6" r="1" {...DOT} />
      <circle cx="19" cy="9.6" r="1" {...DOT} />
    </>
  ),
  breath: (
    <>
      <circle cx="12" cy="12" r="9.2" fill="currentColor" fillOpacity={L1} />
      <circle cx="12" cy="12" r="6.4" fill="currentColor" fillOpacity={L2} stroke="none" />
      <circle cx="12" cy="12" r="9.2" {...FINE} strokeDasharray="2 2" />
      <path d="M7 10.4c1.6-1.6 3.4-1.6 5 0s3.4 1.6 5 0M7 14c1.6-1.6 3.4-1.6 5 0s3.4 1.6 5 0" />
      <circle cx="12" cy="12" r="3.4" {...FINE} strokeOpacity={0.6} />
    </>
  ),
  follow: (
    <>
      <circle cx="9" cy="8" r="3.4" fill="currentColor" fillOpacity={L2} />
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20.2a6.2 6.2 0 0 1 12.4 0Z" fill="currentColor" fillOpacity={L1} />
      <path d="M2.8 20.2a6.2 6.2 0 0 1 12.4 0" />
      <path d="M19 6.8v6.4M15.8 10h6.4" strokeWidth={2} />
      <circle cx="19" cy="10" r="4.4" {...FINE} strokeOpacity={0.6} />
    </>
  ),
  key: (
    <>
      <circle cx="7.6" cy="15.4" r="4.6" fill="currentColor" fillOpacity={L1} />
      <circle cx="7.6" cy="15.4" r="4.6" />
      <circle cx="7.6" cy="15.4" r="1.8" fill="currentColor" fillOpacity={L3} />
      <path d="M11 12 20.8 2.4M16.6 6.6l2.6 2.6M18.8 4.4l2 2" />
      <path d="M5 13.4a3 3 0 0 1 1.6-1.4" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  lock: (
    <>
      <path d="M7.4 10.6V7.6a4.6 4.6 0 0 1 9.2 0v3" />
      <path d="M9.4 10.6V7.8a2.6 2.6 0 0 1 5.2 0v2.8" {...FINE} strokeOpacity={0.6} />
      <rect x="4.6" y="10.6" width="14.8" height="10.6" rx="2.2" fill="currentColor" fillOpacity={L2} />
      <rect x="4.6" y="10.6" width="14.8" height="10.6" rx="2.2" />
      <circle cx="12" cy="15" r="1.6" {...DOT} />
      <path d="M12 15.6v2.6" strokeWidth={1.8} />
      <path d="M6.6 13h3" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.4 4.4 0 0 0 6.2 0l3.2-3.2a4.4 4.4 0 0 0-6.2-6.2l-1.4 1.4" />
      <path d="M14 10a4.4 4.4 0 0 0-6.2 0l-3.2 3.2a4.4 4.4 0 0 0 6.2 6.2l1.4-1.4" />
      <path d="M17.6 6.2a2 2 0 0 1 .4 2.4" {...FINE} strokeOpacity={0.7} />
      <path d="M6.4 17.8a2 2 0 0 1-.4-2.4" {...FINE} strokeOpacity={0.7} />
      <circle cx="12" cy="12" r="1" {...DOT} opacity={L3} />
    </>
  ),
  share: (
    <>
      <path d="m8.6 10.8 6.8-4M8.6 13.2l6.8 4" />
      <circle cx="18" cy="5.4" r="3" fill="currentColor" fillOpacity={L2} />
      <circle cx="18" cy="5.4" r="3" />
      <circle cx="6" cy="12" r="3" fill="currentColor" fillOpacity={L3} />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="18.6" r="3" fill="currentColor" fillOpacity={L2} />
      <circle cx="18" cy="18.6" r="3" />
      <path d="M16.6 4.4a1.6 1.6 0 0 1 1.2-.6M4.6 11a1.6 1.6 0 0 1 1.2-.6" {...FINE} />
    </>
  ),
  download: (
    <>
      <path d="M4 15v3.6A2.4 2.4 0 0 0 6.4 21h11.2a2.4 2.4 0 0 0 2.4-2.4V15" fill="currentColor" fillOpacity={L1} />
      <path d="M4 15v3.6A2.4 2.4 0 0 0 6.4 21h11.2a2.4 2.4 0 0 0 2.4-2.4V15" />
      <path d="M12 3v11.6" strokeWidth={2} />
      <path d="m7.4 10.2 4.6 4.6 4.6-4.6" fill="currentColor" fillOpacity={L2} />
      <path d="M7.2 18h2M14.8 18h2" {...FINE} />
    </>
  ),
  import: (
    <>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3" fill="currentColor" fillOpacity={L1} />
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3" />
      <path d="M12 7v8" strokeWidth={2} />
      <path d="m8.4 11.6 3.6 3.6 3.6-3.6" fill="currentColor" fillOpacity={L2} />
      <path d="M7.4 17.6h9.2" />
      <path d="M5.6 6.4a1.6 1.6 0 0 1 1-1" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  trash: (
    <>
      <path d="M5.6 6.6h12.8l-1 13a1.8 1.8 0 0 1-1.8 1.6H8.4a1.8 1.8 0 0 1-1.8-1.6Z" fill="currentColor" fillOpacity={L1} />
      <path d="M5.6 6.6h12.8l-1 13a1.8 1.8 0 0 1-1.8 1.6H8.4a1.8 1.8 0 0 1-1.8-1.6Z" />
      <path d="M3.6 6.6h16.8M9.2 6.6V4.2a1 1 0 0 1 1-1h3.6a1 1 0 0 1 1 1v2.4" />
      <path d="M10 10v7.6M14 10v7.6" {...FINE} />
      <path d="M5.6 6.6h12.8l-.2 2.4H5.8Z" fill="currentColor" fillOpacity={L3} stroke="none" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.6 4.4 5.4v6.2c0 4.8 3.2 8.4 7.6 9.8 4.4-1.4 7.6-5 7.6-9.8V5.4Z" fill="currentColor" fillOpacity={L1} />
      <path d="M12 2.6 4.4 5.4v6.2c0 4.8 3.2 8.4 7.6 9.8 4.4-1.4 7.6-5 7.6-9.8V5.4Z" />
      <path d="M12 2.6v18.8c4.4-1.4 7.6-5 7.6-9.8V5.4Z" fill="currentColor" fillOpacity={L2} stroke="none" />
      <path d="M12 5.4 6.8 7.2v4.4c0 3.2 2 5.8 5.2 7" {...FINE} strokeOpacity={0.75} />
      <path d="m9.4 11.8 1.8 1.8 3.6-3.8" strokeWidth={1.9} />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 2.6c.6 4.2 2.2 5.8 6.4 6.4-4.2.6-5.8 2.2-6.4 6.4-.6-4.2-2.2-5.8-6.4-6.4 4.2-.6 5.8-2.2 6.4-6.4Z" fill="currentColor" fillOpacity={L2} />
      <path d="M11 2.6c.6 4.2 2.2 5.8 6.4 6.4-4.2.6-5.8 2.2-6.4 6.4-.6-4.2-2.2-5.8-6.4-6.4 4.2-.6 5.8-2.2 6.4-6.4Z" />
      <path d="M18 14.6c.3 2.2 1.2 3.1 3.4 3.4-2.2.3-3.1 1.2-3.4 3.4-.3-2.2-1.2-3.1-3.4-3.4 2.2-.3 3.1-1.2 3.4-3.4Z" fill="currentColor" fillOpacity={L3} />
      <path d="M4.6 17.4h.01M19.4 4.4h.01M6.8 21h.01" strokeWidth={2} />
    </>
  ),
  ticket: (
    <>
      <path d="M3 7.4a1.4 1.4 0 0 1 1.4-1.4h15.2A1.4 1.4 0 0 1 21 7.4v2.4a2.2 2.2 0 0 0 0 4.4v2.4a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 16.6v-2.4a2.2 2.2 0 0 0 0-4.4Z" fill="currentColor" fillOpacity={L1} />
      <path d="M3 7.4a1.4 1.4 0 0 1 1.4-1.4h15.2A1.4 1.4 0 0 1 21 7.4v2.4a2.2 2.2 0 0 0 0 4.4v2.4a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 16.6v-2.4a2.2 2.2 0 0 0 0-4.4Z" />
      <path d="M15 6v12" {...FINE} strokeDasharray="1.4 1.4" />
      <path d="m9.2 9.4.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.2 1.8-.3Z" fill="currentColor" fillOpacity={L3} />
      <path d="M17 10h2M17 14h2" {...FINE} />
    </>
  ),
  stack: (
    <>
      <path d="m12 3 9 4.6-9 4.6-9-4.6Z" fill="currentColor" fillOpacity={L3} />
      <path d="m12 3 9 4.6-9 4.6-9-4.6Z" />
      <path d="m3 12 9 4.6 9-4.6" />
      <path d="m3 16.4 9 4.6 9-4.6" />
      <path d="m3 12 9 4.6 9-4.6v4.4l-9 4.6-9-4.6Z" fill="currentColor" fillOpacity={L1} stroke="none" />
      <path d="M8.4 7.6 12 5.8" {...FINE} strokeOpacity={0.5} />
    </>
  ),
  flame: (
    <>
      <path d="M12 21.4c-4 0-6.8-2.8-6.8-6.6 0-3.6 2.6-5.6 3.6-8.4.8 1.4 1.4 2.6 2.6 3.2C11.6 6.6 13 4 15.4 2.6c-.4 3.4 3.4 6 3.4 11.4 0 4.6-3 7.4-6.8 7.4Z" fill="currentColor" fillOpacity={L1} />
      <path d="M12 21.4c-4 0-6.8-2.8-6.8-6.6 0-3.6 2.6-5.6 3.6-8.4.8 1.4 1.4 2.6 2.6 3.2C11.6 6.6 13 4 15.4 2.6c-.4 3.4 3.4 6 3.4 11.4 0 4.6-3 7.4-6.8 7.4Z" />
      <path d="M12 21.4c-2 0-3.4-1.4-3.4-3.4 0-2.4 2-3.4 2.6-5.4 1.2 1 3.8 2.6 3.8 5.4 0 2-1.2 3.4-3 3.4Z" fill="currentColor" fillOpacity={L3} />
    </>
  ),
  level: (
    <>
      <rect x="2.6" y="8.6" width="18.8" height="6.8" rx="1.6" fill="currentColor" fillOpacity={L1} />
      <rect x="2.6" y="8.6" width="18.8" height="6.8" rx="1.6" />
      <rect x="8.6" y="10.2" width="6.8" height="3.6" rx="1.8" fill="currentColor" fillOpacity={L2} />
      <rect x="8.6" y="10.2" width="6.8" height="3.6" rx="1.8" {...FINE} />
      <circle cx="12" cy="12" r="1" {...DOT} />
      <path d="M10.4 10.2v3.6M13.6 10.2v3.6M5 10.6v2.8M19 10.6v2.8" {...FINE} />
    </>
  ),
  scan: (
    <>
      <path d="M3.4 8V5.4a2 2 0 0 1 2-2H8M16 3.4h2.6a2 2 0 0 1 2 2V8M20.6 16v2.6a2 2 0 0 1-2 2H16M8 20.6H5.4a2 2 0 0 1-2-2V16" strokeWidth={2} />
      <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity={L1} />
      <circle cx="12" cy="12" r="5" {...FINE} />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" fillOpacity={L3} />
      <path d="M2.4 12h19.2" strokeOpacity={L3} />
    </>
  ),
  broom: (
    <>
      <path d="m20.4 3.6-7.6 7.6" strokeWidth={2} />
      <path d="m11.4 9.8 2.8 2.8-1.2 1.2-2.8-2.8Z" fill="currentColor" fillOpacity={L3} />
      <path d="M10.2 11c-2.4 0-5 1.2-6.6 3.4l5.8 5.8c2.2-1.6 3.4-4.2 3.4-6.6Z" fill="currentColor" fillOpacity={L2} />
      <path d="M10.2 11c-2.4 0-5 1.2-6.6 3.4l5.8 5.8c2.2-1.6 3.4-4.2 3.4-6.6Z" />
      <path d="m6.2 15.4 2.6 2.6M7.8 13.6l2.4 2.4" {...FINE} />
      <path d="M17 18.6h.01M19.6 15.8h.01M15 21h.01" strokeWidth={1.8} />
    </>
  ),
  mountain: (
    <>
      <path d="m2.4 19.6 7-11.2 3.8 6 2.6-3.6 5.8 8.8Z" fill="currentColor" fillOpacity={L1} />
      <path d="m2.4 19.6 7-11.2 3.8 6 2.6-3.6 5.8 8.8Z" />
      <path d="m7.4 11.6 2-3.2 2 3.2-1 .8-1-.8-1 .8Z" fill="currentColor" fillOpacity={L3} />
      <circle cx="17.6" cy="5.4" r="2" fill="currentColor" fillOpacity={L2} />
      <path d="M2.4 19.6h19.2" />
      <path d="M11.6 16.4h4M6 17.6h2.4" {...FINE} strokeOpacity={0.6} />
    </>
  ),
  steps: (
    <>
      <rect x="3" y="3.4" width="18" height="17.2" rx="2.4" fill="currentColor" fillOpacity={L1} />
      <path d="M4.6 19.4h4.2v-4.6h4.2v-4.6h4.2V5.6h2.2" />
      <path d="M4.6 19.4h4.2v-4.6h4.2v-4.6h4.2V5.6h2.2v13.8Z" fill="currentColor" fillOpacity={L2} stroke="none" />
      <circle cx="17.2" cy="3.6" r="1.4" {...DOT} />
      <path d="m6.6 12 3.2-3.2M9.8 8.8H7.6M9.8 8.8V11" {...FINE} />
    </>
  ),
  lungs: (
    <>
      <path d="M12 3v8.4M12 11.4l-2.6 2M12 11.4l2.6 2" />
      <path d="M9.4 6.6C5.4 7.4 4 12.6 4 16.6c0 2.2 2 3.4 4 2.6l1.8-.8a1.4 1.4 0 0 0 .8-1.2V9a2.4 2.4 0 0 0-1.2-2.4Z" fill="currentColor" fillOpacity={L2} />
      <path d="M14.6 6.6c4 .8 5.4 6 5.4 10 0 2.2-2 3.4-4 2.6l-1.8-.8a1.4 1.4 0 0 1-.8-1.2V9a2.4 2.4 0 0 1 1.2-2.4Z" fill="currentColor" fillOpacity={L2} />
      <path d="M9.4 6.6C5.4 7.4 4 12.6 4 16.6c0 2.2 2 3.4 4 2.6l1.8-.8a1.4 1.4 0 0 0 .8-1.2V9a2.4 2.4 0 0 0-1.2-2.4ZM14.6 6.6c4 .8 5.4 6 5.4 10 0 2.2-2 3.4-4 2.6l-1.8-.8a1.4 1.4 0 0 1-.8-1.2V9a2.4 2.4 0 0 1 1.2-2.4Z" />
      <path d="M6.4 12.6c.8-.4 1.8-.4 2.6 0M15 12.6c.8-.4 1.8-.4 2.6 0M6.6 15.6h2M15.4 15.6h2" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  scorecard: (
    <>
      <rect x="4" y="3.4" width="16" height="18" rx="2.2" fill="currentColor" fillOpacity={L1} />
      <rect x="4" y="3.4" width="16" height="18" rx="2.2" />
      <path d="M9 2.4h6v2.6H9Z" fill="currentColor" fillOpacity={L3} />
      <path d="M4 9.2h16M4 13.4h16M4 17.6h16M10.4 7.4v14M15.4 7.4v14" {...FINE} />
      <path d="M4 7.4h16v1.8H4Z" fill="currentColor" fillOpacity={L2} stroke="none" />
      <path d="M6.2 11.4h2M12 11.4h2M17 11.4h1.4M6.2 15.6h2M12 15.6h2" strokeWidth={1.6} />
    </>
  ),
  spine: (
    <>
      <path d="M2.6 15.2C7.4 9.8 16.6 9.8 21.4 15.2" strokeWidth={2.2} />
      <path d="M2.6 15.2C7.4 12.4 16.6 12.4 21.4 15.2" {...FINE} strokeOpacity={0.6} />
      <path d="M2.6 13.2 1.6 15.2l1 2M21.4 13.2l1 2-1 2" />
      <path d="M12 3.6v6.4" />
      <path d="m9.8 7.6 2.2 2.4 2.2-2.4" fill="currentColor" fillOpacity={L3} />
      <rect x="9.2" y="17.4" width="5.6" height="3.4" rx="1" fill="currentColor" fillOpacity={L2} />
      <path d="M10.4 19.1h3.2" {...FINE} />
    </>
  ),
  energy: (
    <>
      <circle cx="12" cy="12" r="9.2" fill="currentColor" fillOpacity={L1} stroke="none" />
      <path d="M13.4 2.6 5.6 13.2h5.6l-1.2 8.2 8.4-11.6h-5.8Z" fill="currentColor" fillOpacity={L2} />
      <path d="M13.4 2.6 5.6 13.2h5.6l-1.2 8.2 8.4-11.6h-5.8Z" />
      <path d="M3.6 7.6c1-1.8 2.4-3.2 4.2-4.2M20.4 16.4c-1 1.8-2.4 3.2-4.2 4.2" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  span: (
    <>
      <circle cx="12" cy="4.6" r="2.2" fill="currentColor" fillOpacity={L3} />
      <path d="M12 7v7.6l-3.2 6.6M12 14.6l3.2 6.6" />
      <path d="M2.6 10h18.8" strokeWidth={2} />
      <path d="M2.6 8.4v3.2M21.4 8.4v3.2" />
      <path d="M4.6 6.4h14.8" {...FINE} strokeDasharray="1.2 1.4" />
      <path d="m4.6 6.4 1.4-1M4.6 6.4l1.4 1M19.4 6.4 18 5.4M19.4 6.4 18 7.4" {...FINE} />
    </>
  ),
  bareshaft: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fillOpacity={L1} />
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="12" cy="12" r="6" {...FINE} />
      <circle cx="12" cy="12" r="3" {...FINE} />
      <circle cx="10.2" cy="13.4" r="1.8" fill="currentColor" fillOpacity={L3} />
      <path d="M14.2 9.4h.01M15.4 8.4h.01M13.6 10.6h.01" strokeWidth={2} />
      <path d="M10.2 13.4 14.4 9.6" {...FINE} strokeDasharray="1 1" />
    </>
  ),
  caliper: (
    <>
      <path d="M3.6 3.2h4.2v17.6H3.6Z" fill="currentColor" fillOpacity={L2} />
      <path d="M3.6 3.2h4.2v17.6H3.6Z" />
      <path d="M7.8 5.6h12.8v3.2H7.8" fill="currentColor" fillOpacity={L1} />
      <path d="M7.8 5.6h12.8v3.2H7.8" />
      <path d="M15.4 8.8v6.4l2 2.2V8.8" fill="currentColor" fillOpacity={L3} />
      <path d="M10 5.6v1.6M12 5.6v1M14 5.6v1.6M16 5.6v1M18 5.6v1.6" {...FINE} />
      <circle cx="5.7" cy="17.4" r="1" {...DOT} />
    </>
  ),
  ruler: (
    <>
      <path d="m2.8 15.6 12.8-12.8 5.6 5.6L8.4 21.2Z" fill="currentColor" fillOpacity={L1} />
      <path d="m2.8 15.6 12.8-12.8 5.6 5.6L8.4 21.2Z" />
      <path d="m5.6 12.8 2 2M8.4 10l1.4 1.4M11.2 7.2l2 2M14 4.4l1.4 1.4" />
      <path d="m2.8 15.6 5.6 5.6 1.6-1.6-5.6-5.6Z" fill="currentColor" fillOpacity={L3} stroke="none" />
      <circle cx="16.8" cy="7.2" r="1" {...FINE} />
    </>
  ),
  daily: (
    <>
      <rect x="3.6" y="4.8" width="16.8" height="16" rx="2.4" fill="currentColor" fillOpacity={L1} />
      <rect x="3.6" y="4.8" width="16.8" height="16" rx="2.4" />
      <path d="M3.6 7.2a2.4 2.4 0 0 1 2.4-2.4h12a2.4 2.4 0 0 1 2.4 2.4v2.2H3.6Z" fill="currentColor" fillOpacity={L2} />
      <path d="M8 2.8v4M16 2.8v4" strokeWidth={2} />
      <path d="m12 11.4 1.3 2.6 2.8.4-2 2 .5 2.8-2.6-1.4-2.6 1.4.5-2.8-2-2 2.8-.4Z" fill="currentColor" fillOpacity={L3} />
    </>
  ),
  quiz: (
    <>
      <path d="M3.4 5.4a2 2 0 0 1 2-2h13.2a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H10l-4.6 4v-4h0a2 2 0 0 1-2-2Z" fill="currentColor" fillOpacity={L1} />
      <path d="M3.4 5.4a2 2 0 0 1 2-2h13.2a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H10l-4.6 4v-4h0a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="10" r="4.6" fill="currentColor" fillOpacity={L2} stroke="none" />
      <path d="M10.2 8.4a1.9 1.9 0 1 1 2.8 1.6c-.6.4-1 .8-1 1.6" strokeWidth={1.8} />
      <circle cx="12" cy="13.6" r="0.9" {...DOT} />
    </>
  ),
  binoculars: (
    <>
      <path d="M5 8.6 7.4 4h3v6M19 8.6 16.6 4h-3v6" fill="currentColor" fillOpacity={L2} />
      <path d="M5 8.6 7.4 4h3v6M19 8.6 16.6 4h-3v6" />
      <path d="M10.4 10.6h3.2v3h-3.2Z" fill="currentColor" fillOpacity={L3} />
      <circle cx="6.8" cy="15.4" r="4.4" fill="currentColor" fillOpacity={L1} />
      <circle cx="17.2" cy="15.4" r="4.4" fill="currentColor" fillOpacity={L1} />
      <circle cx="6.8" cy="15.4" r="4.4" />
      <circle cx="17.2" cy="15.4" r="4.4" />
      <path d="M4.8 14a2.6 2.6 0 0 1 1.8-1.4M15.2 14a2.6 2.6 0 0 1 1.8-1.4" {...FINE} />
    </>
  ),
  book: (
    <>
      <path d="M2.8 4.8c3-.8 6-.6 9.2 1.4v15c-3.2-2-6.2-2.2-9.2-1.4Z" fill="currentColor" fillOpacity={L1} />
      <path d="M21.2 4.8c-3-.8-6-.6-9.2 1.4v15c3.2-2 6.2-2.2 9.2-1.4Z" fill="currentColor" fillOpacity={L2} />
      <path d="M2.8 4.8c3-.8 6-.6 9.2 1.4 3.2-2 6.2-2.2 9.2-1.4v15c-3-.8-6-.6-9.2 1.4-3.2-2-6.2-2.2-9.2-1.4Z" />
      <path d="M12 6.2v15" />
      <path d="M5 8.4c1.6-.2 3.2 0 4.8.8M5 11.4c1.6-.2 3.2 0 4.8.8M14.2 9.2c1.6-.8 3.2-1 4.8-.8M14.2 12.2c1.6-.8 3.2-1 4.8-.8" {...FINE} strokeOpacity={0.75} />
      <path d="M16 2.6v5l1.4-1 1.4 1v-5.4" fill="currentColor" fillOpacity={L3} />
    </>
  ),
  rules: (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity={L1} />
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" {...FINE} />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" fillOpacity={L3} />
      <path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3" />
      <path d="M15.6 6.4h3v-3" {...FINE} />
      <path d="M18.6 3.4 14 8" {...FINE} />
    </>
  ),
  wrench: (
    <>
      <path d="M14.6 3.4a5 5 0 0 0-1 5.8l-9.2 9.2a2.1 2.1 0 1 0 3 3l9.2-9.2a5 5 0 0 0 5.8-1l-2.8-.6-.8-2.4 2-2-2.4-.8Z" fill="currentColor" fillOpacity={L2} />
      <path d="M14.6 3.4a5 5 0 0 0-1 5.8l-9.2 9.2a2.1 2.1 0 1 0 3 3l9.2-9.2a5 5 0 0 0 5.8-1l-2.8-.6-.8-2.4 2-2-2.4-.8Z" />
      <circle cx="5.9" cy="19.9" r="0.8" {...DOT} />
      <path d="m8.6 15.4 5.6-5.6" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  hold: (
    <>
      <path d="M5 11.4c3 4.2 11 4.2 14 0M5 11.4c3-3.2 11-3.2 14 0" />
      <path d="M5 11.4c3 4.2 11 4.2 14 0-3-3.2-11-3.2-14 0Z" fill="currentColor" fillOpacity={L1} stroke="none" />
      <rect x="1.8" y="8.6" width="3.4" height="5.6" rx="1.2" fill="currentColor" fillOpacity={L3} />
      <rect x="18.8" y="8.6" width="3.4" height="5.6" rx="1.2" fill="currentColor" fillOpacity={L3} />
      <circle cx="12" cy="19" r="2.6" fill="currentColor" fillOpacity={L2} />
      <circle cx="12" cy="19" r="2.6" />
      <path d="M12 17.6V19l.9.6" {...FINE} />
      <path d="M12 3.4v3.2" {...FINE} />
    </>
  ),
  bowstring: (
    <>
      <path d="M6.2 2.8c6 4.2 6 14.2 0 18.4" strokeWidth={3} strokeOpacity={L2} />
      <path d="M6.2 2.8c6 4.2 6 14.2 0 18.4" />
      <path d="M6.2 2.8v18.4" {...FINE} />
      <rect x="4.8" y="9.4" width="2.8" height="5.2" rx="0.6" fill="currentColor" fillOpacity={L3} />
      <path d="M4.8 10.6h2.8M4.8 13.4h2.8" {...FINE} />
      <circle cx="6.2" cy="12" r="0.7" {...DOT} />
      <path d="M14 7.4c2 1 3.4 1 5.4 0M14 12c2 1 3.4 1 5.4 0M14 16.6c2 1 3.4 1 5.4 0" {...FINE} strokeOpacity={0.75} />
    </>
  ),
  rest: (
    <>
      <rect x="2.8" y="13" width="11.4" height="7.6" rx="1.8" fill="currentColor" fillOpacity={L2} />
      <rect x="2.8" y="13" width="11.4" height="7.6" rx="1.8" />
      <circle cx="6" cy="16.8" r="1.1" {...FINE} />
      <circle cx="10.8" cy="16.8" r="1.1" {...FINE} />
      <path d="m12.6 14.8 6.4-6.8" strokeWidth={2} />
      <circle cx="19.6" cy="7.4" r="1.8" fill="currentColor" fillOpacity={L3} />
      <path d="M2 8.6h20" strokeOpacity={0.55} strokeDasharray="2 1.4" />
      <path d="m21 7.6 1 1-1 1" {...FINE} />
    </>
  ),
  stabilizer: (
    <>
      <path d="M2.6 12h13.2" strokeWidth={2.4} />
      <path d="M2.6 12h13.2" {...FINE} stroke="#000" strokeOpacity={0.25} />
      <rect x="15.2" y="8.6" width="6.4" height="6.8" rx="1.6" fill="currentColor" fillOpacity={L2} />
      <rect x="15.2" y="8.6" width="6.4" height="6.8" rx="1.6" />
      <path d="M17.4 8.6v6.8M19.4 8.6v6.8" {...FINE} />
      <rect x="1.6" y="9.4" width="2.4" height="5.2" rx="0.8" fill="currentColor" fillOpacity={L3} />
      <path d="M7.4 10.6v2.8M11 10.6v2.8" {...FINE} />
    </>
  ),
  armguard: (
    <>
      <path d="M6.4 2.8h7.8c3.2 4.4 3.2 14 0 18.4H6.4c2-6 2-12.4 0-18.4Z" fill="currentColor" fillOpacity={L1} />
      <path d="M6.4 2.8h7.8c3.2 4.4 3.2 14 0 18.4H6.4c2-6 2-12.4 0-18.4Z" />
      <path d="M14.2 2.8c3.2 4.4 3.2 14 0 18.4h-2.4c2.6-5.2 2.6-13.2 0-18.4Z" fill="currentColor" fillOpacity={L2} stroke="none" />
      <path d="M8.6 6.6h6M9 12h6.6M8.6 17.4h6" />
      <circle cx="16.8" cy="6.6" r="0.9" {...DOT} />
      <circle cx="17.6" cy="12" r="0.9" {...DOT} />
      <circle cx="16.8" cy="17.4" r="0.9" {...DOT} />
    </>
  ),
  release: (
    <>
      <path d="M5.4 3.6h5.4v6.6a4.4 4.4 0 0 1-4.4 4.4h-1Z" fill="currentColor" fillOpacity={L2} />
      <path d="M5.4 3.6h5.4v6.6a4.4 4.4 0 0 1-4.4 4.4h-1Z" />
      <path d="M7.4 14.6v5.8M5 20.6h4.8" strokeWidth={2} />
      <path d="M10.8 6.6h4.4l3.2 2.2-3.2 2.2h-4.4" fill="currentColor" fillOpacity={L1} />
      <path d="M10.8 6.6h4.4l3.2 2.2-3.2 2.2h-4.4" />
      <circle cx="19.4" cy="8.8" r="1.4" fill="currentColor" fillOpacity={L3} />
      <path d="M7 5.8v5" {...FINE} strokeOpacity={0.7} />
    </>
  ),
  chestguard: (
    <>
      <path d="M5 5.6c4.4-2.2 9.6-2.2 14 0v8.6c-3.2 4.8-10.8 4.8-14 0Z" fill="currentColor" fillOpacity={L1} />
      <path d="M5 5.6c4.4-2.2 9.6-2.2 14 0v8.6c-3.2 4.8-10.8 4.8-14 0Z" />
      <path d="M5 5.6 2.6 3.2M19 5.6l2.4-2.4M5 12.6l-2.4 1.6" />
      <path d="M8.2 7.4h7.6M7.6 10.4h8.8M8.2 13.4h7.6" {...FINE} />
      <path d="M8.2 7.4h7.6v6H8.2Z" fill="currentColor" fillOpacity={L2} stroke="none" />
    </>
  ),
  bowcase: (
    <>
      <rect x="2.4" y="7" width="19.2" height="12.4" rx="2.4" fill="currentColor" fillOpacity={L1} />
      <rect x="2.4" y="7" width="19.2" height="12.4" rx="2.4" />
      <path d="M8.8 7V5a1 1 0 0 1 1-1h4.4a1 1 0 0 1 1 1v2" />
      <path d="M2.4 12.2h19.2" />
      <rect x="10.4" y="10.8" width="3.2" height="3" rx="0.6" fill="currentColor" fillOpacity={L3} />
      <path d="M5.4 15.8c2.6-1.6 4.6-1.6 6.6 0s4 1.6 6.6 0" {...FINE} strokeOpacity={0.6} />
    </>
  ),
  bowstand: (
    <>
      <path d="M12 3.2v10" strokeWidth={2} />
      <path d="M12 13.2 5.6 21M12 13.2l6.4 7.8M12 13.2V21" />
      <path d="M8.4 4.2c2.4-1.4 4.8-1.4 7.2 0v2.4c-2.4-1.2-4.8-1.2-7.2 0Z" fill="currentColor" fillOpacity={L3} />
      <circle cx="12" cy="13.2" r="1.8" fill="currentColor" fillOpacity={L2} />
      <path d="M4.6 21h2M11 21h2M17.4 21h2" />
    </>
  ),
  shirt: (
    <>
      <path d="M8 3.2 3 6.4l2.2 4.4 2-1v11.4h9.6V9.8l2 1L21 6.4l-5-3.2c-.6 1.6-2 2.6-4 2.6s-3.4-1-4-2.6Z" fill="currentColor" fillOpacity={L1} />
      <path d="M8 3.2 3 6.4l2.2 4.4 2-1v11.4h9.6V9.8l2 1L21 6.4l-5-3.2c-.6 1.6-2 2.6-4 2.6s-3.4-1-4-2.6Z" />
      <path d="M7.2 12.6h9.6v2.4H7.2Z" fill="currentColor" fillOpacity={L3} />
      <path d="M12 5.8v4.4" {...FINE} />
      <path d="M10.4 9.4h.01M13.6 9.4h.01" strokeWidth={1.6} />
    </>
  ),
  shoe: (
    <>
      <path d="M2.8 8.6c2.8 0 4.8-1.2 5.8-4h3.2l1 5c3.4 1 6.6 2.2 8.4 4.6v3.4H2.8Z" fill="currentColor" fillOpacity={L1} />
      <path d="M2.8 8.6c2.8 0 4.8-1.2 5.8-4h3.2l1 5c3.4 1 6.6 2.2 8.4 4.6v3.4H2.8Z" />
      <path d="M2.8 15.6h18.4v2H2.8Z" fill="currentColor" fillOpacity={L3} />
      <path d="M9.6 7.4h2.2M10 9.6h2.6M10.6 11.8h2.6" {...FINE} />
      <path d="M5 13.2h.01M7.2 13.2h.01" strokeWidth={1.6} />
    </>
  ),
};
