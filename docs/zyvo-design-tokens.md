# Zyvo Design Tokens (as-built)

Read-only extraction from the working tree, 2026-09-27. Nothing here was changed in code.
"Usage" counts are occurrences across `src/components/viral-tools`, `src/components/workspace`, `src/pages/workspace` and `src/pages/viral` (`.jsx` only).

**Headline:** there is no central token system. `tailwind.config.js` only defines breakpoints and two font families; almost every color, radius and shadow is an inline Tailwind arbitrary value. The workspace tools come in **two visual families**:

| Family | Tools | Accent |
|---|---|---|
| Purple (older) | AI Fruit Story, Face ASMR, Clay Rescue, Micro Camera | `#7A3BFF` violet gradients |
| Lime (newer + shell) | 2AM, Behind the Scenes, Cartoon Drive By, 30 Days, TopRow credits pill, sidebar active state | `lime-300` `#BEF264` |

AI Cooking Matic is its own orange family (141 `orange-*` uses).

---

## 1. Colors

### 1.1 Declared tokens (CSS variables)

| Token | Value | File | Notes |
|---|---|---|---|
| `--violet-1` / `--violet-2` / `--violet-3` | `#7A3BFF` / `#9B4DFF` / `#FF57B2` | `src/index.css:8-10` | Only used by `.text-violet-gradient` (`index.css:60-65`) |
| `--blue` | `#007BFF` | `src/index.css:7` | Focus ring for links (`index.css:54`); legacy |
| `--zylo-primary` / `--zylo-primary-light` | `#7A3BFF` / `#C9B8FF` | `src/styles/zylo.css:5-6` | Light-theme era; not used by workspace tools |
| `--zylo-bg` / `--zylo-card` | `#F7F5FA` / `#ECE8F2` | `src/styles/zylo.css:11-12` | Light theme, unused in the workspace |
| `--zylo-text-title` / `--zylo-text-body` | `#110829` / `#4A4A55` | `src/styles/zylo.css:18-19` | Used by `.btn-dark` only |
| `--zyvo-notice-height`, `--zyvo-content-top` | runtime px | set in `src/pages/workspace/layout.jsx:144, 167` | Layout measurements, not colors |

`tailwind.config.js` has **no** `colors` extension. Everything below is inline.

### 1.2 Backgrounds & surfaces (dark UI)

| Role | Value | Uses | Where |
|---|---|---|---|
| App root | `#12141A` | — | `html, body, #root` (`src/index.css:45, 314`) |
| Workspace shell | `#090A0A` | 39 | Layout root (`layout.jsx:191`) |
| Tool page ground | `#0B0D0F` | 37 | `ToolGenerationLayout.jsx:7`; Fruit mobile tab bar |
| Panel / card (purple family) | `#111315` | 40 | Fruit builder (`AIFruitStoryBuilder.jsx:215`), Results card, `NoCreditsModal` |
| Panel (lime family) | `#0C0F0D` | 42 | 2AM / BTS / Cartoon builder sections |
| Footer bar | `#101213` (at /95–/96) | 26 | Mobile fixed footers (`AIFruitStoryBuilder.jsx:337`, `AIFruitStory.jsx:357`) |
| Inset track / well | `#0E1012`, `#0D0F10`, `#0D0F11` | 20 / 9 / 27 | Step pill track, media wells |
| Raised surface | `#151719`, `#1B1D1F`→`#17191B` | 26 | Cards; bottom nav gradient (`MobileBottomNav.jsx:205`) |
| Glass fills | `bg-white/[0.04]` (99), `/[0.03]` (70), `/[0.06]` (70), `/[0.02]` (68) | — | Pills, secondary buttons, cards |
| Disabled button | `#202224` | 6 | `GenerateButton.jsx` |

### 1.3 Borders

| Level | Class | Uses |
|---|---|---|
| Default | `border-white/10` | 257 |
| Subtle | `border-white/[0.08]`, `/[0.07]`, `/[0.06]` | 139 / 114 / 86 |
| Strong | `border-white/15`, `/20` | 72 / 23 |

