-- Content Machine: two accounts (content lanes, owner 2026-10-19).
--   creator  go-viral / faceless-creator education with a soft Zyvo mention (everything made so far)
--   zyvo     Zyvo's brand account: product-forward carousels that show what Zyvo does
-- Each lane has its own brand rules, formats (cm_library.lanes), CTA style, posting times, playbook, slideshows per
-- day and learning loop (ideas, analyses and posts carry their account). The Zyvo lane may only claim what is
-- on the fact sheet (cm_facts). Caps stay shared ($3/day, $2.50 Anthropic).
BEGIN;
SET LOCAL lock_timeout = '5s';

/* ─── the lanes ──────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.cm_lanes (
  key text PRIMARY KEY CHECK (key IN ('creator', 'zyvo')),
  name text NOT NULL,
  brand_rules text NOT NULL,
  cta_style text NOT NULL DEFAULT '',
  post_times jsonb NOT NULL DEFAULT '{}',           -- {tiktok: ["12:00", …], instagram: […], youtube: […]} (Helsinki)
  playbook text NOT NULL DEFAULT '',
  playbook_updated_at timestamptz,
  slideshows_per_day integer NOT NULL DEFAULT 0 CHECK (slideshows_per_day BETWEEN 0 AND 20),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
ALTER TABLE public.cm_lanes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cm_lanes FROM PUBLIC, anon, authenticated;

-- The creator lane takes over the current brand rules and playbook.
INSERT INTO public.cm_lanes (key, name, brand_rules, cta_style, post_times, playbook, playbook_updated_at, slideshows_per_day)
SELECT 'creator', 'Creator account', s.brand_rules, 'Soft: a question, comment a keyword, or "tool''s in my bio". Zyvo is one honest mention.',
       '{"tiktok": ["12:00", "17:00", "19:30", "21:00"], "instagram": ["08:00", "12:30", "18:00", "20:30"], "youtube": ["11:00", "15:00", "18:00", "20:00"]}'::jsonb,
       COALESCE(s.playbook, ''), s.playbook_updated_at, 3
FROM public.cm_settings s WHERE s.id
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.cm_lanes (key, name, brand_rules, cta_style, post_times, slideshows_per_day) VALUES
('zyvo', 'Zyvo account', $rules$- This is Zyvo's own brand account: every post is clearly about Zyvo and shows what it does.
- Claim ONLY what is on the Zyvo fact sheet; cite the fact for every claim. If it isn't on the sheet, don't say it.
- Never name, compare with or copy features from any other tool or company.
- Pictures are ONLY real Zyvo outputs from the asset library (no flawed frames, no cut-off subtitles) or rebuilt Zyvo UI; never a generated stand-in.
- No invented numbers, user counts, testimonials, reviews, earnings or speed claims.
- Benefit first, plain language, second person; one idea per slide.$rules$,
 'A clear product CTA: a button graphic "Make your first video →", tryzyvo.com and "Link in bio".',
 '{"tiktok": ["11:00", "16:00", "19:00"], "instagram": ["09:00", "13:00", "19:00"], "youtube": ["12:00", "17:00", "19:00"]}'::jsonb, 2)
ON CONFLICT (key) DO NOTHING;

-- The automatic run makes each account's own count; the old total (read by the minute tick) follows them.
UPDATE public.cm_settings SET slideshows_per_day = (SELECT COALESCE(SUM(slideshows_per_day), 0) FROM public.cm_lanes) WHERE id;

/* ─── the fact sheet ─────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.cm_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),   -- what a slide cites in fact_ids
  category text NOT NULL DEFAULT 'other',
  claim text NOT NULL CHECK (length(claim) BETWEEN 5 AND 200),
  detail text,
  source text NOT NULL CHECK (length(source) > 3),                   -- a repo path or a tryzyvo.com page
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cm_facts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cm_facts FROM PUBLIC, anon, authenticated;

-- The first sheet (2026-10-19), each checked in the code (laptop-transfer = production for these files) or on
-- tryzyvo.com. category "not_feature": things Zyvo does NOT do, so the writer never claims them.
INSERT INTO public.cm_facts (key, category, claim, detail, source, created_by) VALUES
  ('lf_length', 'long_form', 'Turn one idea into an 8–15 minute YouTube explainer', 'Length 8–15 min; presets 8/10/12/15, default 10', 'src/pages/workspace/long-form/lengthEstimates.js:31', 'seed'),
  ('lf_niches', 'long_form', '25 niches to start from, in 5 groups', 'History 7, Mind & Body 4, Animals & Nature 4, Science & Universe 4, Money & Modern Life 6', 'src/pages/workspace/long-form/niches.js:24-75', 'seed'),
  ('lf_styles', 'long_form', '6 visual styles for Long Form videos', 'Classic 2D Documentary, Simple Story Cartoon, Bright Modern Cartoon, Meme Documentary, Illustrated History, Documentary Collage', 'src/pages/workspace/long-form/stylePresets.js:30-87', 'seed'),
  ('lf_scenes', 'long_form', 'About 150 scenes in a 10-minute video', '15 scenes a minute: ~120 at 8 min to ~225 at 15 min', 'src/lib/longFormPipelineConstants.ts:30', 'seed'),
  ('lf_pipeline', 'long_form', 'Research, script, voice-over and scenes made from one idea', 'Story plan → research → script → voice → scenes; the flow is Idea · Scenes · Edit · Publish', 'src/pages/workspace/long-form/autopilot.js:1-3', 'seed'),
  ('lf_voices', 'long_form', 'Choose from 33 English narration voices', 'American, British, Australian and NZ accents', 'src/lib/voiceCatalog.js:1-8', 'seed'),
  ('lf_ideas', 'long_form', 'Get 10 ideas for your niche, or write your own topic', 'Topic tabs "Write my own" / "Get ideas for me"', 'src/pages/workspace/long-form/ProductionSetup.jsx:1971', 'seed'),
  ('lf_quality', 'long_form', '3 quality levels: V2 Fast, V3 High Quality, V4 Ultra', 'V3 is marked Recommended', 'src/pages/workspace/long-form/ProductionSetup.jsx:50-52', 'seed'),
  ('lf_edit_scenes', 'long_form', 'Change any scene before you download', 'Edit description / Edit text / Regenerate; split, transitions, camera move, captions, music, text', 'src/pages/workspace/long-form/scenes.jsx', 'seed'),
  ('lf_captions', 'long_form', 'Captions you can switch on, in 3 styles', 'Bold word highlight, Simple white, Boxed', 'src/lib/stickmanEdit.js:27', 'seed'),
  ('lf_download', 'long_form', '1080p download, and a sharper 1440p version on request', '"Download video (1080p)"; "Make 1440p version" costs credits (free on V4)', 'src/pages/workspace/long-form/publish.jsx:131-140', 'seed'),
  ('lf_thumbnails', 'long_form', '3 thumbnails drawn from your video', '1280×720 PNG with an editable headline', 'src/pages/workspace/long-form/publish.jsx:207', 'seed'),
  ('lf_youtube_text', 'long_form', 'YouTube title, description and tags written for you', '"YouTube title, description & tags" with Copy all', 'src/pages/workspace/long-form/publish.jsx', 'seed'),
  ('lf_free_preview', 'long_form', 'Try Long Form free: a title, an opening line and 3 sample scenes', 'No credits; no research, voice or render in the preview', 'src/pages/workspace/long-form/teaser.jsx:1-5', 'seed'),
  ('fruit_series', 'fruit_story', 'Make a series of up to 10 episodes with the same cast', '3–10 episodes; series cast 2–5 characters', 'supabase/functions/_shared/fruit/limits.js:3-15', 'seed'),
  ('fruit_characters', 'fruit_story', '150 fruit characters to cast from', 'The core roster', 'src/data/fruitStoryPages.js:20', 'seed'),
  ('fruit_length', 'fruit_story', 'Fruit stories from 15 seconds to 2 minutes', 'Single video cast up to 3', 'supabase/functions/_shared/fruit/limits.js', 'seed'),
  ('fruit_formats', 'fruit_story', 'Tall 9:16 or wide 16:9, captions on or off', 'Series episodes are always 9:16', 'https://www.tryzyvo.com/ai-fruit-story-maker', 'seed'),
  ('blocky_lipsync', 'blocky_stories', 'Blocky characters talk with lip sync and captions', 'Word-by-word captions with an on/off toggle', 'src/data/blockyStoryLanding.js:103', 'seed'),
  ('blocky_length', 'blocky_stories', 'Blocky Stories from 20 seconds to a minute in one tap', 'Quick lengths 20/30/45/60 s; 9:16', 'src/components/viral-tools/blocky-stories/constants.js:31', 'seed'),
  ('short_templates', 'short_templates', '9 short-form templates for TikTok, Reels and Shorts', 'Blocky Stories, Behind the Scenes, Cartoon Drive By, AI Fruit Story, Micro Camera, Video Generator, Clay Rescue, AI Cooking Matic, 2AM Worlds', 'src/components/home-v2/HomeV2Sections.jsx:380-397', 'seed'),
  ('clay_rescue', 'clay_rescue', 'Clay Rescue: giant hands save tiny clay worlds', 'A short-form template', 'src/components/home-v2/HomeV2Sections.jsx:386', 'seed'),
  ('img_styles', 'image_generator', '18 image styles in the image generator', 'Cinematic, 3D Cartoon, Vintage Portrait, Voxel World, Realistic, Anime, Clay, Comic, Toy Diorama, Cyberpunk, Pixel Art, Noir and more', 'src/lib/image-generator/styles.ts:26-204', 'seed'),
  ('img_sizes', 'image_generator', 'Images in square, 16:9 and 9:16', 'Aspect ratios only', 'https://www.tryzyvo.com/image-generator', 'seed'),
  ('free_plan', 'pricing', 'Start free: 5 image generations every 30 days, no card', 'Video tools need a paid plan; free images carry a small Zyvo mark', 'src/data/freePlan.js:11', 'seed'),
  ('paid_credits', 'pricing', 'Paid plans with 750, 1,600 or 3,200 credits a month', 'Starter, Pro, Generative', 'https://www.tryzyvo.com/pricing', 'seed'),
  ('refund_7d', 'pricing', 'Not happy in 7 days? Unused credits refunded', 'As stated on the pricing page', 'src/pages/Pricing.jsx:129', 'seed'),
  ('cost_upfront', 'pricing', 'See the credit cost before you start', 'A live quote in the summary panel', 'src/data/freePlan.js', 'seed'),
  ('no_autopost', 'not_feature', 'Zyvo does NOT post or schedule to social platforms', 'The publish suite is unreleased', 'src/data/unreleasedFeatures.js:22', 'seed'),
  ('no_youtube_upload', 'not_feature', 'Zyvo does NOT upload to YouTube for you', 'You download the video and copy the text', 'src/pages/workspace/long-form/publish/publishApi.js:12-19', 'seed'),
  ('no_blocky_series', 'not_feature', 'Blocky Stories does NOT make series (single videos only)', 'The series flag is off for everyone', 'src/data/blockyStories.js:15-20', 'seed'),
  ('no_other_languages', 'not_feature', 'Long Form is NOT available in other languages (English only)', 'The voice catalog is English only', 'src/lib/voiceCatalog.js:8', 'seed')
ON CONFLICT (key) DO NOTHING;

/* ─── accounts on ideas, runs, posts, analyses ───────────────────────── */
ALTER TABLE public.cm_ideas ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'creator';
ALTER TABLE public.cm_ideas DROP CONSTRAINT IF EXISTS cm_ideas_account_check;
ALTER TABLE public.cm_ideas ADD CONSTRAINT cm_ideas_account_check CHECK (account IN ('creator', 'zyvo'));
CREATE INDEX IF NOT EXISTS cm_ideas_account_created ON public.cm_ideas (account, created_at DESC);
UPDATE public.cm_ideas SET recipe = recipe || '{"account": "creator"}'::jsonb WHERE recipe IS NOT NULL AND NOT (recipe ? 'account');

