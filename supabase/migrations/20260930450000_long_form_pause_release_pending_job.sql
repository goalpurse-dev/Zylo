-- 2026-09-21 EMERGENCY (follow-up): at the moment the Sun project's
-- generation run (c0c18228-bd55-4a84-b6f2-eb16123db5fb) was paused, one
-- scene had already been claimed and enqueued into the shared `jobs` table
-- (job 91c9a445-5f8c-4618-951e-9777bdbb689f) but NOT yet picked up by the
-- generic job-worker: submission_state='pending', provider_task_id=null,
-- claimed_at=null. It has not been submitted to Runware.
--
-- The generic claim_generation_job() RPC that the job-worker uses is
-- shared by every Zyvo feature (image/video, all tools) and has no
-- knowledge of long_form generation runs — patching it to understand
-- long_form pause would be broad, unscoped surgery for a single affected
-- row. Instead we directly retire this one not-yet-submitted job before
-- the worker can claim it, and release its scene back to 'pending' so it
-- resumes cleanly (uncounted as a failure) once the user clicks Continue.
-- No Runware call is made or cancelled here — none was ever sent.

update public.jobs
set status = 'failed', error = 'long_form generation paused before provider submission', updated_at = now()
where id = '91c9a445-5f8c-4618-951e-9777bdbb689f' and status = 'queued' and submission_state = 'pending' and provider_task_id is null;

update public.long_form_scenes
set status = 'pending', job_id = null, claim_attempts = greatest(claim_attempts - 1, 0), lease_until = null, updated_at = now()
where id = '91c9a445-5f8c-4618-951e-9777bdbb689f' and generation_run_id = 'c0c18228-bd55-4a84-b6f2-eb16123db5fb';