### 1.4 Text levels

| Level | Class | Uses |
|---|---|---|
| Primary | `text-white` (html default `#F4F6FB`, `index.css:46`) | — |
| Secondary | `text-white/70`, `/60` | 106 / 141 |
| Muted (body copy) | `text-white/45`, `/40` | 149 / 199 |
| Faint (labels, hints) | `text-white/35`, `/30`, `/25` | 145 / 187 / 105 |

### 1.5 Brand accents

| Role | Value | Where |
|---|---|---|
| Violet primary (most used hex, 178 uses) | `#7A3BFF` | Everywhere in the purple family |
| Primary button gradient (purple tools) | `bg-gradient-to-b from-[#A855F7] to-[#7A3BFF]` | Fruit Generate (`AIFruitStoryBuilder.jsx:374`), `GenerateButton.jsx` HEAD version |
| Active segment / upgrade gradient | `bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF]` + `shadow-lg shadow-[#7A3BFF]/20` | Step pill (`AIFruitStoryBuilder.jsx:257`), TopRow Upgrade button |
| Progress bar | `from-white via-[#D8B4FE] to-[#7C3AED]` | `AIFruitStoryResults.jsx:632, 768` |
| Legacy gradient | `#7A3BFF → #492399` | `src/styles/buttons.css` (`.btn-generate-*`) |
| Lime / credit color | `lime-300` `#BEF264` (642 uses), `lime-200` `#D9F99D`, `lime-400` `#A3E635`, `lime-500` `#84CC16` | TopRow credits pill (`toprow.jsx:211-227`), `.zyvo-nav-active` (`workspace-shell.css:11-43`), `.mode-glow`, `.generate-shine` (`index.css:704-800`) |
| Lime primary button | `bg-lime-300 text-[#11150D]` (`#11150D`: 64 uses) | 2AM, BTS, Cartoon, current Image Generator `GenerateButton` |
| Cooking accent | `orange-500` / `orange-400` | AI Cooking Matic |

### 1.6 Semantic

| Role | Values | Example |
|---|---|---|
| Success | `emerald-400` `#34D399` (69), `emerald-500` `#10B981` (56); `green-500/600` | Fruit "Start New Story" (`AIFruitStoryBuilder.jsx:371`), "Audio included" badge |
| Warning | `amber-300/400` (65 / 50), `orange-300/20` + `orange-500/10` | Fruit step-error banner (`AIFruitStoryBuilder.jsx:291`), NoCredits icon tile |
| Error | `red-400` `#F87171` (117), `red-500` `#EF4444` (126), `red-300` (70) | Job-error banner (`AIFruitStoryBuilder.jsx:298`), "Failed" badges |
| Gold plan badge | `#F5C042` → `#F59E0B` (35 / 54 uses) | `from-[#F5C042]/25 to-[#F59E0B]/25 text-[#F5C042] border-[#F5C042]/30` (`FruitStepScenes.jsx:262`); lock tile (`FruitStoryUpgradeModal.jsx:36-47`) |

---

## 2. Typography

| Item | Value | Where |
|---|---|---|
| Loaded web fonts | Inter 400–800, Open Sans 400/600/700 (Google Fonts) | `index.html:45-46` |
| Tailwind families | `font-inter`, `font-opensans` | `tailwind.config.js:20-23` |
| **Effective font in workspace tools** | `system-ui, Avenir, Helvetica, Arial, sans-serif` | `src/index.css:13` (`:root`). Tools never apply `font-inter`, so Inter is loaded but only used on some marketing components. |
| Mono | `font-mono` (3 uses) | — |

Weights: `font-semibold` 581 · `font-bold` 564 · `font-black` 305 · `font-medium` 140.