ALTER TABLE public.cm_runs ADD COLUMN IF NOT EXISTS account text CHECK (account IS NULL OR account IN ('creator', 'zyvo'));   -- NULL: both (the daily run)
ALTER TABLE public.cm_posts ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'creator' CHECK (account IN ('creator', 'zyvo'));
ALTER TABLE public.cm_analyses ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'creator' CHECK (account IN ('creator', 'zyvo', 'both'));

/* ─── formats and styles per lane ────────────────────────────────────── */
ALTER TABLE public.cm_library ADD COLUMN IF NOT EXISTS lanes text[] NOT NULL DEFAULT '{creator}';
UPDATE public.cm_library SET lanes = '{creator,zyvo}' WHERE kind = 'hook';

INSERT INTO public.cm_library (kind, key, name, description, spec, lanes, source) VALUES
  ('format', 'feature_hero', 'Feature hero', 'A big benefit headline with 2–3 real outputs (labelled) and one callout, then proof slides.', '{"slides": [4, 6], "layout": "zyvo"}', '{zyvo}', 'owner'),
  ('format', 'style_grid', 'Style grid', '"Pick a look": up to 8 real outputs labelled by style or template.', '{"slides": [4, 5], "layout": "zyvo"}', '{zyvo}', 'owner'),
  ('format', 'how_it_works', 'How it works 1-2-3', 'Rebuilt Zyvo UI: type an idea, what Zyvo does (from the fact sheet), the finished video.', '{"slides": [5, 6], "layout": "zyvo"}', '{zyvo}', 'owner'),
  ('format', 'feature_spotlight', 'Feature spotlight', 'One feature per slide, each with its real outputs and one fact.', '{"slides": [4, 6], "layout": "zyvo"}', '{zyvo}', 'owner'),
  ('format', 'prompt_result', 'Prompt → result', 'The exact recorded prompt, then the real output it made (only assets with a recorded prompt).', '{"slides": [4, 5], "layout": "zyvo", "requires": "asset_prompts"}', '{zyvo}', 'owner'),
  ('format', 'template_showcase', 'Template showcase', 'Real outputs from the short-form templates, labelled by template.', '{"slides": [4, 6], "layout": "zyvo"}', '{zyvo}', 'owner'),
  ('format', 'by_hand_vs_zyvo', 'By hand vs with Zyvo', 'The manual steps vs what Zyvo does (from the fact sheet). Never names another tool.', '{"slides": [4, 5], "layout": "zyvo"}', '{zyvo}', 'owner'),
  ('style', 'zyvo_brand', 'Zyvo brand', 'Clean dark Zyvo look, one accent colour for highlighted words, the Zyvo footer on every slide.', '{"bg": "#090A0A", "fg": "#ffffff", "accent": "#BEF264", "highlight": "#BEF264", "accent2": "#9F5CFF", "card": "#151719", "font": "inter", "brand": true, "visual": "real Zyvo outputs and rebuilt Zyvo UI only"}', '{zyvo}', 'owner'),
  ('hook', 'benefit_promise', 'Benefit promise', 'States what the viewer gets, plainly.', '{"example": "One idea in. A finished video out."}', '{zyvo}', 'owner'),
  ('hook', 'show_the_result', 'Show the result', 'Opens on the finished output and asks "made from one idea?".', '{"example": "This whole video started as one sentence."}', '{zyvo}', 'owner')
ON CONFLICT (kind, key) DO UPDATE SET lanes = EXCLUDED.lanes, spec = EXCLUDED.spec, description = EXCLUDED.description, updated_at = now();

/* ─── assets: a recorded prompt (for "Prompt → result") ──────────────── */
ALTER TABLE public.cm_assets ADD COLUMN IF NOT EXISTS prompt text CHECK (prompt IS NULL OR length(prompt) <= 300);

/* ─── stats: link clicks (UTM) ───────────────────────────────────────── */
ALTER TABLE public.cm_post_stats ADD COLUMN IF NOT EXISTS link_clicks integer CHECK (link_clicks >= 0);

/* ─── renders: which slide templates drew them (the Outdated filter) ─── */
ALTER TABLE public.cm_generations ADD COLUMN IF NOT EXISTS layout_version integer;

COMMIT;
