import { useState } from "react";
import { ArrowUpRight, Play, X } from "lucide-react";
import { Link } from "react-router-dom";
import { BLOCKY_WORLDS_PATH } from "../../data/blockyWorlds";
import useBlockyWorldsAccess from "../viral-tools/blocky-worlds/api/blockyWorldsAccess";
import "./inThisTownLaunch.css";

const scenes = [
  { id: "tower", title: "The Tower" },
  { id: "milo", title: "Milo" },
  { id: "plane", title: "The Plane" },
];

export default function InThisTownLaunch() {
  const access = useBlockyWorldsAccess();
  const [playing, setPlaying] = useState(null);
  if (access !== "allowed") return null;

  return (
    <section className="town-launch" aria-labelledby="town-launch-title">
      <div className="town-launch-copy">
        <p className="town-launch-new"><span aria-hidden="true" /> JUST DROPPED</p>
        <h2 id="town-launch-title">In This Town<br /><em>videos.</em></h2>
        <p className="town-launch-description">Invent one strange rule for a town. Turn it into a narrated, blocky short with a twist.</p>
        <Link className="town-launch-cta" to={BLOCKY_WORLDS_PATH}>Make my town video <ArrowUpRight size={18} aria-hidden="true" /></Link>
      </div>
      <div className="town-launch-scenes" aria-label="Story previews">
        {scenes.map(({ id, title }) => {
          const active = playing === id;
          const base = `/blocky-worlds/showcase/${id}`;
          return (
            <button key={id} type="button" className={`town-film town-film-${id}`} aria-pressed={active}
              aria-label={`${active ? "Stop" : "Play"} ${title} preview`} onClick={() => setPlaying(active ? null : id)}>
              <img src={`${base}.jpg`} alt="" loading="lazy" decoding="async" />
              {active && <video src={`${base}.mp4`} poster={`${base}.jpg`} autoPlay muted playsInline onEnded={() => setPlaying(null)} onError={() => setPlaying(null)} />}
              <span className="town-film-caption"><strong>{title}</strong><span>{active ? <X size={15} /> : <Play size={13} fill="currentColor" />}</span></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
