-- Keep every generated/imported cooking voice take across refreshes and
-- remember which take the creator selected for captions/export.
ALTER TABLE public.cooking_matic_generations
  ADD COLUMN IF NOT EXISTS voice_takes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_voice_take_id text DEFAULT NULL;

-- Migrate the previously persisted single voice into the take collection.
UPDATE public.cooking_matic_generations
SET voice_takes = jsonb_build_array(
  voice || jsonb_build_object(
    'id', COALESCE(NULLIF(voice->>'id', ''), gen_random_uuid()::text),
    'createdAt', COALESCE(voice->>'createdAt', created_at::text)
  )
)
WHERE voice IS NOT NULL
  AND COALESCE(voice->>'audioUrl', '') <> ''
  AND jsonb_array_length(voice_takes) = 0;

UPDATE public.cooking_matic_generations
SET selected_voice_take_id = voice_takes->-1->>'id'
WHERE selected_voice_take_id IS NULL
  AND jsonb_array_length(voice_takes) > 0;

