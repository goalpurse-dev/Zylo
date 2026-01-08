import React from "react";

/* ---------- Palettes ---------- */
export const REDDIT_THEMES = {
  "reddit-light": {
    bg: "#ffffff",
    card: "#FFFFFF",
    text: "#1A1A1B",
    muted: "#6B7280",
    border: "#E5E7EB",
    up: "#FF4500",
    link: "#1A0DAB",
    chip: "#F3F4F6"
  },
  "reddit-dark": {
    bg: "#0B1416",
    card: "#0F1A1C",
    text: "#E6E6E7",
    muted: "#9CA3AF",
    border: "#1F2937",
    up: "#FF4500",
    link: "#86B7FF",
    chip: "#111827"
  },
};

const Score = ({ score, color }) => (
  <div className="flex items-center gap-1 select-none" style={{ color }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 5l6 7H6l6-7z" fill="currentColor" />
    </svg>
    <span className="text-sm font-semibold">{score}</span>
  </div>
);

function Chip({ children, bg, color }) {
  return (
    <span
      className="px-2 py-[2px] rounded-full text-xs"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}

/* ---------- Preview Card ---------- */
export default function RedditPreview({
  themeId = "reddit-light",
  post,
  comments = [],
  transparent = false,
}) {
  const t = REDDIT_THEMES[themeId] ?? REDDIT_THEMES["reddit-light"];

  return (
    <div
      className={
        transparent ? "rounded-xl p-3" : "rounded-xl p-3 border"
      }
      style={{
        background: transparent ? "transparent" : t.bg,
        borderColor: t.border,
        color: t.text,
      }}
    >
      {/* Sub header */}
      <div
        className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2"
        style={{ background: t.card, border: `1px solid ${t.border}` }}
      >
        <img
          src={post?.avatar || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png"}
          alt=""
          className="w-6 h-6 rounded-full"
        />
        <div className="text-sm">
          <span className="font-semibold">r/{post?.subreddit || "AskReddit"}</span>{" "}
          <span className="text-xs" style={{ color: t.muted }}>
            • Posted by u/{post?.author || "you"} {post?.time || "2h"} ago
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Chip bg={t.chip} color={t.muted}>{post?.flair || "Discussion"}</Chip>
        </div>
      </div>

      {/* Post card */}
      <div
        className="rounded-xl p-4 mb-3"
        style={{ background: t.card, border: `1px solid ${t.border}` }}
      >
        <div className="flex items-start gap-3">
          <div className="pt-1">
            <Score score={post?.score ?? 1_2_3} color={t.up} />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold leading-snug">{post?.title || "What’s the pettiest hill you’ll die on?"}</div>
            {post?.body && (
              <div className="mt-2 text-sm leading-6" style={{ color: t.text }}>
                {post.body}
              </div>
            )}
            {post?.link && (
              <a
                href="#"
                className="mt-2 inline-block text-sm underline"
                style={{ color: t.link }}
              >
                {post.link}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-2">
        {comments.map((c) => (
          <div
            key={c.id}
            className="rounded-xl p-3"
            style={{ background: t.card, border: `1px solid ${t.border}` }}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-semibold">u/{c.author}</span>{" "}
                <span className="text-xs" style={{ color: t.muted }}>
                  • {c.time}
                </span>
              </div>
              <Score score={c.score} color={t.up} />
            </div>
            <div className="mt-2 text-sm leading-6">{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