| Role | Classes (typical) | Example |
|---|---|---|
| Page / tool title | `text-xl font-black` | `AIFruitStoryBuilder.jsx:238` |
| Section heading | `text-lg font-black`; card titles `text-[15px] font-black` | `AIFruitStoryBuilder.jsx:285` |
| Body copy | `text-sm text-white/45` | `AIFruitStoryBuilder.jsx:239, 286` |
| Labels / eyebrows | `text-[10px]`–`text-[11px] font-bold uppercase tracking-widest` (sizes 11px: 355 uses, 10px: 326, 9px: 146) | Pricing / plan badges |
| Buttons | `text-sm font-black` (primary), `text-[13px]`–`text-[14px] font-semibold` (segments) | `AIFruitStoryBuilder.jsx:347, 369` |
| Chips / badges | `text-[9px]`–`text-[12px] font-bold` | `FruitStepScenes.jsx:262` |

---

## 3. Shape & depth

### 3.1 Radius

| Element | Radius | Uses / example |
|---|---|---|
| Pills, chips, segmented tracks | `rounded-full` | 593 |
| Buttons | `rounded-2xl` (Fruit footer, h-12), `rounded-[14px]` (mobile footer, h-11), `rounded-xl` (py-4 GenerateButton) | `AIFruitStoryBuilder.jsx:347`, `AIFruitStory.jsx:365` |
| Segments inside a track | `rounded-lg` in a `rounded-xl` track | `AIFruitStoryBuilder.jsx:246-255` |
| Cards / inner panels | `rounded-2xl` (321), `rounded-[20px]`–`[24px]` | Scene cards `rounded-[20px]` |
| Tool panels | `rounded-[28px]` | Fruit builder + results (`AIFruitStoryBuilder.jsx:215`, `AIFruitStoryResults.jsx:265`) |
| Modals | `rounded-3xl` | `NoCreditsModal.jsx:13` |
| Phone mockup | `rounded-[34px]` | `AIFruitStoryResults.jsx:964` |

### 3.2 Shadows & glows

| Effect | Value | Where |
|---|---|---|
| Panel | `shadow-2xl shadow-black/30` (39 uses) | Tool panels, modals |
| Violet button glow | `shadow-lg shadow-[#7A3BFF]/20`; legacy `0 0 20px rgba(122,59,255,.7)` | Step pill; `buttons.css` |
| Active option glow (purple) | `ActiveGlow`: `border-[#D8B4FE]/55`, violet gradient fill, `0 12px 34px rgba(124,58,237,.18)` | `FruitStepScenes.jsx:26-40` (local component) |
| Lime glow | `.mode-glow` radial `rgba(190,242,100,.18)` + `0 0 50px rgba(190,242,100,.45)`; `.zyvo-nav-active` inset lime | `index.css:704-760`, `workspace-shell.css:11-43` |
| Popover | `0 24px 65px rgba(0,0,0,.42)` | `.zyvo-popover-panel` (`workspace-shell.css:1-9`) |

### 3.3 Backdrop blur

`backdrop-blur-sm` (58: modal scrims `bg-black/70`), `-md` (38), `-xl` (35: fixed footers, TopRow). Paywall and NoCredits scrims use `bg-black/70 backdrop-blur-sm`.

---

## 4. Animation

| Item | Detail |
|---|---|
| Libraries | `framer-motion ^12.38.0` (36 files import it), `animate.css ^4.1.1` (dependency, **0** imports) — `package.json:32-34` |
| Tailwind animations in Fruit | `animate-pulse` ×11, `animate-spin` ×2 |
| Custom keyframes | ~45 in `src/index.css` (e.g. `fadeIn` defined 4× at `:99, :329, :568, :693`; `shimmer`, `generate-shine`, `sheetSlideUp`, `toastIn`, `pulse-glow`, `floatGlow`, pricing set `:833-943`, long-form set `:1074-1140`) plus inline `@keyframes` in 31 component files |
| Durations | `duration-300` (44), `-200` (31), `-500` (23), `-700` (19); CSS loops 2.5–3.5 s |
| Easing | `ease-out` (13), `ease-[cubic-bezier(.16,1,.3,1)]` (5), `ease-linear`, `ease-in-out` |
| `prefers-reduced-motion` | Partial. Respected for 4 CSS groups only: earn marquee (`index.css:210`), voiceover beam (`:450`), cooking voice take (`:1060`), long-form generate (`:1147`); plus `useReducedMotion` in `TwoAmDemoCarousel.jsx` and `earn/shared.jsx`. **Not respected** anywhere in AI Fruit Story (floating hearts, shimmers, pulses, shine sweep). |

