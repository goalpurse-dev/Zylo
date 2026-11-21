import { Youtube } from "lucide-react";
import { LiteYouTube } from "../../pages/landing/TownTutorials.jsx";
import { getTutorial } from "../../data/inThisTownLanding.js";
import { DISPLAY } from "./studioKitShared";

/**
 * A template's video tutorial on the MCP pages (owner 2026-11-21): the owner's YouTube video, the same tap-to-play
 * "lite" player as the In This Town page (nothing loads from YouTube until it's tapped). `id` = a TOWN_TUTORIALS id.
 */
export default function TemplateVideo({ id, slug, heading = "Watch the tutorial", headingClass, className = "" }) {
  const video = getTutorial(id);
  if (!video) return null;
  return (
    <section className={className} aria-labelledby={`tv-${id}`}>
      <h3 id={`tv-${id}`} style={DISPLAY} className={headingClass}>{heading}</h3>
      <p className="mt-1.5 text-[13.5px] text-white/65">{video.label} · {video.length}</p>
      <div className="mt-3 max-w-[720px]"><LiteYouTube video={video} slug={slug} /></div>
      <a href={video.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-lime-200 hover:underline">
        <Youtube className="h-4 w-4" aria-hidden="true" />Watch on YouTube
      </a>
    </section>
  );
}
