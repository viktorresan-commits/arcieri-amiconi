/**
 * Luce da illustrazione fantasy: un filo di luce calda sul contorno in alto a sinistra (la luce principale) e uno
 * freddo sul contorno opposto (la luce da dietro), e l'ombra a terra morbida. Solo spostamenti e composizioni
 * (niente sfocature): costa poco anche quando la figura si muove.
 */
export function RimLightDefs({ id, warm = "#ffe2a6", cool = "#8fbcff", strength = 1 }: { id: string; warm?: string; cool?: string; strength?: number }) {
  return (
    <>
      <filter id={id} x="-8%" y="-6%" width="116%" height="112%" colorInterpolationFilters="sRGB">
        <feOffset in="SourceAlpha" dx="1.3" dy="1.1" result="aOff" />
        <feComposite in="SourceAlpha" in2="aOff" operator="out" result="edgeKey" />
        <feFlood floodColor={warm} floodOpacity={(0.5 * strength).toFixed(2)} />
        <feComposite in2="edgeKey" operator="in" result="rimKey" />
        <feOffset in="SourceAlpha" dx="-1.5" dy="-0.4" result="bOff" />
        <feComposite in="SourceAlpha" in2="bOff" operator="out" result="edgeBack" />
        <feFlood floodColor={cool} floodOpacity={(0.32 * strength).toFixed(2)} />
        <feComposite in2="edgeBack" operator="in" result="rimBack" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="rimKey" />
          <feMergeNode in="rimBack" />
        </feMerge>
      </filter>
      <radialGradient id={`${id}g`}>
        <stop offset="0" stopColor="#000" stopOpacity="0.5" />
        <stop offset="0.55" stopColor="#000" stopOpacity="0.26" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </>
  );
}
