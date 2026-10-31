import type { ReactNode } from "react";

const NAVY = "#0B4F9E";
const ROYAL = "#1E78D6";
const MIST = "#DCE8F5";
const INK = "#18191C";
const AMBER = "#F5B82E";

type A = { on: boolean };

function Spin({ cx, cy, dur, on, rev }: A & { cx: number; cy: number; dur: number; rev?: boolean }) {
  return on ? <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`${rev ? -360 : 360} ${cx} ${cy}`} dur={`${dur}s`} repeatCount="indefinite" /> : null;
}
function Slide({ dx, dy, dur, on }: A & { dx: number; dy: number; dur: number }) {
  return on ? <animateTransform attributeName="transform" type="translate" values={`0 0;${dx} ${dy};0 0`} dur={`${dur}s`} repeatCount="indefinite" /> : null;
}
function Pulse({ attr, from, to, dur, on }: A & { attr: string; from: string; to: string; dur: number }) {
  return on ? <animate attributeName={attr} values={`${from};${to};${from}`} dur={`${dur}s`} repeatCount="indefinite" /> : null;
}

const Health = ({ on }: A) => (
  <g>
    <rect x="86" y="22" width="52" height="52" rx="14" fill="#fff" />
    <rect x="105" y="30" width="14" height="36" rx="3" fill={NAVY} /><rect x="94" y="41" width="36" height="14" rx="3" fill={NAVY} />
    <polyline points="20,92 70,92 82,78 94,104 108,84 118,92 204,92" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="300" strokeDashoffset="0">
      {on && <animate attributeName="stroke-dashoffset" values="300;0;0;-300" dur="3.2s" repeatCount="indefinite" />}
    </polyline>
  </g>
);
const Education = ({ on }: A) => (
  <g>
    <path d="M112 78 C92 66 66 66 52 72 V104 C66 98 92 98 112 108 Z" fill="#fff" /><path d="M112 78 C132 66 158 66 172 72 V104 C158 98 132 98 112 108 Z" fill={MIST} />
    <g><polygon points="112,18 148,34 112,50 76,34" fill={INK} /><rect x="104" y="46" width="16" height="10" fill={INK} /><Slide on={on} dx={0} dy={-6} dur={2.4} /></g>
    <line x1="148" y1="34" x2="148" y2="56" stroke={AMBER} strokeWidth="3" />
  </g>
);
const Factory = ({ on }: A) => (
  <g>
    <g><circle cx="86" cy="52" r="22" fill="#fff" />{[0, 45, 90, 135].map((r) => <rect key={r} x="80" y="24" width="12" height="56" rx="3" fill="#fff" transform={`rotate(${r} 86 52)`} />)}<circle cx="86" cy="52" r="9" fill={NAVY} /><Spin on={on} cx={86} cy={52} dur={6} /></g>
    <g><circle cx="140" cy="68" r="14" fill={MIST} />{[0, 60, 120].map((r) => <rect key={r} x="136" y="50" width="8" height="36" rx="2" fill={MIST} transform={`rotate(${r} 140 68)`} />)}<circle cx="140" cy="68" r="5" fill={NAVY} /><Spin on={on} cx={140} cy={68} dur={4} rev /></g>
    <rect x="20" y="92" width="184" height="8" fill={INK} /><g><rect x="30" y="76" width="22" height="16" rx="3" fill={AMBER} /><Slide on={on} dx={130} dy={0} dur={4} /></g>
  </g>
);
const Agri = ({ on }: A) => (
  <g>
    <g><circle cx="176" cy="30" r="12" fill={AMBER} />{[0, 45, 90, 135].map((r) => <rect key={r} x="174" y="8" width="4" height="44" fill={AMBER} opacity=".6" transform={`rotate(${r} 176 30)`} />)}<Spin on={on} cx={176} cy={30} dur={14} /></g>
    <path d="M112 100 V56" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    <g><path d="M112 66 C88 66 80 48 82 38 C102 38 112 50 112 66Z" fill="#fff" /><Pulse on={on} attr="opacity" from="1" to=".7" dur={2.5} /></g>
    <path d="M112 54 C136 54 144 36 142 26 C122 26 112 38 112 54Z" fill={MIST} />
    <path d="M20 100 Q60 90 112 100 T204 100" fill="none" stroke="#fff" strokeWidth="3" opacity=".7" />
  </g>
);
const Finance = ({ on }: A) => (
  <g>
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={50 + i * 34} y={100 - (24 + i * 16)} width="22" height={24 + i * 16} rx="4" fill={i === 3 ? AMBER : "#fff"}>
        {on && <animate attributeName="height" values={`${10};${24 + i * 16};${24 + i * 16}`} dur="2.4s" repeatCount="indefinite" />}
        {on && <animate attributeName="y" values={`${90};${100 - (24 + i * 16)};${100 - (24 + i * 16)}`} dur="2.4s" repeatCount="indefinite" />}
      </rect>
    ))}
    <polyline points="40,76 84,60 118,64 152,36 184,24" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
    <circle cx="184" cy="24" r="6" fill={NAVY} />
  </g>
);
const Tech = ({ on }: A) => (
  <g>
    <rect x="52" y="20" width="120" height="72" rx="10" fill="#fff" /><rect x="60" y="28" width="104" height="56" rx="5" fill={INK} />
    {[0, 1, 2, 3].map((i) => <rect key={i} x="68" y={36 + i * 11} width={30 + ((i * 23) % 50)} height="5" rx="2.5" fill={i % 2 ? "#3898F8" : MIST}>{on && <animate attributeName="width" values={`${10};${30 + ((i * 23) % 50)};${30 + ((i * 23) % 50)}`} dur={`${2 + i * 0.4}s`} repeatCount="indefinite" />}</rect>)}
    <rect x="94" y="92" width="36" height="6" rx="3" fill="#fff" />
    <g><rect x="176" y="60" width="26" height="26" rx="6" fill={AMBER} /><rect x="183" y="67" width="12" height="12" rx="2" fill={INK} /><Pulse on={on} attr="opacity" from="1" to=".55" dur={1.6} /></g>
  </g>
);
const Construction = ({ on }: A) => (
  <g>
    <rect x="48" y="26" width="6" height="74" fill="#fff" /><polygon points="48,26 54,26 51,12" fill="#fff" />
    <g><rect x="30" y="26" width="124" height="6" fill="#fff" /><line x1="140" y1="32" x2="140" y2="62" stroke={MIST} strokeWidth="2" /><rect x="132" y="62" width="16" height="12" fill={AMBER} /><Spin on={on} cx={51} cy={29} dur={9} /></g>
    <rect x="130" y="76" width="60" height="24" fill={MIST} /><rect x="142" y="60" width="48" height="16" fill="#fff" />
    {[0, 1, 2].map((i) => <rect key={i} x={138 + i * 18} y={82} width="9" height="9" fill={NAVY} />)}
  </g>
);
const Energy = ({ on }: A) => (
  <g>
    <path d="M110 100 L114 56 L118 100Z" fill="#fff" />
    <g><circle cx="114" cy="54" r="5" fill={AMBER} />{[0, 120, 240].map((r) => <path key={r} d="M114 54 L110 14 L118 14Z" fill="#fff" transform={`rotate(${r} 114 54)`} />)}<Spin on={on} cx={114} cy={54} dur={3.5} /></g>
    <g><polygon points="168,24 150,62 164,62 156,92 186,50 170,50 178,24" fill={AMBER} /><Pulse on={on} attr="opacity" from="1" to=".5" dur={1.4} /></g>
  </g>
);
const Transport = ({ on }: A) => (
  <g>
    <g>
      <rect x="40" y="52" width="78" height="38" rx="5" fill="#fff" /><path d="M118 62 H146 L158 78 V90 H118Z" fill={MIST} /><rect x="130" y="66" width="14" height="10" fill={NAVY} />
      <circle cx="66" cy="92" r="9" fill={INK} /><circle cx="140" cy="92" r="9" fill={INK} />
      <Slide on={on} dx={22} dy={0} dur={3} />
    </g>
    <line x1="10" y1="102" x2="214" y2="102" stroke="#fff" strokeWidth="3" strokeDasharray="10 8" />
  </g>
);
const Hospitality = ({ on }: A) => (
  <g>
    <g><path d="M52 80 A60 46 0 0 1 172 80Z" fill="#fff" /><circle cx="112" cy="30" r="7" fill="#fff" /><Slide on={on} dx={0} dy={-4} dur={1.8} /></g>
    <rect x="40" y="80" width="144" height="8" rx="4" fill={MIST} />
    <path d="M86 56 A32 24 0 0 1 112 38" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" opacity=".5" />
  </g>
);
const Retail = ({ on }: A) => (
  <g>
    <path d="M44 34 H180 L172 56 H52Z" fill="#fff" />{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={50 + i * 21} y="34" width="11" height="22" fill={i % 2 ? NAVY : "#fff"} />)}
    <rect x="52" y="56" width="120" height="44" fill={MIST} /><rect x="64" y="66" width="30" height="34" fill={NAVY} />
    <g><rect x="116" y="68" width="40" height="28" rx="4" fill={AMBER} /><path d="M126 68 C126 56 146 56 146 68" fill="none" stroke={INK} strokeWidth="3" /><Slide on={on} dx={0} dy={-4} dur={2} /></g>
  </g>
);
const Media = ({ on }: A) => (
  <g>
    <rect x="46" y="28" width="132" height="72" rx="12" fill="#fff" />
    <g><polygon points="100,46 100,82 134,64" fill={NAVY} /><Pulse on={on} attr="opacity" from="1" to=".6" dur={1.5} /></g>
    <circle cx="164" cy="40" r="5" fill={AMBER}><Pulse on={on} attr="opacity" from="1" to=".2" dur={1} /></circle>
    <rect x="56" y="88" width="112" height="4" rx="2" fill={MIST} /><rect x="56" y="88" width="48" height="4" rx="2" fill={ROYAL}>{on && <animate attributeName="width" values="10;112;10" dur="6s" repeatCount="indefinite" />}</rect>
  </g>
);
const Gov = ({ on }: A) => (
  <g>
    <polygon points="112,18 176,42 48,42" fill="#fff" />
    {[0, 1, 2, 3].map((i) => <rect key={i} x={62 + i * 32} y="48" width="14" height="42" fill={MIST} />)}
    <rect x="44" y="92" width="136" height="9" fill="#fff" />
    <g><rect x="112" y="4" width="2" height="16" fill="#fff" /><path d="M114 4 H132 L126 9 L132 14 H114Z" fill={AMBER} /><Slide on={on} dx={3} dy={0} dur={1.6} /></g>
  </g>
);
const Science = ({ on }: A) => (
  <g>
    <path d="M98 20 H126 V48 L150 90 Q154 100 144 100 H80 Q70 100 74 90 L98 48Z" fill="#fff" />
    <path d="M86 78 H138 L146 92 Q148 98 142 98 H82 Q76 98 78 92Z" fill={ROYAL} />
    {[0, 1, 2].map((i) => <circle key={i} cx={100 + i * 12} cy="80" r={3 + (i % 2)} fill={MIST}>{on && <animate attributeName="cy" values="82;52;82" dur={`${2 + i * 0.7}s`} repeatCount="indefinite" />}</circle>)}
    <circle cx="170" cy="40" r="6" fill={AMBER} />
  </g>
);
const Env = ({ on }: A) => (
  <g>
    <path d="M112 20 C150 24 164 60 128 86 C96 96 70 70 80 40 C88 26 100 22 112 20Z" fill="#fff" /><path d="M112 24 C110 50 104 70 96 90" fill="none" stroke={NAVY} strokeWidth="3" />
    <g><path d="M0 92 Q28 82 56 92 T112 92 T168 92 T224 92 V124 H0Z" fill={MIST} opacity=".9" /><Slide on={on} dx={-56} dy={0} dur={4} /></g>
  </g>
);
const Compass = ({ on }: A) => (
  <g>
    <circle cx="112" cy="58" r="40" fill="#fff" /><circle cx="112" cy="58" r="32" fill="none" stroke={NAVY} strokeWidth="2" strokeDasharray="2 6" />
    <g><path d="M112 22 L120 58 L112 52 L104 58Z" fill={AMBER} /><path d="M112 94 L104 58 L112 64 L120 58Z" fill={NAVY} /><Spin on={on} cx={112} cy={58} dur={10} /></g>
  </g>
);

