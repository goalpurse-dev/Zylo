# Zyvo Lime Family — Exact Tokens

Read-only extraction, 2026-09-27. Reference tool: **Cartoon Drive By** (CDB). Behind the Scenes (BTS), 2AM and 30 Days are listed only where they differ. This is the colorway for AI Fruit Story v2.

**Reference files**

| Short name | File |
|---|---|
| CDB-B | `src/components/viral-tools/cartoon-drive-by/CartoonDriveByBuilder.jsx` |
| CDB-R | `src/components/viral-tools/cartoon-drive-by/CartoonDriveByResults.jsx` |
| CDB-P | `src/pages/workspace/CartoonDriveBy.jsx` |
| CDB-U | `src/components/viral-tools/cartoon-drive-by/CartoonDriveByUpgradeModal.jsx` |
| BTS-B | `src/components/viral-tools/behind-the-scenes/BehindTheScenesBuilder.jsx` |
| 2AM-G | `src/components/viral-tools/two-am/TwoAmGenerator.jsx` |
| 2AM-P | `src/pages/workspace/TwoAm.jsx` |
| 30D-B | `src/components/viral-tools/thirty-days/ThirtyDaysBuilder.jsx` |

**Font.** No lime tool sets a font family, so everything renders in `system-ui, Avenir, Helvetica, Arial, sans-serif` (`src/index.css:13`). Weights come from Tailwind (`font-black` = 900).

> **Pitfall — verified in the production build.** Tailwind 3 generates opacity modifiers only for its scale: 0, 5, 10 … 100. Values such as `/42`, `/28`, `/12`, `/38` and `/32` produce **no CSS**, so the element silently falls back to the inherited color.
> Example: CDB-R:206 `text-white/42` is missing from the build, so the hero paragraph renders near-white (`#F4F6FB`), not at 42%.
> In v2, use scale steps (`/40`, `/45`) or brackets (`/[0.42]`).

---

## 1. Colors

### 1.1 Grounds, panels, wells

| Role | Value | Where |
|---|---|---|
| Page ground | `bg-[#0B0D0F]` | CDB-P:212, 217; 2AM-P:179, 202; hero container CDB-R:201 |
| Builder panel | `bg-[#0C0F0D]` + `border border-lime-300/[0.13]` + `shadow-[inset_0_1px_0_rgba(190,242,100,.05)]`, `rounded-2xl` | CDB-B:103 (same BTS-B:120, 2AM-G:96, 30D-B:49) |
| Panel header divider | `border-b border-white/[0.06]` (2AM: `border-lime-300/[0.08]`) | CDB-B:105; 2AM-G:102 |
| Input / textarea | `bg-[#111315] border border-white/[0.08] rounded-2xl` | CDB-B:129 |
| Input (2AM variant) | `bg-[#080B09]/90 border border-lime-300/[0.12]` | 2AM-G:136 |
| Input (30 Days variant) | `bg-black/30 border border-white/10 rounded-xl` | 30D-B:72, 99 |
| Segmented track (inset well) | `bg-[#0E1012] border border-white/[0.07] rounded-xl p-1` | CDB-B:166 |
| Segmented track (2AM) | `bg-[#0e1210] border border-white/10 rounded-xl p-1` | 2AM-G:145 |
| Card / option (unselected) | `bg-white/[0.035] border border-white/[0.07]` (quality cards: `/[0.08]`) | CDB-B:155, 196, 206 |
| Status bar / recent panel | `bg-[#111315]` (recent panel `/95`) + `border-white/[0.07]`–`[0.08]` | CDB-R:179, 55 |
| Result frame | `bg-[#0D0F11] border border-white/[0.1] rounded-[26px] shadow-[0_24px_70px_rgba(0,0,0,.55)]` | CDB-R:130 |
| Empty result placeholder | `radial-gradient(circle_at_50%_35%, rgba(190,242,100,.12), transparent 40%)` over `linear-gradient(145deg, #151915, #090B0A 70%)` | CDB-R:133 |
| Loading card ground | `bg-[#060b08]` + lime radials `.10` / `.06` | `two-am/TwoAmLoadingCard.jsx:18-19` |
| Mobile footer bar | `bg-[#0C0F0D]/95 backdrop-blur-xl border-t border-white/[0.07]` (2AM: `border-lime-300/[0.08]`) | CDB-B:220; 2AM-G:194 |