---

## 5. Reusable components

| Component | Path | Description |
|---|---|---|
| `GenerateButton` | `src/components/ImageGenerator/GenerateButton.jsx` | Full-width Generate + credit chip; shared by Image/Video Generator and ScriptChat; supports `priceStatus` / `onRetryPrice` |
| `QuotedCredits` / `PriceRetry` | `src/components/pricing/QuotedCredits.jsx` | Server-quoted credit number: skeleton → value → "Couldn't load price — Retry" |
| `useToolPriceQuotes` | `src/hooks/useToolPriceQuotes.js` | Hook that feeds `QuotedCredits` |
| `NoCreditsModal` | `src/components/viral-tools/shared/NoCreditsModal.jsx` | Portal modal (z-300), "Not enough credits", Get Credits → `/workspace/pricing` |
| Credits pill (header) | `src/components/workspace/toprow.jsx:211-240` | Lime gradient pill with masked `/icons/credits.png` + balance |
| `CreditSpendPopup` | `src/components/workspace/CreditSpendPopup.jsx` (driven by `src/lib/creditPopEvents.js`) | "-N credits" pop under the header pill |
| `CreditRefundToast` | `src/components/viral-tools/footballer-nationality-swap/CreditRefundToast.jsx` | "+N credits" refund toast (Footballer only) |
| `ThirtyDaysCreditBadge` | `src/components/viral-tools/thirty-days/ThirtyDaysCreditBadge.jsx` | Lime credit badge |
| `CreditAmount` / `CreditGlyph` | `src/components/ui/CreditAmount.tsx` | Light-theme SVG credit glyph + pill; **0 importers** |
| `Button`, `Card` | `src/components/ui/button.jsx`, `card.jsx` | Light-theme primitives; **0 importers** |
| Upgrade modals (per tool) | `src/components/viral-tools/*/…UpgradeModal.jsx` (Fruit, Face, Clay, Micro, Footballer, 2AM, BTS, Cartoon, 30 Days) | Locked-tier upsell; gold lock tile (Fruit) |
| Paywalls | `ai-fruit-story/FruitStoryPaywall.jsx`, `face-asmr/FaceAsmrPaywall.jsx`, `two-am/TwoAmPaywall.jsx` | Plan picker (Stripe), guest sign-in variant |
| Plan badge | Inline in `FruitStepScenes.jsx:262` (no component) | Gold "Pro" / "Generative" chip on locked pills |
| `ActiveGlow` | `ai-fruit-story/steps/FruitStepScenes.jsx:26` (local) | Selected-option frame for segmented buttons |
| Segmented controls | Inline: step pill `AIFruitStoryBuilder.jsx:246-274`; mobile tab switcher `AIFruitStory.jsx:271-304` | Not extracted into a component |
| Sliders | `src/components/ScriptBuilder/DurationSlider.jsx`; Fruit "Duration" slider is decorative only (`FruitStepScenes.jsx:188-235`) | — |
| Toggles | Local only: `Switch` (`pages/adstudio/AdCreateStep2.jsx:463`), `ToggleRow` (`pages/settings/WorkspaceSettings.jsx:492`), `ToggleLabeled` (`components/image/ImageToolSettingsModal.jsx:747`) | No shared toggle |
| Toasts | `src/components/ui/Toast.jsx`, `ui/ToastBanner.jsx`, `ImageGenerator/Toast.jsx`, `ErrorToast.jsx`, `ProgressToast.jsx`, `LimitReachedToast.jsx`, `library/toast.jsx`, `UpgradeToast.jsx` | Several parallel implementations |
| Loaders / skeletons | `ZyvoLoadingCard` + `SceneSkeleton` (`AIFruitStoryResults.jsx:590, 642`), `TwoAmLoadingCard.jsx`, `.shimmer-bar` classes | Tool-local |
| Glow helpers | `src/components/workspace/Glow.jsx`, `.mode-glow` / `.generate-shine` (`index.css:704-800`) | — |
| `ToolGenerationLayout` | `src/pages/viral/shared/ToolGenerationLayout.jsx` | Two-column shell (460 / 500 px left + fluid right) at `lg`; single column below |