const SCENES: [RegExp, (p: A) => ReactNode][] = [
  [/health|medic|nurs|care|pharma/i, Health],
  [/educat|train|school|teach/i, Education],
  [/manufactur|industr|engineer|machin/i, Factory],
  [/agri|farm|plantation|fish|forest/i, Agri],
  [/financ|bank|insur|account/i, Finance],
  [/ict|inform|digital|tech|software|comput|telecom/i, Tech],
  [/construct|build|real estate|property/i, Construction],
  [/energy|oil|gas|power|electric|utilit/i, Energy],
  [/transport|logist|aviat|shipping|supply/i, Transport],
  [/touris|hospital|food|hotel|restaurant|beverage/i, Hospitality],
  [/retail|wholesale|trade|commerce|sales/i, Retail],
  [/media|creative|art|entertain|design|broadcast/i, Media],
  [/public|govern|admin|defen|legal/i, Gov],
  [/scien|research|professional|consult|bio/i, Science],
  [/environ|water|waste|green|climate|mining/i, Env],
];

export function RoleArt({ sector, title, animate = true, className }: { sector: string; title: string; animate?: boolean; className?: string }) {
  const Scene = (SCENES.find(([re]) => re.test(sector))?.[1] ?? SCENES.find(([re]) => re.test(title))?.[1] ?? Compass) as (p: A) => ReactNode;
  const ai = /\b(ai|data|machine|analyst|scientist|automation)\b/i.test(title);
  return (
    <svg viewBox="0 0 224 124" className={className} role="img" aria-label={`Illustration for ${sector}`} data-testid="img-role-art" preserveAspectRatio="xMidYMid slice">
      <rect width="224" height="124" fill="#3898F8" />
      <circle cx="30" cy="22" r="44" fill="#fff" opacity=".12" />
      <g opacity=".85"><ellipse cx="46" cy="30" rx="20" ry="6" fill="#fff" /><ellipse cx="62" cy="26" rx="14" ry="5" fill="#fff" /><Slide on={animate} dx={12} dy={0} dur={7} /></g>
      <rect y="100" width="224" height="24" fill={NAVY} />
      <Scene on={animate} />
      {ai && (
        <g data-testid="art-ai-overlay">
          <line x1="184" y1="14" x2="204" y2="30" stroke="#fff" strokeWidth="1.5" /><line x1="204" y1="30" x2="190" y2="48" stroke="#fff" strokeWidth="1.5" /><line x1="184" y1="14" x2="190" y2="48" stroke="#fff" strokeWidth="1.5" />
          {[[184, 14], [204, 30], [190, 48]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={AMBER}>{animate && <animate attributeName="r" values="3;5.5;3" dur={`${1.6 + i * 0.3}s`} repeatCount="indefinite" />}</circle>)}
        </g>
      )}
    </svg>
  );
}