### 1.2 Borders

| Level | Class |
|---|---|
| Subtle | `border-white/[0.06]` (dividers), `border-white/[0.07]` (tracks, footer, info box) |
| Default | `border-white/[0.08]` (inputs, chips, quality cards), `border-white/10` (secondary buttons, mobile tab track) |
| Strong (hover) | `hover:border-white/15` (quality cards), `hover:border-lime-300/25` (chips, idea rows, recent rows) |
| Lime frame | `border-lime-300/[0.13]` (panels), `border-lime-300/20` (icon tile, badges) |

### 1.3 Text levels

| Level | Class | Example |
|---|---|---|
| Primary | `text-white` | Titles, selected mood chip |
| Strong secondary | `text-white/75`–`/80` | Info box title CDB-B:207; 2AM prompt label |
| Secondary | `text-white/55` | Unselected mood chip CDB-B:155 |
| Muted | `text-white/45` | Unselected segment, idea chips CDB-B:138, 173 |
| Label | `text-white/40` | Uppercase section labels CDB-B:120 |
| Faint | `text-white/35`, `/30`, `/25` | Info meta row, tier tag, "10 sec · 9:16" (CDB-B:208, 201, 184) |
| Placeholder | `placeholder:text-white/20` | CDB-B:129 |

### 1.4 Lime scale (Tailwind defaults)

| Shade | Hex | Used for |
|---|---|---|
| `lime-100` | `#ECFCCB` | 2AM selected tier text (2AM-G:177, 181) |
| `lime-200` | `#D9F99D` | Primary button hover (`hover:bg-lime-200`, CDB-B:226); 2AM plan badge text (2AM-G:162); 2AM style chip selected text |
| **`lime-300`** | **`#BEF264`** | Primary button fill; selected text (`text-lime-300`); icons; eyebrows; progress; tints `/10`, `/[0.09]`, `/[0.1]`, `/15`, `/20` |
| `lime-400` | `#A3E635` | 2AM button border `/35`; 2AM selected tier gradient `from-lime-400/[0.32]`; slider `accent-lime-400` |
| `lime-500` | `#84CC16` | Gradient ends: upgrade CTA `to-lime-500`; 2AM button `to-lime-500/[0.16]`; loading ring stop |
| `lime-600` | `#65A30D` | 2AM selected tier `to-lime-600/[0.24]` |

### 1.5 Dark text on lime

| Value | Where |
|---|---|
| **`text-[#11150D]`** | Primary button (CDB-B:226, BTS-B:326, 30D-B:116); 30 Days "AI idea" pill |
| `text-black` | Download button, "10 sec style" badge (CDB-R:103, 166) |
| `text-[#081008]` | 2AM mobile tab, selected state (2AM-P:211) |
| `text-[#071006]` | Upgrade modal CTA (CDB-U:54) |

### 1.6 Selected / active

| Control | Selected | Unselected |
|---|---|---|
| Option chip / card (mood, disaster) | `border-lime-300/45 bg-lime-300/[0.09] text-white` | `border-white/[0.07] bg-white/[0.035] text-white/55 hover:text-white/80` |
| Quality card | `border-lime-300/50 bg-lime-300/[0.1]`, label `text-lime-300` | `border-white/[0.08] bg-white/[0.035] hover:border-white/15`, label `text-white` |
| Segmented pill | `bg-white text-black` | `text-white/45 hover:bg-white/[0.06] hover:text-white/75` |
| Mobile tab (CDB, BTS, 30 Days) | `bg-white text-black` | `text-white/60` |
| Mobile tab (2AM) | `bg-lime-300 text-[#081008] shadow-[0_0_18px_rgba(190,242,100,.12)]` | `text-white/55` |
| Style chip (2AM advanced) | `border-lime-300/50 bg-lime-300/10 text-lime-200 shadow-[0_0_14px_rgba(190,242,100,.06)]` | `border-white/[0.07] bg-white/[0.035]` |