---

## 6. Icons & assets

| Item | Detail |
|---|---|
| Icon library | `lucide-react ^0.537.0` (272 files). `@heroicons/react` in 2 files; `react-icons` in `package.json` but unused. |
| Credit icons | `/public/icons/credits.png` (used as a CSS mask, tinted `bg-lime-300` / `bg-current`), `/public/icons/whitecredit.png` (plain `<img>`), `/public/icons/credit.png`; also `src/assets/toolshell/credit.png`, `credit1.png` |
| Fruit characters | `/public/viral-builder/ai-fruit/characters/` (11: `ananasgirl.png`, `bossmango.png`, `orangekid.webp`, …) |
| Fruit presets / preview | `/public/viral-builder/ai-fruit/presets/*.webp`, `/public/viral-builder/ai-fruit/result.mp4` |
| Other tools | `/public/templates/<TOOL>/…` (e.g. `/templates/AICOOKING/thumbnail.png`), `/public/library/aifruit*.mp4` (gallery) |

---

## 7. Layout shell

| Item | Value | Where |
|---|---|---|
| Breakpoints | `sm 640`, `md 768`, **`lg 1024`** (desktop/mobile split everywhere), `xl 1280`, `2xl 1536`, `3xl 2200`, `4xl 2600` | `tailwind.config.js:8-16` |
| Shell root | `flex h-[100dvh] flex-col overflow-hidden` | `layout.jsx:191` |
| Promo banner | Measured into `--zyvo-notice-height` | `layout.jsx:193-195, 139-154` |
| Sidebar | 220 px, desktop `lg:block`; mobile = fixed drawer | `layout.jsx:200-216` |
| Top bar | `TopRow`, `shrink-0`, z-60 | `layout.jsx:222-227` |
| Scroll container | `#workspace-scroll` = `flex-1 overflow-y-auto overscroll-contain` — **the only page scroller** | `layout.jsx:230-235`; CSS `index.css:316-347` |
| Mobile bottom nav | Fixed, `height: 78px + env(safe-area-inset-bottom)`, z-100 | `MobileBottomNav.jsx:163, 205-210` |
| Tool fixed footers | Fruit step 1: `bottom: 72px + safe-area`, z-95; Fruit step 2: `bottom: 70px + safe-area`, z-90 | `AIFruitStory.jsx:356`, `AIFruitStoryBuilder.jsx:336` |
| Safe-area | `env(safe-area-inset-*)` used in 47 places. **Neither viewport meta sets `viewport-fit=cover`** (`index.html:23`, and a second one after `</body>` at `index.html:55-58` with `user-scalable=no`), so on iOS the insets resolve to 0. |

---

## 8. Mobile scroll bug: AI Fruit Story (diagnosis only, not fixed)

### Scroll chain on mobile (< 1024 px)

```
layout root        h-[100dvh] overflow-hidden                       layout.jsx:191
 └ row             flex-1 min-h-0 overflow-hidden                   layout.jsx:197
   └ main column   flex-1 min-h-0 overflow-x-hidden                 layout.jsx:219
     └ #workspace-scroll  flex-1 overflow-y-auto overscroll-contain layout.jsx:231-232   ← page scroller
       └ ToolGenerationLayout  min-h-screen                         ToolGenerationLayout.jsx:7
         └ <aside>  (sticky/height/overflow are lg: only)           ToolGenerationLayout.jsx:16
           └ div.lg:hidden                                          AIFruitStory.jsx:270
             ├ sticky tab bar (Options | Recent/Results)            AIFruitStory.jsx:271
             └ AIFruitStoryBuilder root: flex h-full flex-col overflow-hidden   AIFruitStoryBuilder.jsx:215
                 └ BODY: min-h-0 flex-1 overflow-y-auto overscroll-contain      AIFruitStoryBuilder.jsx:283  ← nested scroller
```

