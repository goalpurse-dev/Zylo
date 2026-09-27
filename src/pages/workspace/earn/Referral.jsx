import { useEffect, useState } from "react";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { Skeleton } from "./shared";
import { fmtEur, fmtNumber } from "./utils";
import { BG, BORDER, CARD, SECTION_LABEL, TEXT } from "./tokens";
import { MOCK_REFERRAL_STATS, SOCIAL_CAPTIONS } from "./data";

function CopyButton({ text, label = "Copy", copiedLabel = "Copied" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable — user can still select/copy the text manually.
    }
  };
  return (
    <button
      onClick={copy}
      className="flex shrink-0 items-center gap-1.5 rounded-[8px] bg-lime-400/15 px-3 py-1.5 text-xs font-semibold text-lime-300 transition hover:bg-lime-400/25"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

function ReferralStatsRow() {
  const s = MOCK_REFERRAL_STATS;
  const items = [
    { label: "Clicks", value: fmtNumber(s.clicks) },
    { label: "Signups", value: fmtNumber(s.signups) },
    { label: "Converted", value: fmtNumber(s.converted) },
    { label: "Earnings", value: fmtEur(s.earningsEur) },
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className={`rounded-[10px] border ${BORDER.subtle} ${BG.elevated} px-3 py-2.5`}>
          <p className={`text-[15px] font-semibold tabular-nums ${TEXT.primary}`}>{it.value}</p>
          <p className={`text-[11px] ${TEXT.tertiary}`}>{it.label}</p>
        </div>
      ))}
    </div>
  );
}

export function ReferralCard({ title = "Your referral link", link, loading, error, showStats = false }) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState(null);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  useEffect(() => {
    if (!qrOpen || !link || qrSrc) return;
    let cancelled = false;
    QRCode.toDataURL(link, { margin: 1, width: 176, color: { dark: "#111318", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setQrSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [qrOpen, link, qrSrc]);

  const shareLink = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: "Zyvo", text: "Create with Zyvo — try it free:", url: link });
    } catch {
      // Share sheet dismissed or unsupported — no-op.
    }
  };

  return (
    <div id="referral" className={`${CARD} p-5 sm:p-6`}>
      <p className={SECTION_LABEL}>{title}</p>

      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : error ? (
          <p className="rounded-[10px] border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 text-sm text-red-300">{error}</p>
        ) : (
          <div className={`flex items-center gap-2 rounded-[10px] border ${BORDER.subtle} ${BG.elevated} px-3 py-2.5`}>
            <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${TEXT.primary}`}>{link}</span>
            <CopyButton text={link} />
          </div>
        )}
      </div>

      {!loading && !error && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {canShare && (
            <button
              onClick={shareLink}
              className={`flex items-center gap-1.5 rounded-[8px] border ${BORDER.subtle} ${BG.elevated} px-3 py-1.5 text-xs font-semibold ${TEXT.secondary} transition hover:border-[rgba(255,255,255,0.12)] hover:text-[#f7f8f8]`}
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          )}
          <button
            onClick={() => setQrOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-[8px] border ${BORDER.subtle} ${BG.elevated} px-3 py-1.5 text-xs font-semibold ${TEXT.secondary} transition hover:border-[rgba(255,255,255,0.12)] hover:text-[#f7f8f8]`}
          >
            <QrCode className="h-3.5 w-3.5" /> {qrOpen ? "Hide QR" : "Show QR"}
          </button>
        </div>
      )}

      {qrOpen && (
        <div className={`mt-3 flex items-center gap-3 rounded-[10px] border ${BORDER.subtle} ${BG.elevated} p-3`}>
          {qrSrc ? (
            <img src={qrSrc} alt="Referral link QR code" className="h-[88px] w-[88px] rounded-[6px] bg-white p-1.5" />
          ) : (
            <Skeleton className="h-[88px] w-[88px]" />
          )}
          <p className={`text-[11.5px] leading-relaxed ${TEXT.tertiary}`}>Scan to open your referral link on another device.</p>
        </div>
      )}

      {!loading && !error && (
        <div className={`mt-4 border-t ${BORDER.subtle} pt-3.5`}>
          <p className={`text-[11.5px] font-semibold ${TEXT.tertiary}`}>Ready-to-post captions</p>
          <div className="mt-2 space-y-1.5">
            {SOCIAL_CAPTIONS.map((caption) => (
              <div key={caption} className={`flex items-center gap-2 rounded-[10px] border ${BORDER.subtle} ${BG.surface} px-3 py-2`}>
                <span className={`min-w-0 flex-1 truncate text-[12.5px] ${TEXT.secondary}`}>{caption}</span>
                <CopyButton text={`${caption} ${link}`} label="Copy" copiedLabel="Copied" />
              </div>
            ))}
          </div>
        </div>
      )}

      {showStats && <ReferralStatsRow />}

      <p className={`mt-4 text-xs ${TEXT.tertiary}`}>
        Share your link. Referrals and commission tracking will appear here as the program expands.
      </p>
    </div>
  );
}