### 1.7 Disabled / read-only

| State | Classes | Where |
|---|---|---|
| Primary while generating | `cursor-not-allowed bg-lime-300/15 text-lime-300/40` | CDB-B:226 |
| 30 Days disabled | `disabled:cursor-not-allowed disabled:bg-lime-300/15 disabled:text-lime-300/40` | 30D-B:116 |
| 2AM disabled | `disabled:cursor-not-allowed disabled:opacity-45` | 2AM-G:197 |
| Locked tier text | `text-white/30` | CDB-B:198 |
| History / read-only mode | Section `opacity-[.55] grayscale`, body `pointer-events-none`, plus overlay `bg-[radial-gradient(circle_at_55%_25%,rgba(130,135,130,.16),transparent_32%),linear-gradient(rgba(112,116,112,.16),rgba(45,48,46,.34))] backdrop-grayscale` | CDB-B:104-105, 117 |

### 1.8 Semantic

| Role | Classes | Where |
|---|---|---|
| Success ("Your drive-by is ready") | `text-emerald-400` (`#34D399`) | CDB-R:182 |
| In progress | `text-lime-300` + `Loader2 animate-spin text-lime-300` | CDB-R:181-182 |
| Error banner | `border-red-500/20 bg-red-500/10 text-red-300` (`#FCA5A5`), `text-[12px] font-semibold`, `rounded-xl` | CDB-R:192 |
| Error status text | `text-red-400` (`#F87171`) | CDB-R:182 |
| Validation | `text-[11px] font-semibold text-red-400`, centered above the button | CDB-B:221 |
| Warning (low credits) | `text-[10px] font-medium text-orange-300/80` (`#FDBA74`): "You have N credits · T needed" | 2AM-G:196 |
| Mood swatches (content, not UI) | `#F59E0B`, `#F472B6`, `#A78BFA`, `#F87171` | CDB-B:27-30 |

### 1.9 Plan badges & locks

The lime family uses **no gold**. Locks are grey (CDB) or lime (2AM).

| Element | Classes | Where |
|---|---|---|
| Locked quality card (CDB/BTS) | Same unselected card; label `text-white/30` with `<Lock className="mr-1 inline h-3 w-3"/>` before it; sub-label is the plan name (`PLAN_LABELS`), `text-[8px] font-bold uppercase tracking-wide text-white/30` | CDB-B:196-201 |
| Locked tier (2AM) | `Lock w-3 h-3 text-lime-300/70` + badge `text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-gradient-to-r from-lime-300/30 to-lime-500/30 text-lime-200 border border-lime-300/40` | 2AM-G:158-163 |
| Upgrade modal | Card `max-w-sm rounded-3xl border-lime-300/[0.13] bg-[#0C0F0D] p-6 shadow-2xl`; corner glow `radial-gradient(circle, #BEF264 0%, transparent 70%)` `h-40 w-40 blur-3xl opacity-30`; lock tile `h-16 w-16 rounded-2xl bg-gradient-to-br from-lime-300/20 to-lime-500/20 border-lime-300/30` + `Lock h-7 w-7 text-lime-300`; CTA `rounded-2xl bg-gradient-to-r from-lime-300 to-lime-500 py-3 text-[15px] font-bold text-[#071006] hover:opacity-90`; "Not now" `text-sm text-white/40 hover:text-white/60` | CDB-U:26-61 |
| Pill badges | `rounded-full border border-lime-300/20 bg-lime-300/[0.08] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-lime-300` ("Latest") | CDB-R:61 |
| Solid badge | `rounded-full bg-lime-300 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-black` ("10 sec style") | CDB-R:103 |

