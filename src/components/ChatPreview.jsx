// src/components/ChatPreview.jsx
import React from "react";

/* ----------------------------------------------------------
   SURFACE BACKGROUNDS (cards & big preview wrap use these)
   - Put the two WhatsApp PNGs in /public/images/
---------------------------------------------------------- */
export const THEME_SURFACES = {
  "imessage-dark":  { bgColor: "#000000" },
  "imessage-light": { bgColor: "#F6F6F6" },

  "whatsapp-dark":  { bgColor: "#0B141A", bgImage: "/images/whatsapp-dark.png" },
  "whatsapp-light": { bgColor: "#ECE5DD", bgImage: "/images/whatsapp-light.png" },

  "messenger":      { bgColor: "#0F0F10" },
};

export const surfaceStyles = (id) => {
  const s = THEME_SURFACES[id] || {};
  return {
    backgroundColor: s.bgColor || "#F6F6F6",
    backgroundImage: s.bgImage ? `url(${s.bgImage})` : "none",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
};

/* ----------------------------------------------------------
   BUBBLE PALETTES (me = right side, other = left side)
---------------------------------------------------------- */
const THEME_BUBBLES = {
  // iMessage
  "imessage-dark":  {
    me:    { bg: "#0A84FF", text: "#FFFFFF" },
    other: { bg: "#2C2C2E", text: "#FFFFFF" },
    header: { bg: "#000000", text: "#FFFFFF" },
  },
  "imessage-light": {
    me:    { bg: "#0A84FF", text: "#FFFFFF" },
    other: { bg: "#E9E9EB", text: "#000000" },
    header: { bg: "#F6F6F6", text: "#111111" },
  },

  // WhatsApp
  "whatsapp-light": {
    me:    { bg: "#E1FFC7", text: "#111111" },   // lime/green
    other: { bg: "#FFFFFF", text: "#111111" },
    header: { bg: "#128C7E", text: "#FFFFFF" },  // WA green
  },
  "whatsapp-dark": {
    me:    { bg: "#005C4B", text: "#E7FFDB" },   // deep teal
    other: { bg: "#202C33", text: "#FFFFFF" },
    header: { bg: "#202C33", text: "#FFFFFF" },
  },

  // Messenger
  messenger: {
    me:    { bg: "#6F5CF6", text: "#FFFFFF" },   // purple/blue
    other: { bg: "#EDEEF0", text: "#111111" },
    header: { bg: "linear-gradient(90deg,#7A3BFF 0%,#5A8CFF 100%)", text: "#FFFFFF" },
  },
};

/* ----------------------------------------------------------
   Simple SVG icons (inherit currentColor)
---------------------------------------------------------- */
const Icon = {
  ArrowLeft: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  ChevronBack: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Video: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M15 10l6-3v10l-6-3v4H3V6h12v4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  ),
  Phone: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 3.18 2 2 0 0 1 4.11 1h2a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.8a2 2 0 0 1-.45 2.11L7.1 8.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.31 1.84.53 2.8.66A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  ),
  Dots: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
    </svg>
  ),
  Info: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 16v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
    </svg>
  ),
};

/* ----------------------------------------------------------
   Tiny header bars to sell the vibe
---------------------------------------------------------- */
function Header({ themeId, contact }) {
  const h = THEME_BUBBLES[themeId]?.header ?? { bg: "#111", text: "#fff" };

  // WhatsApp style header (arrow, avatar, title, status, actions)
  if (themeId.startsWith("whatsapp")) {
    return (
      <div
        className="w-full rounded-xl px-3 py-2 mb-3 flex items-center justify-between"
        style={{ background: h.bg, color: h.text }}
      >
        <div className="flex items-center gap-2">
          <Icon.ArrowLeft aria-hidden />
          <div className="w-7 h-7 rounded-full bg-white/20 grid place-items-center text-xs">J</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{contact}</div>
            <div className="text-[10px] opacity-80">last seen recently</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Icon.Video aria-hidden />
          <Icon.Phone aria-hidden />
          <Icon.Dots aria-hidden />
        </div>
      </div>
    );
  }

  // iMessage style header (back chevron, avatar, name)
  if (themeId.startsWith("imessage")) {
    return (
      <div
        className="w-full rounded-xl px-3 py-2 mb-3 flex items-center gap-2"
        style={{ background: h.bg, color: h.text }}
      >
        <Icon.ChevronBack aria-hidden />
        <div className="w-7 h-7 rounded-full bg-black/10 grid place-items-center text-xs">J</div>
        <div className="text-sm font-semibold">{contact}</div>
      </div>
    );
  }

  // Messenger header (gradient)
  return (
    <div
      className="w-full rounded-xl px-3 py-2 mb-3 flex items-center justify-between"
      style={{ background: h.bg, color: h.text }}
    >
      <div className="flex items-center gap-2">
        <Icon.ChevronBack aria-hidden />
        <div className="w-7 h-7 rounded-full bg-white/20 grid place-items-center text-xs">J</div>
        <div className="text-sm font-semibold">{contact}</div>
      </div>
      <div className="flex items-center gap-3">
        <Icon.Phone aria-hidden />
        <Icon.Video aria-hidden />
        <Icon.Info aria-hidden />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------
   Themed bubble
---------------------------------------------------------- */
function Bubble({ align = "left", bg = "#1F6FEB", text = "#fff", children }) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[72%] px-3 py-2 rounded-2xl shadow"
        style={{ background: bg, color: text }}
      >
        <div className="whitespace-pre-wrap">{children}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------
   ChatPreview
   - me (participants.sender) is always RIGHT
   - other (participants.receiver) is LEFT
   - pass transparent to remove neutral light box bg
---------------------------------------------------------- */
export default function ChatPreview({
  themeId = "imessage-light",
  participants,
  messages,
  transparent = false,
}) {
  const pal = THEME_BUBBLES[themeId] ?? THEME_BUBBLES["imessage-light"];
  const contactName = participants?.receiver?.name ?? "Contact";

  return (
    <div
      className={
        transparent
          ? "rounded-xl p-3 bg-transparent"
          : "rounded-xl p-3 border bg-gray-50"
      }
    >
      {/* top bar */}
      <Header themeId={themeId} contact={contactName} />

      {/* bubbles */}
      {messages.map((m) => {
        const isMe = m.from === (participants?.sender?.id ?? "me"); // me -> right
        const side = isMe ? "right" : "left";
        const colors = isMe ? pal.me : pal.other;
        return (
          <div key={m.id} className="mb-2">
            <Bubble align={side} bg={colors.bg} text={colors.text}>
              {m.text}
            </Bubble>
          </div>
        );
      })}
    </div>
  );
}
