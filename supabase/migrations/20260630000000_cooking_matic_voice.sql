-- Persist the generated voiceover (voice id, script, hosted audio URL) on the
-- generation row so it survives reloads instead of living only in component state.
ALTER TABLE public.cooking_matic_generations
  ADD COLUMN IF NOT EXISTS voice jsonb DEFAULT NULL;