---

## 2. Primary button (Generate)

**Container** (mobile fixed footer, static on desktop), CDB-B:220:
`fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-2.5`

**Button base**, CDB-B:226:
`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-black transition lg:py-2.5`

| State | Added classes | Label |
|---|---|---|
| Idle | `bg-lime-300 text-[#11150D]` | "Generate" + credit chip + `ChevronRight h-4 w-4` |
| Hover | `hover:bg-lime-200` | — |
| Pressed | **No pressed style** in CDB, BTS or 30 Days (no `active:` class). The purple tools use `active:scale-[0.99]`. | — |
| Price loading | Still idle colors, but `disabled` (the attribute only, no visual change; hover still applies) | "Loading price…" + skeleton in the chip |
| Price error | Idle colors, enabled | "Couldn't load price — Retry" (chip hidden) |
| Generating | `cursor-not-allowed bg-lime-300/15 text-lime-300/40`, `disabled` | "Building the world..." / "Animating the drive-by..." |
| Done / error | `border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08]` | "Create another" |
| History mode | Done style | "Done" |

**Credit chip inside** (CDB-B:230-246): `<span className="flex items-center gap-1 text-[13px] font-semibold">` holding:
- a masked icon: `<span className="h-4 w-4 shrink-0 bg-current" style={{maskImage:"url('/icons/credits.png')", maskSize:"contain", maskRepeat:"no-repeat", maskPosition:"center"}} />`. It takes the button's text color (`#11150D`).
- `<QuotedCredits …/>` for the number.

**Variants**

| Tool | Difference | Where |
|---|---|---|
| BTS | Same button, `flex-1`, with a square secondary "Surprise me" button on its left: `rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3.5 text-white/70 hover:bg-white/[0.08] lg:py-2.5` + `Sparkles h-4 w-4` | BTS-B:311-326 |
| 30 Days | `px-4 py-3.5 text-sm font-black` with a leading `WandSparkles h-4 w-4`; uses `disabled:` variants | 30D-B:116-117 |
| 2AM (glass variant) | See below | 2AM-G:197-205 |

2AM button: `group relative overflow-hidden rounded-xl border border-lime-400/35 bg-gradient-to-r from-lime-300/[0.20] to-lime-500/[0.16] py-3.5 text-[14px] font-black text-white shadow-[inset_0_1px_0_rgba(217,249,157,.06),0_10px_30px_rgba(0,0,0,.16)] transition hover:border-lime-400/50 hover:from-lime-300/[0.26] hover:to-lime-500/[0.20] hover:shadow-[inset_0_1px_0_rgba(217,249,157,.08),0_12px_34px_rgba(132,204,22,.12)] disabled:cursor-not-allowed disabled:opacity-45`
- Hover shine (2AM-G:198): `<span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-lime-200/10 blur-md transition-transform duration-700 group-hover:translate-x-[420%]" />`
- Credit chip (2AM-G:201): `ml-1 rounded-full border border-lime-400/20 bg-gradient-to-r from-lime-300/[0.10] to-lime-500/[0.07] px-2.5 py-1 text-[12px] font-semibold text-lime-300`, with the icon `h-3.5 w-3.5 bg-lime-300`
- Busy spinner: `h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-lime-300`

**`.generate-shine` / `.mode-glow` are not used by any lime tool.** Their only user is `src/components/ImageGenerator/GenerateButton.jsx:35, 39`.
- `.generate-shine` (`src/index.css:780-826`): a skewed band at `rgba(217,249,157,.25)` / `rgba(255,255,255,.40)`, `blur(4px)`, animated `generateShineMove 2.8s ease-in-out infinite`.
- `.mode-glow` (`index.css:704-760`): radial `rgba(190,242,100,.18)` plus `0 0 50px rgba(190,242,100,.45)`, with blurred lime edge lights.
- Neither is covered by `prefers-reduced-motion`.