### Cause 1 (primary): a nested scroll container that is not responsive-prefixed traps touch gestures

- The builder body at `AIFruitStoryBuilder.jsx:283` is `overflow-y-auto overscroll-contain` at **all** widths.
- It was built for desktop, where the aside has a fixed height (`lg:h-[calc(100dvh-96px)] lg:overflow-hidden`, `ToolGenerationLayout.jsx:16`) and the body scrolls inside it. The comment at `:277-282` explains that `overscroll-contain` was added to stop desktop scroll from chaining into `#workspace-scroll`.
- On mobile, that fixed height is not applied (it is `lg:` only). The root's `h-full` (`:215`) resolves against an auto-height parent (`div.lg:hidden`, `AIFruitStory.jsx:270`), so the panel and body grow to their content. The body is still a scroll container, but with nothing to scroll.
- A touch that starts inside the body (almost the whole Options screen) lands on that scroll container first. Because it has `overscroll-behavior: contain`, the gesture is not handed on to `#workspace-scroll`, so the page does not move.
- Scrolling only works when the finger starts outside the body: on the panel header, the sticky tab bar, or the page gutter.
- Other tools scope their bodies to desktop and don't have this: Clay `ClayRescueBuilder.jsx:252`, Micro `MicroCameraAnimalBuilder.jsx:160`, Footballer `FootballerNationalitySwapBuilder.jsx:427`, Cooking `AICookingMaticBuilder.jsx:116`, and 2AM `TwoAmGenerator.jsx:118` all use `lg:overflow-y-auto` / `lg:flex-1 lg:min-h-0`.
- Face ASMR uses the same unprefixed body classes (`FaceAsmrBuilder.jsx:416`) but is **not** affected: its mobile column has a fixed height, so its body really overflows and scrolls. (Corrected 2026-09-27 after a touch-scroll test; it was converted to the page-scroller pattern anyway on branch `fruit-v2`.)
- Both the body scroller and the desktop-only aside height came in commit `6781073` (2026-07-31).

Confidence: high on the structure. Whether a non-overflowing `overflow:auto` element blocks chaining under `overscroll-behavior: contain` is browser behavior. Verify on a device, or in Chrome DevTools device mode: swiping on the ideas card or the textarea should not scroll, while swiping on the tab bar should.

### Cause 2 (certain): fixed footers cover the end of the content with no clearance

- The fixed footers stack above the 78 px bottom nav:
  - Step 2: the builder footer (≈77 px tall at `bottom: 70px`) covers ≈147 px (`AIFruitStoryBuilder.jsx:332-340`).
  - Step 1: `MobileFruitStoryFooter` (≈63 px at `bottom: 72px`) covers ≈135 px (`AIFruitStory.jsx:356`).
- The builder reserves only `p-4` (16 px) in its body plus `py-3` (12 px) from the layout, and has no `pb-[…]` for the footers.
- As a result, the last ≈105–120 px of the Options panel can never be scrolled into view. On step 2 that is the bottom of the "Full story cost" card and the "Story generated" note.
- The Results panel has `pb-24` (96 px, `AIFruitStoryResults.jsx:174, 188, 264`), which is still less than the ≈147 px covered on step 2.
- The footers are also positioned 6–8 px lower than the nav's 78 px top edge, so they overlap it slightly.

### Not the cause (checked)

- `FruitStoryPaywall` sets `document.body.style.overflow = "hidden"` (`FruitStoryPaywall.jsx:56-59`), but `body` never scrolls in this shell (`#workspace-scroll` does), and the lock is removed on close.
- `#workspace-scroll` itself is correctly constrained: `flex-1`, and a scroll container's `min-height: auto` resolves to 0.
- No `touch-action` or `preventDefault()` in the Fruit files, TopRow or the bottom nav.
- The uncommitted `layout.jsx` changes only add title-map entries and the `--zyvo-content-top` variable.
