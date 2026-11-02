-- Content Machine, Studio v2 (Master Prompt v2, owner 2026-10-31): every Studio video picks ONE angle: a different
-- concept with its own structure, not a different line on the same footage. Editable in the Studio tab; the daily scout
-- or the agent may propose new ones (source = 'agent'). Additive.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.cm_studio_angles (
  key text PRIMARY KEY CHECK (key ~ '^[A-Z][0-9A-Za-z_]{0,20}$'),
  name text NOT NULL,
  viewer_gets text NOT NULL,                   -- why a stranger would care
  zyvo_role text NOT NULL,                     -- Zyvo is the answer, never the hook
  structure text NOT NULL DEFAULT '',          -- the shape of the script
  hooks text[] NOT NULL DEFAULT '{}',          -- example hooks (patterns: the writer makes new ones)
  length_bucket text NOT NULL DEFAULT '30-45' CHECK (length_bucket IN ('20-35', '30-45', '45-60', '60-90')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  source text NOT NULL DEFAULT 'owner' CHECK (source IN ('owner', 'agent')),
  sort integer NOT NULL DEFAULT 100,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cm_studio_angles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cm_studio_angles FROM PUBLIC, anon, authenticated;

INSERT INTO public.cm_studio_angles (key, name, viewer_gets, zyvo_role, structure, hooks, length_bucket, sort) VALUES
('A1', 'Trend teardown', 'The formula behind a trend (characters, drama, cliffhangers), explained with metaphors', 'The tool that makes them; a quick demo', 'A surprising fact → the formula in 3 parts, the last one what most people skip → a real example → reveal', ARRAY['Why do these AI fruit videos get so many views?', 'Why can''t people stop watching fruit cheat?'], '45-60', 1),
('A2', 'Famous-AI bridge', 'A real workflow they can copy: ask a famous AI for an idea, then make it', 'Step 2 of the workflow', 'I really asked (prompt and answer logged) → its pick and why → "but I can''t edit" → type it in → a real result', ARRAY['I asked Claude which video idea would go viral.', 'ChatGPT can write the script. But who makes the video?'], '30-45', 2),
('A3', 'Cheapest/fastest way', 'A real cost and time comparison, sourced', 'One honest option in the comparison', 'The money pain → options with sourced numbers → the catch → the pick', ARRAY['How do faceless channels make videos this cheap?', 'Stop paying an editor for this.'], '45-60', 3),
('A4', 'Myth bust', 'A myth and the truth', 'The proof', 'The myth everyone repeats → why it is wrong → the proof on screen', ARRAY['You don''t need After Effects for this.', 'You don''t need a camera or your own voice.'], '20-35', 4),
('A5', 'One-sentence challenge', 'A satisfying transformation', 'The tool', 'One sentence typed live → what comes out → the full result', ARRAY['I gave AI one sentence. Here''s the whole video.'], '20-35', 5),
('A6', 'Tutorial in 60 s', 'The real steps, big readable screens (a search title)', 'The tool', 'The search question → numbered steps with real screens → objections → the tip most people skip → a real result', ARRAY['How to make AI fruit videos', 'How do you make those AI fruit videos?'], '60-90', 6),
('A7', 'Idea list', 'Ideas they can steal (save-bait)', 'Makes one of them live', 'I have no ideas → a numbered list of real ideas → the last one, made', ARRAY['5 fruit drama ideas you can steal', 'Fruit drama ideas that would blow up'], '30-45', 7),
('A8', 'Story first', 'Entertainment: the drama itself with a cliffhanger', 'Caption + end card only', 'The whole drama from frame 0 → a cliffhanger → "made with Zyvo · part 2?"', ARRAY['She doesn''t know it''s her wedding.'], '30-45', 8),
('A9', 'Watch-along', 'Comedy: the cast reacts to a drama', 'The drama was made with Zyvo', 'Play a moment → react → play on → the punchline', ARRAY['We watched the messiest fruit drama so you don''t have to.'], '30-45', 9),
('A10', 'Things nobody tells you', 'Tips about faceless channels (save-bait)', 'One tip', 'What nobody tells you → numbered tips with props → the last is the best', ARRAY['Things nobody tells you about faceless channels'], '60-90', 10),
('A11', 'Honest fail', 'Relatable and useful: what went wrong and the fix', 'The tool + its edit feature', 'The AI messed this up → here''s the fix → the fixed result', ARRAY['The AI messed this up. Here''s the fix.'], '30-45', 11),
('A12', 'Niche showdown', 'A comparison: which faceless niche is easiest to start', 'The tool for each niche', 'Which niche? → compare with sourced facts → a pick', ARRAY['Which faceless niche is easiest to start?'], '45-60', 12)
ON CONFLICT (key) DO NOTHING;

COMMIT;
