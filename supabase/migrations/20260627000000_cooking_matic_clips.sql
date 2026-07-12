-- Create cooking_matic_generations if it doesn't exist, then add clips column
CREATE TABLE IF NOT EXISTS public.cooking_matic_generations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_name  text        DEFAULT 'dish',
  vibe_id    text        DEFAULT 'dark-moody',
  status     text        DEFAULT 'completed',
  scenes     jsonb       DEFAULT '[]'::jsonb,
  clips      jsonb       DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cooking_matic_generations_user_created
  ON public.cooking_matic_generations (user_id, created_at DESC);

ALTER TABLE public.cooking_matic_generations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cooking_matic_generations'
    AND policyname = 'Users manage own cooking generations'
  ) THEN
    CREATE POLICY "Users manage own cooking generations"
      ON public.cooking_matic_generations
      FOR ALL
      TO authenticated
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add clips column if it somehow exists without the column
ALTER TABLE public.cooking_matic_generations
  ADD COLUMN IF NOT EXISTS clips jsonb DEFAULT '[]'::jsonb;
