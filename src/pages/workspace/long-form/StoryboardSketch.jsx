import { SHOTS, TYPES } from "./storyboardModel";
import { getStylePreset, parseVersionedId } from "./stylePresets";

// Zero-cost, schematic Director sketches — the theme below only ever shifts
// palette/stroke/paper treatment (Style Picker milestone Part 12/13), never
// the shape language itself. Defaults exactly match the sketch's original
// hardcoded colors (Classic 2D Documentary), so a caller that doesn't pass
// a theme sees byte-identical output to before this was made style-aware.
const DEFAULT_THEME = { paper: "#e7e7d6", structureFill: "#dce0ca", structureStroke: "#8a9980", strokeWidth: 3, person: "#526a60", personStroke: "#344e43", device: "#455f54", accent: "#a38745" };

function Person({x=0,y=0,scale=1,seated=false,theme=DEFAULT_THEME}) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill={theme.person} stroke={theme.personStroke} strokeWidth="2"><circle cx="0" cy="-63" r="13"/><path d="M-18-42 Q0-50 18-42 L24 1 L-22 1Z"/><path d={seated?"M-15 0 L-14 23 L22 23 M13 0 L14 12 L38 12":"M-13 0 L-16 45 M12 0 L17 45"} fill="none" strokeWidth="10" strokeLinecap="round"/><path d="M-17-35 L-32-8 M16-35 L33-16" fill="none" strokeWidth="8" strokeLinecap="round"/></g>;
}
function Tablet({x=0,y=0,scale=1,theme=DEFAULT_THEME}) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><rect width="98" height="68" rx="7" fill={theme.device}/><rect x="6" y="6" width="86" height="52" rx="3" fill="#dfe8cf"/>{[20,49,78].map((cx,i)=><g key={cx}><circle cx={cx} cy="24" r="8" fill="none" stroke={i===1?theme.accent:theme.structureStroke} strokeWidth="3"/><path d={`M${cx-7} 42 h14`} stroke="#7c8e75" strokeWidth="3"/></g>)}<circle cx="49" cy="63" r="2" fill="#bfc9ab"/></g>;
}
function Plant({x,y}) { return <g transform={`translate(${x} ${y})`} stroke="#61795b" strokeWidth="3" fill="#a0b48d"><path d="M0 20 V-16"/><path d="M0 0 Q-22-22-27-4 Q-18 8 0 0 M0-9 Q20-28 24-10 Q13 0 0-9"/><path d="M-16 18 h32 l-4 15 h-24Z" fill="#b9a485" stroke="#8a8069"/></g>; }
export default function StoryboardSketch({beat,compact=false,visualStylePreset}) {
  const theme = visualStylePreset ? getStylePreset(parseVersionedId(visualStylePreset).id)?.sketchTheme ?? DEFAULT_THEME : DEFAULT_THEME;
  const text=`${beat.informationToCommunicate??""} ${beat.locationId??""}`.toLowerCase();
  const type=beat.visualType, shot=beat.shotSize;
  const diagram=type==="DIAGRAM"||type==="CUTAWAY", map=type==="MAP", comparison=type==="COMPARISON", graphic=type==="PROGRAMMATIC_GRAPHIC"||type==="TIMELINE";
  const detail=type==="OBJECT_DETAIL"||shot==="DETAIL"||shot==="INSERT";
  const environment=(beat.sketchContext?.environment??text).toLowerCase();
  const plants=/greenhouse|plant|crop|rack|irrigation/.test(environment), bunk=/bunk|wakes?|waking|sleep|alarm/.test(environment), window=/window|horizon|outside|habitat|mars|bunk/.test(environment);
  const device=/tablet|screen|checklist|display|readout|log|diagnostic|forecast|power/.test(text);
  const reuse=["REUSE","EDIT","CROP"].includes(beat.renderMethod);
  const focusTarget=/outside|window|horizon|solar arrays/.test(text)?[451,145]:/bunk|waking|alarm|lighting/.test(text)?[180,212]:/plant|crop|greenhouse|rack/.test(text)?[173,168]:device?[467,267]:[293,211];
  const step=(beat.visualChange?.step??1)-1;
  const key=beat.sketchContext?.key??beat.baseSetupKey??beat.sequenceId??beat.id??"";
  const mirror=[...key].reduce((n,c)=>n+c.charCodeAt(0),0)%2===0;
  const label=`Storyboard sketch: ${SHOTS[shot]??"Planned shot"}, ${TYPES[type]??"Scene"}`;
  return <svg viewBox="0 0 640 360" role="img" aria-label={label} className="aspect-video h-auto w-full">
    <rect width="640" height="360" fill={theme.paper}/><path d="M0 292H640 M40 0V360 M600 0V360" stroke={theme.structureStroke} strokeOpacity=".35" strokeWidth="1"/>
    <path d="M20 42V20H42 M598 20H620V42 M20 318V340H42 M598 340H620V318" fill="none" stroke={theme.structureStroke} strokeWidth="2"/>
    {comparison ? <g><path d="M320 60V304" stroke={theme.structureStroke} strokeDasharray="6 6"/>{[0,320].map((offset,i)=><g key={offset} transform={`translate(${offset} 0)`}><rect x="68" y="110" width="182" height="134" rx="9" fill={theme.structureFill} stroke={theme.structureStroke}/><path d={`M100 207v-${i?65:35} m40 ${i?65:35}v-${i?40:75} m40 ${i?40:75}v-${i?80:45}`} stroke={theme.structureStroke} strokeWidth="20"/><text x="160" y="280" textAnchor="middle" fill={theme.personStroke} fontSize="16">{i?"B":"A"}</text></g>)}</g>
    : diagram ? <g stroke={theme.structureStroke} strokeWidth="3" fill={theme.structureFill}><path d="M155 180H285 M355 180H485 M320 205V275H155V210" fill="none" strokeDasharray={reuse?"7 4":undefined}/><path d="m274 171 12 9-12 9 m200-18 12 9-12 9 m-340 37 9-12 9 12" fill="none"/>{[130,320,510].map((x,i)=><g key={x}><rect x={x-48} y="135" width="96" height="82" rx={i===1?40:12}/><circle cx={x} cy="174" r={i===1?16:10} fill={theme.accent}/>{i!==1&&<path d={`M${x-20} 196h40`} strokeWidth="2"/>}</g>)}<path d="M85 80H220 M250 80H390 M420 80H555" stroke={theme.accent} strokeWidth="9"/><text x="320" y="316" textAnchor="middle" fontSize="14" stroke="none" fill={theme.personStroke}>Conceptual flow · reveal in order</text></g>
    : map ? <g stroke={theme.structureStroke} strokeWidth="2"><path d="M120 90 245 65 320 111 439 74 535 146 504 249 390 282 302 250 173 290 83 193Z" fill={theme.structureFill}/><path d="M144 202Q263 96 330 196T481 158" stroke={theme.accent} strokeDasharray="7 6" fill="none" strokeWidth="4"/>{[[144,202],[330,196],[481,158]].map(([x,y])=><g key={x}><circle cx={x} cy={y} r="11" fill={theme.accent}/><circle cx={x} cy={y} r="4" fill={theme.paper}/></g>)}<text x="320" y="321" textAnchor="middle" fill={theme.personStroke} stroke="none" fontSize="14">Spatial relationship · schematic</text></g>
    : graphic ? <g><rect x="89" y="77" width="462" height="222" rx="14" fill={theme.structureFill} stroke={theme.structureStroke} strokeWidth="2"/><path d="M117 108H297" stroke={theme.structureStroke} strokeWidth="10"/>{[0,1,2].map(i=><g key={i} transform={`translate(${118+i*143} 138)`}><rect width="119" height="131" rx="9" fill={i===step%3?theme.accent:theme.paper} stroke={theme.structureStroke}/><circle cx="59" cy="41" r="21" fill="none" stroke={theme.structureStroke} strokeWidth="7"/><path d="M22 85H95 M22 103H77" stroke={theme.structureStroke} strokeWidth="7"/></g>)}</g>
    : detail ? <g>{device?<Tablet x={130} y={100} scale={3.8} theme={theme}/>:plants?<g transform="translate(320 170) scale(3.5)"><Plant x={0} y={0}/></g>:<g transform="translate(320 185)" stroke={theme.structureStroke} strokeWidth="5" fill={theme.structureFill}><circle r="84"/><circle r="51" fill={theme.paper}/><path d="M-112-18H-74 M74-18H112 M-112 18H-74 M74 18H112 M-18-110V-76 M18-110V-76 M-18 76V110 M18 76V110"/><path d="M-30-22H30 M-30 0H30 M-30 22H30" strokeWidth="3"/></g>}<path d="M72 81H103V112 M537 249V280H568" stroke={theme.structureStroke} strokeWidth="2" fill="none"/></g>
    : <g>
      <g transform={mirror?"translate(640 0) scale(-1 1)":undefined}>
        <path d="M45 292V69Q320 11 595 69V292 M45 292 190 240H450L595 292" fill={theme.structureFill} stroke={theme.structureStroke} strokeWidth={theme.strokeWidth ?? 2}/>
        {window&&<g><rect x="358" y="84" width="182" height="122" rx="15" fill={theme.accent} fillOpacity=".55" stroke={theme.structureStroke} strokeWidth="7"/><path d="M363 171Q408 134 446 155T536 140V200H363Z" fill={theme.accent}/><path d="M452 87V204" stroke={theme.structureStroke} strokeWidth="4"/></g>}
        {plants?<g><path d="M78 160H289 M78 241H289" stroke={theme.structureStroke} strokeWidth="8"/>{[108,174,240].map(x=><g key={x}><Plant x={x} y={116}/><Plant x={x} y={197}/></g>)}</g>:bunk?<g><path d="M89 219H320V268H89Z" fill={theme.structureFill} stroke={theme.structureStroke} strokeWidth="3"/><rect x="94" y="197" width="88" height="28" rx="12" fill={theme.paper}/><path d="M94 273V298 M313 273V298" stroke={theme.structureStroke} strokeWidth="6"/></g>:<g><path d="M72 217H294V231H72Z M84 231V285 M281 231V285" fill={theme.structureFill} stroke={theme.structureStroke} strokeWidth="3"/><path d="M94 111H273V187H94Z" fill={theme.paper} stroke={theme.structureStroke}/><path d="M114 140H254 M114 159H230" stroke={theme.structureStroke} strokeWidth="5"/></g>}
        {(beat.sketchContext?.characterCount ?? 1)>0 && <Person x={shot==="CLOSE"?250:shot==="MEDIUM"?260:295} y={shot==="CLOSE"?366:shot==="MEDIUM"?275:266} scale={shot==="CLOSE"?3:shot==="MEDIUM"?1.55:.95} seated={bunk} theme={theme}/>}
        {device&&<Tablet x={423} y={239} scale={.9} theme={theme}/>}
      </g>
      {reuse&&<g transform={mirror?"translate(640 0) scale(-1 1)":undefined} stroke={theme.accent} strokeWidth="3" fill="none"><circle cx={focusTarget[0]} cy={focusTarget[1]} r="36" strokeDasharray="5 5"/><path d={`M${focusTarget[0]-72} ${focusTarget[1]}h34 m-8-8 8 8-8 8`}/></g>}
    </g>}
    {!compact&&<g><rect x="25" y="24" width="174" height="23" rx="4" fill={theme.paper} opacity=".9"/><text x="35" y="40" fontFamily="sans-serif" fontWeight="700" fontSize="11" letterSpacing="1" fill={theme.personStroke}>{(SHOTS[shot]??"Planned shot").toUpperCase()} · SKETCH</text>{beat.motionSuggestion&&<g stroke={theme.structureStroke} strokeWidth="2" fill="none"><path d="M473 323H557 M547 316 558 323 547 330"/></g>}</g>}
  </svg>;
}