---

## 3. Selection controls (exact)

| Control | Container | Item (selected / unselected) | Where |
|---|---|---|---|
| **Mood chips** (Golden Dusk …) | `grid grid-cols-2 gap-2` | `flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-bold transition lg:py-1.5`; selected `border-lime-300/45 bg-lime-300/[0.09] text-white`; unselected `border-white/[0.07] bg-white/[0.035] text-white/55 hover:text-white/80`; swatch `h-3 w-3 rounded-full` with inline color | CDB-B:148-160 |
| **Vehicle segmented** (Car/Bus/Train/Camper) | `grid grid-cols-4 gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1` | `rounded-lg px-1 py-2 text-[10px] font-bold capitalize transition lg:py-1.5`; selected `bg-white text-black`; unselected `text-white/45 hover:bg-white/[0.06] hover:text-white/75` | CDB-B:166-177 |
| **Quality cards V2/V3/V4** | `grid grid-cols-3 gap-2`; header row: label + `text-[10px] font-semibold text-white/25` "10 sec · 9:16" | `relative h-[56px] rounded-xl border px-2 py-1.5 text-center transition lg:h-[48px]`; active (and not locked) `border-lime-300/50 bg-lime-300/[0.1]`; otherwise `border-white/[0.08] bg-white/[0.035] hover:border-white/15`. Label `block text-[13px] font-black`, colored `text-white/30` (locked) / `text-lime-300` (active) / `text-white`. Sub-label `mt-0.5 block text-[8px] font-bold uppercase tracking-wide text-white/30` = tier tag, or plan name when locked | CDB-B:186-205 |
| **Locked V4** | Same card, unselectable: click opens the upgrade modal, or the paywall when no tier is allowed (CDB-B:66-78) | `<Lock className="mr-1 inline h-3 w-3" />V4`, label `text-white/30`, sub-label "Generative" | CDB-B:199-201 |
| **Info box** ("2K image · 720p video") | `mt-2.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5 lg:mt-1.5 lg:py-1.5` | Title `text-[11px] font-bold text-white/75`; meta row `mt-1.5 flex items-center gap-3 text-[10px] font-semibold text-white/35` with `Clock3` / `Volume2` / `VolumeX` icons `h-3 w-3` | CDB-B:206-215 |
| **Idea chips** ("Idea 1") | `mt-2 flex flex-wrap gap-1.5` | `rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/45 transition hover:border-lime-300/25 hover:text-white/75` | CDB-B:131-143 |
| Idea rows (BTS) | `flex flex-col gap-1.5` | `flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 hover:border-lime-300/25 hover:bg-white/[0.055]`, text `text-[11px] font-bold text-white/70`, trailing `ChevronRight text-white/25` | BTS-B:149-160 |
| Icon option grid (BTS "What happens?") | `grid grid-cols-3 gap-1.5` | Same colors as mood chips, `flex-col items-center gap-1 px-2 py-2.5`, emoji `text-[18px]`, label `text-[10px]` | BTS-B:168-178 |
| Quality segmented (2AM alt) | `flex gap-2 rounded-xl border border-white/10 bg-[#0e1210] p-1` | Active `border-lime-400/40 bg-gradient-to-r from-lime-400/[0.32] to-lime-600/[0.24] text-lime-100 shadow-[inset_0_1px_0_rgba(217,249,157,.08)]`, tag chip `bg-black/20 text-lime-100`; inactive `border-transparent text-white/40`, tag `bg-white/[0.05] text-white/30` | 2AM-G:145-185 |
| Slider (2AM) | Native `<input type="range">` `h-1.5 w-full accent-lime-400`; value `text-[11px] font-bold text-lime-300` | `two-am/TwoAmAdvancedSettings.jsx:45-55` |

**Focus.** Text inputs use `outline-none focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30` (CDB-B:129); 2AM uses `focus:border-lime-300/55 focus:ring-2 focus:ring-lime-300/10`. **Buttons and chips have no focus-visible style** in any lime tool.

