import type { ReactNode } from "react";

/**
 * Illustrazioni di riferimento degli strumenti: un disegno con le misure e una riga che spiega
 * cosa guardare. Stesso stile per tutti (fondo scuro, linee chiare, quote in giallo).
 */
const Q = "#ffd27a"; // quote
const L = "#e8e4da"; // linee
const M = "rgba(232,228,218,0.55)";

function Dim({ x1, y1, x2, y2, label, dy = -6 }: { x1: number; y1: number; x2: number; y2: number; label: string; dy?: number }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={Q} strokeWidth="1.3" markerStart="url(#ta-a)" markerEnd="url(#ta-a)" />
      <text x={mx} y={my + dy} fill={Q} fontSize="10" fontWeight="700" textAnchor="middle">{label}</text>
    </g>
  );
}

function Frame({ children, caption, h = 150 }: { children: ReactNode; caption: string; h?: number }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-[#101a15]">
      <svg viewBox={`0 0 320 ${h}`} className="block w-full" role="img" aria-label={caption}>
        <defs>
          <marker id="ta-a" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" fill={Q} />
          </marker>
          <linearGradient id="ta-wood" x1="0" x2="1">
            <stop offset="0" stopColor="#5b3518" />
            <stop offset="0.5" stopColor="#b47a42" />
            <stop offset="1" stopColor="#5b3518" />
          </linearGradient>
        </defs>
        {children}
      </svg>
      <figcaption className="border-t border-line px-3 py-2 text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}

function Bow({ x = 60, y = 75, h = 120, color = "#2f6fbe" }: { x?: number; y?: number; h?: number; color?: string }) {
  const t = y - h / 2;
  const b = y + h / 2;
  return (
    <g>
      <path d={`M${x} ${y - 16} C${x + 2} ${t + 24} ${x - 10} ${t + 8} ${x - 14} ${t} C${x - 16} ${t - 5} ${x - 11} ${t - 8} ${x - 7} ${t - 6}`} stroke="#15191d" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d={`M${x} ${y + 16} C${x + 2} ${b - 24} ${x - 10} ${b - 8} ${x - 14} ${b} C${x - 16} ${b + 5} ${x - 11} ${b + 8} ${x - 7} ${b + 6}`} stroke="#15191d" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <rect x={x - 3} y={y - 20} width="7" height="40" rx="3" fill={color} />
      <line x1={x - 14} y1={t + 2} x2={x - 14} y2={b - 2} stroke={L} strokeWidth="1" />
    </g>
  );
}

export function ToolArt({ id }: { id: string }) {
  switch (id) {
    case "spine":
      return (
        <Frame caption="Spine: di quanto si flette l'asta (in millesimi di pollice) con 880 g appesi al centro, appoggiata a 28″. Numero più alto = asta più morbida.">
          <line x1="40" y1="60" x2="40" y2="110" stroke={M} strokeWidth="3" />
          <line x1="280" y1="60" x2="280" y2="110" stroke={M} strokeWidth="3" />
          <path d="M30 60 L50 60 M270 60 L290 60" stroke={L} strokeWidth="2" />
          <path d="M40 58 Q160 58 280 58" stroke={M} strokeWidth="2.5" strokeDasharray="4 4" fill="none" />
          <path d="M40 58 Q160 98 280 58" stroke="#1d1f22" strokeWidth="5" fill="none" />
          <path d="M40 58 Q160 98 280 58" stroke="#5aa6e8" strokeWidth="1.2" fill="none" opacity="0.6" />
          <line x1="160" y1="78" x2="160" y2="104" stroke={L} strokeWidth="1.5" />
          <rect x="146" y="104" width="28" height="22" rx="4" fill="#6c7684" />
          <text x="160" y="119" fill={L} fontSize="9" textAnchor="middle" fontWeight="700">880 g</text>
          <Dim x1={190} y1={58} x2={190} y2={78} label="flessione" dy={0} />
          <Dim x1={40} y1={30} x2={280} y2={30} label="28″ fra gli appoggi" />
          <g fontSize="9" fill={M}>
            <text x="20" y="140">500 = rigida (più libbre)</text>
            <text x="300" y="140" textAnchor="end">900 = morbida (meno libbre)</text>
          </g>
        </Frame>
      );
    case "vento":
      return (
        <Frame caption="Il vento di traverso spinge la freccia di lato per tutto il volo: più distanza e più vento, più spostamento. Si mira dalla parte da cui arriva.">
          <g opacity="0.9">
            {[40, 62, 84].map((y, i) => (
              <path key={y} d={`M10 ${y} q16 -6 32 0 t32 0 t32 0`} stroke="#3aa7c4" strokeWidth="2" fill="none" opacity={0.5 + i * 0.2} markerEnd="url(#ta-a)" />
            ))}
            <text x="14" y="26" fill="#3aa7c4" fontSize="10" fontWeight="700">vento →</text>
          </g>
          <circle cx="60" cy="120" r="5" fill={L} />
          <text x="60" y="140" fill={M} fontSize="9" textAnchor="middle">arciere</text>
          <path d="M60 120 Q180 112 270 70" stroke={L} strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
          <path d="M60 120 Q180 116 270 98" stroke="#ffd27a" strokeWidth="2" fill="none" />
          <g transform="translate(272 84)">
            {[24, 18, 12, 6].map((r, i) => <circle key={r} r={r} fill={["#f4f1ea", "#2a6294", "#c4473d", "#e6b325"][i]} />)}
          </g>
          <circle cx="270" cy="70" r="3" fill="#7cf0a8" />
          <text x="252" y="56" fill="#7cf0a8" fontSize="9" fontWeight="700" textAnchor="end">mira qui (controvento)</text>
          <circle cx="272" cy="98" r="3" fill="#ffd27a" />
          <text x="228" y="128" fill={Q} fontSize="9">dove va senza correzione</text>
        </Frame>
      );
    case "energia":
      return (
        <Frame caption="Velocità (m/s) ed energia (J = ½·massa·velocità²). Una freccia più pesante va più piano ma porta più energia e quantità di moto, e risente meno del vento.">
          {[0, 1].map((k) => {
            const y = 48 + k * 56;
            const len = k ? 150 : 210;
            return (
              <g key={k}>
                <line x1="40" y1={y} x2={40 + len} y2={y} stroke={k ? "#c99a5e" : "#1d1f22"} strokeWidth={k ? 5 : 3.5} />
                <path d={`M${40 + len} ${y - 4} l10 4 l-10 4 z`} fill="#c9d0d8" />
                <path d={`M44 ${y} l8 -9 l22 2 l2 7 z M44 ${y} l8 9 l22 -2 l2 -7 z`} fill={k ? "#e6b325" : "#d63a2f"} />
                {[1, 2, 3].map((i) => <line key={i} x1={40 - i * 10} y1={y} x2={40 - i * 10 - 12} y2={y} stroke={M} strokeWidth="1.5" opacity={1 - i * 0.25} />)}
                <text x={len + 64} y={y - 6} fill={L} fontSize="10" fontWeight="700">{k ? "pesante · 380 gr" : "leggera · 300 gr"}</text>
                <text x={len + 64} y={y + 8} fill={Q} fontSize="9">{k ? "58 m/s · 41 J" : "64 m/s · 40 J"}</text>
              </g>
            );
          })}
        </Frame>
      );
    case "allungo":
      return (
        <Frame caption="Apertura delle braccia (da punta a punta del dito medio) diviso 2,5 = allungo in pollici. La stima si conferma all'arco con una freccia lunga segnata.">
          <circle cx="160" cy="34" r="11" fill="#eac4a6" />
          <path d="M160 46 L160 100 M160 100 L146 138 M160 100 L174 138" stroke="#2f6f62" strokeWidth="9" strokeLinecap="round" />
          <path d="M40 58 L280 58" stroke="#eac4a6" strokeWidth="7" strokeLinecap="round" />
          <path d="M150 54 L170 54 L172 90 L148 90 Z" fill="#2f6f62" />
          <line x1="22" y1="10" x2="22" y2="140" stroke={M} strokeWidth="3" />
          <text x="26" y="20" fill={M} fontSize="9">muro</text>
          <Dim x1={37} y1={80} x2={283} y2={80} label="apertura braccia (cm)" dy={14} />
          <text x="160" y="146" fill={Q} fontSize="10" textAnchor="middle" fontWeight="700">allungo ≈ apertura ÷ 2,5 (in pollici)</text>
        </Frame>
      );
    case "tuning":
      return (
        <Frame caption="Asta nuda (senza penne) contro frecce impennate, stessa mira. Arciere destro: nude a sinistra = spine rigido; a destra = morbido; sopra = punto d'incocco basso.">
          <g transform="translate(160 76)">
            {[56, 46, 36, 26, 16, 7].map((r, i) => <circle key={r} r={r} fill={["#f4f1ea", "#1a1c1e", "#2a6294", "#c4473d", "#e6b325", "#e6b325"][i]} stroke="rgba(20,24,28,0.4)" />)}
            {[[-4, 2], [5, -3], [2, 6]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.4" fill="#7cf0a8" stroke="#0b120e" />)}
            {[[-30, -2], [-34, 5]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.4" fill="#ff8f6b" stroke="#0b120e" />)}
          </g>
          <g fontSize="9">
            <circle cx="20" cy="18" r="4" fill="#7cf0a8" /><text x="28" y="21" fill={L}>impennate</text>
            <circle cx="20" cy="34" r="4" fill="#ff8f6b" /><text x="28" y="37" fill={L}>nude</text>
            <text x="300" y="21" fill={Q} textAnchor="end">nude a sinistra</text>
            <text x="300" y="34" fill={Q} textAnchor="end">→ spine rigido</text>
          </g>
          <path d="M120 120 L60 120" stroke={Q} strokeWidth="1.3" markerEnd="url(#ta-a)" />
          <text x="66" y="134" fill={Q} fontSize="9">rigido</text>
          <path d="M200 120 L260 120" stroke={M} strokeWidth="1.3" markerEnd="url(#ta-a)" />
          <text x="254" y="134" fill={M} fontSize="9" textAnchor="end">morbido</text>
        </Frame>
      );
    case "assetto":
      return (
        <Frame caption="Le tre misure base: brace (corda–punto più profondo dell'impugnatura), tiller (differenza tra flettente alto e basso) e punto d'incocco sopra il rest.">
          <Bow x={150} y={75} h={124} />
          <Dim x1={136} y1={75} x2={150} y2={75} label="" />
          <Dim x1={150} y1={42} x2={136} y2={42} label="" />
          <Dim x1={150} y1={108} x2={136} y2={108} label="" />
          <g fill={Q} fontSize="10" fontWeight="700" textAnchor="end">
            <text x="128" y="45">tiller alto</text>
            <text x="128" y="78">brace</text>
            <text x="128" y="111">tiller basso</text>
          </g>
          <g transform="translate(220 75)">
            <line x1="-40" y1="0" x2="40" y2="0" stroke="#1d1f22" strokeWidth="4" />
            <line x1="-36" y1="-28" x2="-36" y2="28" stroke={L} strokeWidth="1.2" />
            <rect x="-40" y="-8" width="8" height="5" rx="1" fill="#e6b325" />
            <path d="M-20 4 L-6 4" stroke="#9aa3ad" strokeWidth="3" />
            <Dim x1={-48} y1={-3} x2={-48} y2={2} label="" />
            <text x="-30" y="-14" fill={Q} fontSize="9">incocco +3–6 mm</text>
            <text x="-4" y="18" fill={M} fontSize="9">rest</text>
          </g>
        </Frame>
      );
    case "unita":
      return (
        <Frame caption="Le unità che trovi sull'attrezzatura: libbre, grani, pollici e iarde, con l'equivalente che usi in campo.">
          {[
            ["1 lb", "0,454 kg", "carico dell'arco"],
            ["1 grano", "0,0648 g", "peso di punte e frecce"],
            ["1″ (pollice)", "2,54 cm", "allungo, lunghezze"],
            ["1 iarda", "0,914 m", "distanze USA"],
            ["1 fps", "0,305 m/s", "velocità della freccia"],
          ].map(([a, b, c], i) => (
            <g key={a} transform={`translate(0 ${18 + i * 26})`}>
              <text x="20" y="4" fill={L} fontSize="12" fontWeight="700">{a}</text>
              <path d="M104 0 H140" stroke={Q} strokeWidth="1.3" markerEnd="url(#ta-a)" />
              <text x="150" y="4" fill={Q} fontSize="12" fontWeight="700">{b}</text>
              <text x="300" y="4" fill={M} fontSize="9" textAnchor="end">{c}</text>
            </g>
          ))}
        </Frame>
      );
    case "tempi":
      return (
        <Frame caption="Il tempo si misura dall'inizio della trazione al rilascio: trazione, ancoraggio, mira e uscita. La costanza conta più del numero.">
          {[["trazione", 0, 70, "#5aa6e8"], ["ancoraggio", 70, 120, "#8a5bd1"], ["mira", 120, 230, "#e0b15a"], ["rilascio", 230, 262, "#3d8f5f"]].map(([l, a, b, c]) => (
            <g key={String(l)}>
              <rect x={30 + Number(a)} y="56" width={Number(b) - Number(a) - 2} height="28" rx="6" fill={String(c)} opacity="0.85" />
              <text x={30 + (Number(a) + Number(b)) / 2} y="74" fill="#0b120e" fontSize="9.5" fontWeight="700" textAnchor="middle">{l}</text>
            </g>
          ))}
          <Dim x1={30} y1={104} x2={290} y2={104} label="4–7 s per l'olimpico" dy={14} />
          <text x="30" y="40" fill={M} fontSize="9">tocca all'inizio</text>
          <text x="290" y="40" fill={M} fontSize="9" textAnchor="end">tocca al rilascio</text>
        </Frame>
      );
    default:
      return null;
  }
}
