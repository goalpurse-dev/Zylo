-- Shared generation-reference storage, idempotent credit ledger markers, and
-- retention cleanup for temporary provider inputs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generation-references', 'generation-references', false, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "generation_reference_insert_own" ON storage.objects;
CREATE POLICY "generation_reference_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'generation-references'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "generation_reference_delete_own" ON storage.objects;
CREATE POLICY "generation_reference_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'generation-references'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "generation_reference_select_own" ON storage.objects;
CREATE POLICY "generation_reference_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'generation-references'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS credits_charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS credits_refunded_at timestamptz;

UPDATE public.jobs
SET credits_charged_at = COALESCE(updated_at, created_at, now())
WHERE charged = true AND credits_charged_at IS NULL;

CREATE OR REPLACE FUNCTION public.list_expired_generation_references(p_retention interval DEFAULT interval '7 days')
RETURNS TABLE(object_name text) LANGUAGE sql SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT object.name
  FROM storage.objects object
  JOIN public.jobs job ON split_part(object.name, '/', 3) = job.id::text
  WHERE object.bucket_id = 'generation-references'
    AND split_part(object.name, '/', 1) = job.user_id::text
    AND split_part(object.name, '/', 2) = job.id::text
    AND job.status IN ('succeeded', 'failed', 'canceled')
    AND job.updated_at < now() - p_retention;
$$;

REVOKE ALL ON FUNCTION public.list_expired_generation_references(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_expired_generation_references(interval) TO service_role;

CREATE OR REPLACE FUNCTION public.reject_invalid_generation_job()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.provider = 'runware' AND NEW.type IN ('image', 'video') THEN
    IF NEW.id = '00000000-0000-0000-0000-000000000000'::uuid THEN
      RAISE EXCEPTION 'INVALID_JOB_ID' USING ERRCODE = '22023';
    END IF;
    IF btrim(COALESCE(NEW.prompt, '')) = '' THEN
      RAISE EXCEPTION 'MISSING_PROMPT' USING ERRCODE = '22023';
    END IF;
    IF NOT (
      COALESCE((NEW.input->>'width')::integer, 0) > 0 AND COALESCE((NEW.input->>'height')::integer, 0) > 0
    ) AND COALESCE(NEW.input->>'resolution', NEW.settings->>'size', '') = '' THEN
      RAISE EXCEPTION 'MISSING_DIMENSIONS' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION 'MISSING_DIMENSIONS' USING ERRCODE = '22023';
END;
$$;

DROP TRIGGER IF EXISTS reject_invalid_generation_job ON public.jobs;
CREATE TRIGGER reject_invalid_generation_job
BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.reject_invalid_generation_job();

CREATE OR REPLACE FUNCTION public.reject_local_reference_urls()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF to_jsonb(NEW)::text ~* '"(blob:|file:|data:image/)' THEN
    RAISE EXCEPTION 'REFERENCE_IMAGE_NOT_ACCESSIBLE' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_local_reference_urls ON public.jobs;
CREATE TRIGGER reject_local_reference_urls
BEFORE INSERT OR UPDATE OF input, settings ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.reject_local_reference_urls();

DROP TRIGGER IF EXISTS reject_local_reference_urls ON public.generation_queue;
CREATE TRIGGER reject_local_reference_urls
BEFORE INSERT OR UPDATE OF payload ON public.generation_queue
FOR EACH ROW EXECUTE FUNCTION public.reject_local_reference_urls();
