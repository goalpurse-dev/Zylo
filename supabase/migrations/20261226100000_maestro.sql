-- MAESTRO (docs/studio-v2-plan.md "Maestro"): the chat that answers, plans and makes any template. NOT RUN: the owner runs
-- it. Safe on live: three new tables, nothing existing changes. Every write goes through the edge function maestro-api
-- (service role), which checks the plan's daily message limit, sizes and ownership. RLS on, read-own policies only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.maestro_chats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'New chat',
  style_id    text,                                   -- the template the chat is about (the last one picked)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS maestro_chats_user ON public.maestro_chats (user_id, updated_at DESC) WHERE deleted_at IS NULL;

-- one row per turn: the user's message, or Maestro's whole answer (its tool calls + results + final text). `raw` holds the
-- exact API messages of that turn, replayed unchanged on the next turn (append-only: thinking blocks stay valid).
CREATE TABLE IF NOT EXISTS public.maestro_messages (
  id          bigserial PRIMARY KEY,
  chat_id     uuid NOT NULL REFERENCES public.maestro_chats (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  text        text NOT NULL DEFAULT '',               -- what the page shows
  template_id text,                                   -- a user message's /template tag
  cards       jsonb NOT NULL DEFAULT '[]'::jsonb,     -- plan / generate / quick cards in Maestro's answer
  raw         jsonb NOT NULL DEFAULT '[]'::jsonb,     -- the API messages of the turn
  model       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maestro_messages_chat ON public.maestro_messages (chat_id, id);

CREATE TABLE IF NOT EXISTS public.maestro_usage (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  chat_id     uuid,
  model       text,
  input_tokens  integer,
  output_tokens integer,
  cost_usd    numeric(10, 6),
  ok          boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maestro_usage_user ON public.maestro_usage (user_id, created_at DESC);

ALTER TABLE public.maestro_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS maestro_chats_read_own ON public.maestro_chats;
CREATE POLICY maestro_chats_read_own ON public.maestro_chats FOR SELECT TO authenticated USING (user_id = auth.uid() AND deleted_at IS NULL);

COMMIT;