---

## 4. Typography

| Element | Classes | Where |
|---|---|---|
| **Hero headline** (right panel) | `h2`: `mt-2 text-[27px] font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-[34px]`. Line 1 is plain text, then `<br />`, then line 2 `<span className="text-lime-300">Make it feel real.</span>` | CDB-R:205 (BTS Results:256 identical classes) |
| Hero eyebrow | `flex items-center gap-2 text-lime-300` + `Sparkles h-4 w-4` + `text-[10px] font-black uppercase tracking-[0.18em]` | CDB-R:204 |
| Hero paragraph | `mt-2 max-w-[620px] text-[12px] font-medium leading-relaxed text-white/42` (**`/42` not generated; renders near-white**) | CDB-R:206 |
| Hero wrapper | `relative z-10 mb-5 lg:mb-3` over a `blur-3xl opacity-[0.09] scale-110` backdrop image | CDB-R:202-203 |
| Panel title (CDB, 30 Days) | `text-[18px] font-black tracking-[-0.03em] text-white` | CDB-B:111; 30D-B:56 |
| Panel subtitle (CDB, 30 Days) | `text-[10px] font-semibold uppercase tracking-[0.14em] text-lime-300/65` ("Lost worlds, made real") | CDB-B:112 |
| Panel title + subtitle (BTS, 2AM) | `text-[19px] font-black tracking-tight text-white` + `mt-1 max-w-[310px] text-[11px] leading-relaxed text-white/40` (sentence case) | BTS-B:128-129; 2AM-G:112-113 |
| Panel icon tile | CDB: `grid h-8 w-8 place-items-center rounded-xl border border-lime-300/20 bg-lime-300/10` + `Sparkles h-4 w-4 text-lime-300`. BTS/2AM: `h-[52px] w-[52px] rounded-2xl border border-lime-300/35 bg-gradient-to-br from-lime-300/15 via-[#121910] to-[#08130C] shadow-[0_0_26px_rgba(190,242,100,.14)]` with an image | CDB-B:107-108; BTS-B:124 |
| **Section label** ("WORLD TO DRIVE PAST") | `mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5` | CDB-B:120, 147, 165, 183 |
| Section label (2AM) | `text-[10px] font-semibold uppercase tracking-widest text-white/30` | 2AM-G:144 |
| Section label (30 Days) | Sentence case, `text-xs font-bold text-white/75` | 30D-B:65 |
| Helper text | `text-[10px] leading-relaxed text-white/30` | BTS-B:197; 2AM-G:140 |
| Body / input text | `text-[14px] leading-relaxed text-white` | CDB-B:129 |
| Card title (results) | `text-[14px] font-black text-white` + sub `text-[10px] font-semibold text-white/30` | CDB-R:58-59 |
| Big progress | `text-[28px] font-black tabular-nums text-white` + `text-[11px] font-bold text-white/45` | CDB-R:138-139 |

---

## 5. Glows & effects

