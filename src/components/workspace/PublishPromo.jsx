import { useNavigate } from "react-router-dom";
import postBg from "../../assets/post169.png";
import viewBg from "../../assets/view169.png";

/**
 * Matches the ModelCard pattern from LatestModels.jsx ("Trending AI
 * Models"): image on top (badge overlaid top-left), plain text panel below
 * with a gradient title + description — instead of text overlaid directly
 * on the image. `compact` drops the description for the smallest, 2-up row.
 */
function PromoCard({ imageSrc, imageAlt, title, description, compact, onClick }) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-[#090A0A] transition hover:scale-[1.02] hover:border-purple-500/30"
    >
      {/* Only `sm` stacks these full-width — strict 16:9 at that width
          makes them huge, so use a shorter/wider ratio there and go back to
          full 16:9 once `md`'s 2-column layout narrows them. */}
      <div className={`relative overflow-hidden ${compact ? "aspect-[16/9]" : "aspect-[2/1] md:aspect-[16/9]"}`}>
        <img
          src={imageSrc}
          alt={imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/60 text-purple-300 border border-white/10 backdrop-blur">
          NEW
        </div>
      </div>
      <div className={compact ? "p-2" : "p-3 md:p-4"}>
        <div
          className={`${compact ? "text-[13px]" : "text-[16px] md:text-[20px]"} font-bold leading-tight bg-gradient-to-r from-white via-purple-100 to-purple-500 bg-clip-text text-transparent inline-block`}
        >
          {title}
        </div>
        {!compact && (
          <div className="text-white/40 text-xs mt-1">{description}</div>
        )}
      </div>
    </div>
  );
}

export default function PublishPromo() {
  const navigate = useNavigate();
  const open = () => navigate("/workspace/publish");

  return (
    <section className="w-full px-5 md:px-[50px] mt-10">
      <div className="flex items-center justify-between mb-3 sm:mb-5">
        <div>
          <h2 className="text-white text-[16px] sm:text-[20px] md:text-[26px] font-bold tracking-tight">
            Publish
          </h2>
          <p className="mt-0.5 text-white/40 text-[11px] sm:text-[13px]">
            Schedule, post & grow — powered by Zyvo AI
          </p>
        </div>
        <button
          onClick={open}
          className="text-white/50 hover:text-white text-sm font-semibold transition-colors"
        >
          Open →
        </button>
      </div>

      {/* Below `sm`: compact, equal-width row, no description */}
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        <PromoCard
          onClick={open}
          imageSrc={postBg}
          imageAlt="Scheduling queue for Instagram, TikTok & YouTube posts"
          title="Post Everywhere"
          compact
        />
        <PromoCard
          onClick={open}
          imageSrc={viewBg}
          imageAlt="Analytics dashboard showing views, likes and engagement"
          title="Track Stats"
          compact
        />
      </div>

      {/* `sm` only: two full-width stacked rows. `md` and up: side-by-side —
          the stack should be a brief in-between state, not last all the
          way to `lg`. */}
      <div className="hidden sm:grid sm:grid-cols-1 sm:gap-4 md:grid-cols-2 md:gap-5">
        <PromoCard
          onClick={open}
          imageSrc={postBg}
          imageAlt="Scheduling queue for Instagram, TikTok & YouTube posts"
          title="Post everywhere, on autopilot"
          description="Queue once — Zyvo posts it to Instagram, TikTok & YouTube for you."
        />
        <PromoCard
          onClick={open}
          imageSrc={viewBg}
          imageAlt="Analytics dashboard showing views, likes and engagement"
          title="Track stats & grow smarter"
          description="Track every view, then let Zyvo AI tell you what to fix next."
        />
      </div>
    </section>
  );
}
