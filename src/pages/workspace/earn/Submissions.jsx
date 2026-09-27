import { FileVideo, Instagram, Music2, Youtube } from "lucide-react";
import { StatusBadge } from "./shared";
import { fmtNumber } from "./utils";
import { BG, BORDER, CARD, TEXT } from "./tokens";
import { MOCK_SUBMISSIONS } from "./data";

const PLATFORM_ICON = { instagram: Instagram, youtube: Youtube, tiktok: Music2 };

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EmptySubmissions() {
  return (
    <div className={`flex flex-col items-center rounded-[13px] border border-dashed ${BORDER.subtle} ${BG.surface} px-6 py-14 text-center`}>
      <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-[11px] border ${BORDER.subtle} ${BG.elevated} ${TEXT.tertiary}`}>
        <FileVideo className="h-5 w-5" />
      </span>
      <p className={`text-[15px] font-semibold ${TEXT.primary}`}>No submissions yet</p>
      <p className={`mt-1.5 max-w-sm text-[13px] leading-relaxed ${TEXT.secondary}`}>
        Post content with your tracking link, then submit it here to get views verified and start earning credits.
      </p>
      <button className="mt-5 rounded-[9px] bg-lime-400 px-4 py-2.5 text-[13px] font-semibold text-[#0a1006] transition hover:bg-lime-300">
        Submit your first post
      </button>
    </div>
  );
}

export function SubmissionsTab() {
  if (!MOCK_SUBMISSIONS.length) return <EmptySubmissions />;

  return (
    <div className={`overflow-hidden ${CARD}`}>
      <div className={`hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 border-b ${BORDER.subtle} ${BG.elevated} px-4 py-2.5 lg:grid`}>
        {["Post", "Posted", "Views", "Verified views", "Credits", "Status"].map((h) => (
          <span key={h} className={`text-[10px] font-semibold uppercase tracking-wider ${TEXT.tertiary}`}>{h}</span>
        ))}
      </div>

      <div className="divide-y divide-[rgba(255,255,255,0.06)]">
        {MOCK_SUBMISSIONS.map((s) => {
          const Icon = PLATFORM_ICON[s.platform] ?? FileVideo;
          return (
            <div key={s.id} className="grid grid-cols-2 gap-3 px-4 py-3.5 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] lg:items-center lg:gap-4">
              <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
                <span className={`flex h-10 w-[62px] shrink-0 items-center justify-center rounded-[9px] border ${BORDER.subtle} ${BG.elevated} ${TEXT.disabled}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`text-[12.5px] font-semibold capitalize ${TEXT.secondary}`}>{s.platform}</span>
              </div>

              <div className={`lg:hidden text-[11px] ${TEXT.tertiary}`}>Posted</div>
              <span className={`text-[13px] ${TEXT.secondary}`}>{fmtDate(s.postedAt)}</span>

              <div className={`lg:hidden text-[11px] ${TEXT.tertiary}`}>Views</div>
              <span className={`text-[13px] font-semibold tabular-nums ${TEXT.secondary}`}>{fmtNumber(s.views)}</span>

              <div className={`lg:hidden text-[11px] ${TEXT.tertiary}`}>Verified views</div>
              <span className={`text-[13px] font-semibold tabular-nums ${TEXT.secondary}`}>
                {s.verifiedViews != null ? fmtNumber(s.verifiedViews) : "—"}
              </span>

              <div className={`lg:hidden text-[11px] ${TEXT.tertiary}`}>Credits</div>
              <span className={`text-[13px] font-semibold tabular-nums ${TEXT.primary}`}>
                {s.credits > 0 ? `+${fmtNumber(s.credits)}` : "—"}
              </span>

              <div>
                <StatusBadge status={s.status} reason={s.reason} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