| Effect | Value | Where |
|---|---|---|
| Panel inner highlight | `shadow-[inset_0_1px_0_rgba(190,242,100,.05)]` | Every lime builder panel |
| Icon-tile glow | `shadow-[0_0_26px_rgba(190,242,100,.14)]` | BTS-B:124; 2AM-G:104 |
| Selected lime glow (2AM) | `shadow-[0_0_18px_rgba(190,242,100,.12)]` (tabs), `shadow-[0_0_14px_rgba(190,242,100,.06)]` (chips) | 2AM-P:211; `TwoAmAdvancedSettings.jsx` |
| Ambient blobs (2AM panel) | `bg-lime-300/[0.055] blur-[70px]` (h-56, top-left), `bg-lime-500/[0.045] blur-[72px]` (h-52, bottom-right) | 2AM-G:97-98 |
| Grid texture (2AM) | Lime lines at `rgba(190,242,100,.35)`, 34 px grid, `opacity-[0.055]`, masked to fade | 2AM-G:99 |
| Top hairline (2AM) | `h-px bg-gradient-to-r from-transparent via-lime-300/70 to-transparent` | 2AM-G:100 |
| Upgrade modal glow | `radial-gradient(circle, #BEF264 0%, transparent 70%)` `blur-3xl opacity-30` | CDB-U:34-35 |
| Lime gradients | CTA `from-lime-300 to-lime-500`; tint `from-lime-300/[0.20] to-lime-500/[0.16]`; loading ring `#BEF264 → #84CC16` | CDB-U:54; 2AM-G:197; `TwoAmLoadingCard.jsx:24-27` |
| Hover | Chips/rows: `hover:border-lime-300/25` (+ `hover:bg-white/[0.055]`); primary: `hover:bg-lime-200`; secondary: `hover:bg-white/[0.08]`; round icon buttons: `bg-white/15 → hover:bg-white/25`, lime download `hover:bg-lime-200` | CDB-B, CDB-R:165-166 |
| Header credits pill | `border-lime-400/20 bg-gradient-to-r from-lime-300/[0.10] to-lime-500/[0.07] shadow-[inset_0_1px_0_rgba(217,249,157,0.04)]`, icon `bg-lime-300`, text `text-sm font-semibold text-lime-300` | `src/components/workspace/toprow.jsx:211-227` |

---

## 6. Components

