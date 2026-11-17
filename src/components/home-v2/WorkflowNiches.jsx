import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import ToolLink from "../seo/ToolLink.jsx";
import { LazyLoopVideo } from "./HomeV2Sections.jsx";
import { trackLaunch } from "../launch/launch";
import { BLOCKY_WORLDS_NAME, BLOCKY_WORLDS_PATH, showBlockyWorlds } from "../../data/blockyWorlds";
import useBlockyWorldsAccess from "../viral-tools/blocky-worlds/api/blockyWorldsAccess";
import { CUTAWAY_NAME, CUTAWAY_PATH } from "../../data/cutawayExplainer";
import "./workflowNiches.css";

// Home: "Workflows for viral niches". From a hub at the top, lines branch down to template cards and a Zyvo-green pulse
// runs down each line in turn, the card lighting up as it arrives. The lines are drawn from where the cards really are
// (measured, redrawn on resize): desktop 3 a row with curved branches, tablet 2 a row, phones one rail down the left.
// Every preview is a real Zyvo-made video (our renders; the owner's videos in the showcase bucket, community/).
// No view counts. Reduced motion: the lines stay, nothing moves. Videos: poster first, file only on screen.

const COMMUNITY = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/showcase/community`;
const community = (file) => ({ video: `${COMMUNITY}/${file}.mp4`, poster: `${COMMUNITY}/${file}.webp` });

const TOWN = { id: "in-this-town", name: BLOCKY_WORLDS_NAME, path: BLOCKY_WORLDS_PATH, pitch: "One strange town rule becomes a narrated story, built in real 3D.", video: "/in-this-town/clips/milo-a.mp4", poster: "/in-this-town/clips/milo-a.webp" };
const OTHERS = [
  { id: "cutaway", name: CUTAWAY_NAME, path: CUTAWAY_PATH, pitch: "3D cutaways that show how everyday things work.", ...community("cutaway-explainer-1") },
  { id: "ai-fruit-story", name: "AI Fruit Story", path: "/workspace/ai-fruit-story", pitch: "Talking-fruit drama series with the same cast every episode.", ...community("ai-fruit-story-1") },
  { id: "cartoon-drive-by", name: "Cartoon Drive By", path: "/workspace/cartoon-drive-by", pitch: "Drive past cartoon worlds as if they were real.", ...community("cartoon-drive-by-1") },
  { id: "behind-the-scenes", name: "Behind the Scenes", path: "/workspace/behind-the-scenes", pitch: "Miniature cities wrecked with practical-FX looks.", ...community("behind-the-scenes-1") },
  { id: "clay-rescue", name: "Clay Rescue", path: "/workspace/clay-rescue", pitch: "Giant hands rescue tiny clay worlds.", ...community("clay-rescue-1") },
];

const CYCLE = 4.2; // s: one round of pulses (workflowNiches.css keyframes use the same)
const STEP = 0.55; // s between two cards' pulses
const RAIL_X = 14; // px: the phone rail's x

/** the lines and each card's pulse delay, from the cards' real boxes */
function layout(wrap) {
  const box = wrap.getBoundingClientRect();
  const cards = [...wrap.querySelectorAll("[data-wf-card]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { el, x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
  });
  if (!cards.length) return null;
  const phone = window.matchMedia("(max-width: 639px)").matches;
  const lines = [];
  if (phone) {
    const node = (c) => c.y + Math.min(40, c.h / 2);
    const end = node(cards[cards.length - 1]);
    lines.push({ d: `M ${RAIL_X} 0 V ${end}`, delay: 0, rail: true });
    cards.forEach((c) => {
      // the rail's pulse passes this card's node at `pass`; its tick then runs ~0.5 s (12% of the cycle) to the card,
      // and the card's glow (peak at 36% of its cycle) is timed to that arrival
      const pass = (node(c) / end) * CYCLE * 0.35;
      lines.push({ d: `M ${RAIL_X} ${node(c)} H ${c.x}`, delay: pass, tick: true });
      c.delay = pass + CYCLE * 0.12 - CYCLE * 0.36;
    });
  } else {
    const hub = { x: box.width / 2, y: 0 };
    const top = Math.min(...cards.map((c) => c.y));
    cards.forEach((c, i) => {
      const cx = c.x + c.w / 2;
      c.delay = i * STEP;
      if (Math.abs(c.y - top) < 4) {
        // first row: a curve from the hub down to the card's top
        const mid = c.y * 0.55;
        lines.push({ d: `M ${hub.x} ${hub.y} C ${hub.x} ${mid}, ${cx} ${c.y - mid}, ${cx} ${c.y}`, delay: c.delay });
      } else {
        // later rows: straight down from the card above
        const above = cards.filter((o) => o.y < c.y - 4 && Math.abs(o.x + o.w / 2 - cx) < 6).at(-1);
        if (above) lines.push({ d: `M ${cx} ${above.y + above.h} V ${c.y}`, delay: c.delay });
      }
    });
  }
  cards.forEach((c) => c.el.style.setProperty("--wf-d", `${c.delay.toFixed(2)}s`));
  return { w: box.width, h: box.height, lines, phone };
}

export default function WorkflowNiches() {
  const townVisible = showBlockyWorlds(useBlockyWorldsAccess());
  const cards = townVisible ? [TOWN, ...OTHERS] : OTHERS;
  const wrap = useRef(null);
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    if (!wrap.current) return undefined;
    let raf = 0;
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setGeo(layout(wrap.current))); };
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(wrap.current);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [cards.length]);

  return (
    <section className="wf" aria-labelledby="wf-title" data-testid="home-workflows">
      <div className="wf-head">
        <p className="wf-kicker">Workflows</p>
        <h2 id="wf-title">Workflows for viral niches</h2>
        <p className="wf-sub">Zyvo builds the whole workflow for each niche, so you make videos people actually watch, without editing skills.</p>
      </div>
      <div className="wf-tree" ref={wrap}>
        <span className="wf-hub" aria-hidden="true" />
        {geo && (
          <svg className="wf-lines" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
            {geo.lines.map((l, i) => <path key={`b${i}`} d={l.d} className="wf-line" />)}
            {geo.lines.map((l, i) => (
              <path key={`p${i}`} d={l.d} pathLength="100" className={`wf-pulse ${l.rail ? "is-rail" : ""} ${l.tick ? "is-tick" : ""}`} style={{ animationDelay: `${l.delay.toFixed(2)}s` }} />
            ))}
          </svg>
        )}
        <ul className="wf-grid">
          {cards.map((c) => (
            <li key={c.id} className="wf-card" data-wf-card>
              <ToolLink to={c.path} className="wf-card-link" onClick={() => trackLaunch("workflow_card", { placement: "home_workflows", target: c.path })} aria-label={`Make a ${c.name} video`}>
                <LazyLoopVideo src={c.video} poster={c.poster} className="wf-media" />
                <span className="wf-body">
                  <strong>{c.name}</strong>
                  <span className="wf-pitch">{c.pitch}</span>
                  <span className="wf-cta">Make a video <ArrowRight size={15} aria-hidden="true" /></span>
                </span>
              </ToolLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
