// "Where do you post?": the affiliate's channels (TikTok / YouTube / Instagram / Other + handle), before "Get my code"
// and later on the page. At least one is required; up to 6. Cleaning and profile links: _shared/affiliate/rules.js.
import { useState } from "react";
import { ExternalLink, Globe, Pencil, Plus, X } from "lucide-react";
import { BrandLogo } from "../../../components/onboarding/brandLogos.jsx";
import { HANDLE_PLATFORMS, PLATFORM_LABEL, normalizeHandle, profileUrl } from "../../../../supabase/functions/_shared/affiliate/rules.js";
import { CARD, LABEL, emptyRow, validHandles } from "./ui.js";

const MAX_ROWS = 6;

function PlatformIcon({ platform, className = "" }) {
  if (platform === "other") return <Globe className={`h-4 w-4 ${className}`} aria-hidden="true" />;
  return <span className={className}><BrandLogo brand={platform} /></span>;
}

export function HandlesEditor({ rows, onChange }) {
  const set = (i, patch) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2.5" data-testid="handles-editor">
      {rows.map((row, i) => {
        const bad = row.handle.trim() && !normalizeHandle(row.platform, row.handle);
        return (
          <div key={i} className="relative rounded-2xl border border-white/10 bg-black/20 p-2.5">
            {rows.length > 1 && (
              <button type="button" aria-label="Remove this channel" onClick={() => onChange(rows.filter((_, k) => k !== i))}
                className="absolute -right-2 -top-2 z-[1] grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-[#161816] text-white/55 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            )}
            {/* 4 equal columns, icon over a small label: fits a 320 px phone */}
            <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`Channel ${i + 1}: platform`}>
              {HANDLE_PLATFORMS.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={row.platform === p} onClick={() => set(i, { platform: p })} data-testid={`handle-${i}-${p}`}
                  className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-bold transition ${row.platform === p ? "border-lime-300/70 bg-lime-300/[0.1] text-white" : "border-white/10 text-white/55 hover:border-white/20"}`}>
                  <PlatformIcon platform={p} className="scale-[0.85]" /><span className="max-w-full truncate">{PLATFORM_LABEL[p]}</span>
                </button>
              ))}
            </div>
            <div className={`mt-2 flex items-center rounded-xl border bg-white/[0.04] ${bad ? "border-amber-300/60" : "border-white/10 focus-within:border-lime-300/60"}`}>
              {row.platform !== "other" && <span className="pl-3.5 text-[15px] font-bold text-white/40" aria-hidden="true">@</span>}
              <input value={row.handle} onChange={(e) => set(i, { handle: e.target.value })} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={200}
                aria-label={`Your ${PLATFORM_LABEL[row.platform]} ${row.platform === "other" ? "link or name" : "username"}`} data-testid={`handle-${i}-input`}
                placeholder={row.platform === "other" ? "Link to your page, or its name" : "yourname"}
                className={`h-11 min-w-0 flex-1 bg-transparent pr-3.5 text-[15px] font-semibold text-white outline-none placeholder:text-white/30 ${row.platform === "other" ? "pl-3.5" : "pl-1"}`} />
            </div>
            {bad && <p className="mt-1.5 text-[12px] text-amber-200">{row.platform === "other" ? "Use a link (https://…) or a short name." : "Letters, numbers, dots, _ and - only (or paste your profile link)."}</p>}
          </div>
        );
      })}
      {rows.length < MAX_ROWS && (
        <button type="button" onClick={() => onChange([...rows, emptyRow()])} data-testid="handles-add"
          className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-lime-300/90 hover:text-lime-200">
          <Plus className="h-4 w-4" aria-hidden="true" />Add another channel
        </button>
      )}
    </div>
  );
}

/** Each channel as a link to its profile (plain text for an "Other" name without a link). */
export function ChannelLinks({ handles, small = false }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${small ? "text-[11.5px]" : "text-[13.5px]"}`}>
      {(handles ?? []).map((h) => {
        const url = profileUrl(h);
        const label = h.platform === "other" ? h.handle.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40) : `@${h.handle}`;
        const body = <><PlatformIcon platform={h.platform} className={small ? "scale-[0.65]" : "scale-[0.8]"} />{label}{url && <ExternalLink className="h-3 w-3 opacity-50" aria-hidden="true" />}</>;
        const cls = `inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] ${small ? "px-2 py-0.5" : "px-2.5 py-1"} font-semibold text-white/80`;
        return <li key={`${h.platform}-${h.handle}`}>{url ? <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={`${cls} hover:border-white/25 hover:text-white`}>{body}</a> : <span className={cls}>{body}</span>}</li>;
      })}
    </ul>
  );
}

/** "Where you post" on the joined page: the links, and Edit. */
export function ChannelsCard({ handles, onSave }) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(handles?.length ? handles : [emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const valid = validHandles(rows);
  const save = async () => {
    setBusy(true); setProblem(null);
    const p = await onSave(valid);
    if (p) setProblem(p); else setEditing(false);
    setBusy(false);
  };
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="Where you post">
      <div className="flex items-center justify-between gap-2">
        <p className={LABEL}>Where you post</p>
        {!editing && (
          <button type="button" onClick={() => { setRows(handles?.length ? handles : [emptyRow()]); setEditing(true); }} data-testid="handles-edit"
            className="flex items-center gap-1 text-[12.5px] font-semibold text-white/55 hover:text-white"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button>
        )}
      </div>
      {editing ? (
        <div className="mt-3">
          <HandlesEditor rows={rows} onChange={setRows} />
          {problem && <p className="mt-2 text-[13px] text-amber-200" role="alert">{problem}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={save} disabled={busy || !valid.length} className="min-h-[46px] flex-1 rounded-xl bg-lime-300 text-[14.5px] font-black text-[#11150D] disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(false)} className="min-h-[46px] rounded-xl border border-white/15 px-4 text-[14.5px] font-semibold text-white/75">Cancel</button>
          </div>
        </div>
      ) : handles?.length ? (
        <div className="mt-2.5"><ChannelLinks handles={handles} /></div>
      ) : (
        <p className="mt-2 text-[13px] text-white/50">Add where you post, so we know where your viewers come from.</p>
      )}
    </section>
  );
}