| Piece | Path : lines | Reusable? |
|---|---|---|
| Builder shell (header / scroll body / footer) | CDB-B:103-250 (same structure in BTS-B, 30D-B, 2AM-G) | Tool-local (copied per tool) |
| Section header (label) | CDB-B:120, 147, 165, 182-185 | Inline |
| Idea chips | CDB-B:131-143 | Inline |
| Mood chips | CDB-B:148-160 | Inline |
| Segmented control | CDB-B:166-177; BTS "Camera" BTS-B:238-245 | Inline |
| Quality cards + info box | CDB-B:186-215 (identical in BTS-B:258-285) | Inline, duplicated |
| Generate button + footer | CDB-B:220-250 | Inline, duplicated |
| Right hero + example cards | `ExampleVideo` CDB-R:93-107; `RecentCreations` CDB-R:53-91; hero CDB-R:200-225 | Tool-local functions |
| Result frame + progress overlay | `ResultCard` CDB-R:109-173; `MediaViewer` CDB-R:31-51 | Tool-local |
| Lime circular loader | `src/components/viral-tools/two-am/TwoAmLoadingCard.jsx` (props `progress`, `status`) | Self-contained; importable |
| 2AM status bar | `src/components/viral-tools/two-am/TwoAmGenerationStatus.jsx` | Tool-local |
| Collapsible settings | `src/components/viral-tools/two-am/TwoAmAdvancedSettings.jsx` (grid-rows 0fr→1fr, `duration-300`) | Tool-local |
| Upgrade modal | CDB-U (lime variant); also `two-am/TwoAmUpgradeModal.jsx`, `thirty-days/ThirtyDaysUpgradeModal.jsx` | Per-tool copies |
| Paywall | `face-asmr/FaceAsmrPaywall.jsx` (CDB uses it with `toolName`/`previewSrc`, CDB-P:235-245); `two-am/TwoAmPaywall.jsx` | Shared-ish (Face ASMR's is parameterised) |
| Credit number | `src/components/pricing/QuotedCredits.jsx` | **Shared** |
| No-credits modal | `src/components/viral-tools/shared/NoCreditsModal.jsx` (purple/orange styling, not lime) | **Shared** |
| Credit badge | `src/components/viral-tools/thirty-days/ThirtyDaysCreditBadge.jsx` | Tool-local |

There is no shared lime component library. Every lime control is inline Tailwind, duplicated across CDB, BTS, 2AM and 30 Days.

---

## 7. Mobile: footer & scrolling (the pattern Fruit v2 should copy)

The lime tools share four rules:

1. **The builder body never traps scroll on mobile.** No lime builder uses `overscroll-contain`.
   - CDB, BTS and 30 Days have a body `min-h-0 flex-1 overflow-y-auto …` (CDB-B:117). The builder `<section>` has no mobile height (`min-h-[560px]`; `lg:h-full` only), so that body never overflows and touch scroll passes through to the real scroller.
   - 2AM makes the body a scroller only on desktop: `lg:min-h-0 lg:overflow-y-auto` (2AM-G:118).
2. **Footer clearance is built into the body.** The body's content wrapper ends with `pb-[150px] lg:pb-0` (CDB-B:118; BTS-B:135; 30D-B:63 `lg:pb-3`; 2AM-G:118 `pb-[150px]`).
   - The fixed footer sits at `bottom: 72px + safe-area` and is about 69 px tall (pt-3, a py-3.5 button, pb-2).
   - It covers about 141 px, which fits under the 150 px spacer.
3. **The footer is `fixed` on mobile and `lg:static` on desktop**, with z-90 (z-95 in 2AM). It sits inside the builder markup, so it disappears when the user switches to the Result tab (the builder unmounts).
4. **One real scroller per screen.** There are two variants:

| Variant | Tools | Mobile wrapper | Who scrolls | Notes |
|---|---|---|---|---|
| A: inner scroller | CDB, BTS | `flex h-full min-h-0 flex-col overflow-hidden bg-[#0B0D0F] lg:hidden` → tab bar (plain flex child) → `min-h-0 flex-1 overflow-y-auto px-3 pb-[110px]` | The inner div (CDB-P:217, 232). `h-full` resolves against `#workspace-scroll`, which has a definite flex height. | The tab bar stays put because it's outside the scroller. **Side effect:** the page's `document.getElementById("workspace-scroll")?.scrollTo(...)` calls (CDB-P:150, 158, 224) are no-ops on mobile, because `#workspace-scroll` has nothing to scroll. Switching tabs doesn't reset the inner scroller to the top. |
| **B: page scroller (recommended for Fruit v2)** | 2AM, 30 Days | `flex min-h-full w-full flex-col bg-[#0B0D0F] lg:hidden` → `sticky top-0 z-30 … bg-[#0B0D0F]/95 backdrop-blur-xl` tab bar → `px-3 pb-3` content | `#workspace-scroll` itself (2AM-P:202-217; 30 Days `ThirtyDays.jsx:552`) | Single scroller, so sticky tabs work and the existing `#workspace-scroll.scrollTo` resets work. The builder body is `lg:`-scoped and carries the `pb-[150px]` spacer. |

**Recipe for Fruit v2 (from variant B, 2AM):**
- Mobile page root: `flex min-h-full w-full flex-col bg-[#0B0D0F] lg:hidden`.
- Tab bar: `sticky top-0 z-30 border-b border-white/[0.07] bg-[#0B0D0F]/95 px-3 py-3 backdrop-blur-xl`.
- Builder `<section>`: no mobile height; `lg:h-full lg:min-h-0`.
- Builder body: `flex-1 … lg:min-h-0 lg:overflow-y-auto`, with **no** `overscroll-contain` (if it's needed for desktop, use `lg:overscroll-contain`).
- Body content: end with `pb-[150px] lg:pb-0`.
- Footer: `fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] … lg:static`.
- Desktop: the page's `lg:flex lg:h-full lg:overflow-hidden` shell, a `w-[420px] xl:w-[460px]` left column, and a right column `h-full min-w-0 flex-1 overflow-y-auto` (2AM-P:179-185).

**Caveat shared by all lime tools.** The bottom nav is 78 px tall (`MobileBottomNav.jsx:163`) but footers sit at 72 px, overlapping it by 6 px. `index.html`'s viewport meta lacks `viewport-fit=cover`, so on iOS `env(safe-area-inset-bottom)` is 0 (see `docs/zyvo-design-tokens.md` §7).
