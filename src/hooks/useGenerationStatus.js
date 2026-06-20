import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  getCreationDisplayStatus,
  getJobDisplayStatus,
  isActiveStatus,
} from "../lib/queueStatusUtils";

const POLL_INTERVAL_MS = 4000;

/**
 * Polls generation_queue rows for a parent generation, computes display status.
 * Falls back to a single jobs row if no queue rows exist.
 *
 * @param {object} opts
 * @param {string|null} opts.parentGenerationId - e.g. fruit_story_generations.id
 * @param {string|null} opts.jobId             - single jobs row id (image/video gen)
 * @param {boolean}     opts.enabled           - set false to pause polling
 */
export function useGenerationStatus({ parentGenerationId = null, jobId = null, enabled = true } = {}) {
  const [displayStatus, setDisplayStatus] = useState(null);
  const [queueJobs,     setQueueJobs]     = useState([]);
  const [rawJob,        setRawJob]        = useState(null);
  const pollRef  = useRef(null);
  const mountRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!enabled) return;

    // Strategy 1: fetch generation_queue rows by parent_generation_id
    if (parentGenerationId) {
      const { data: rows } = await supabase
        .from("generation_queue")
        .select("id, status, task_type, attempts, retry_after")
        .eq("parent_generation_id", parentGenerationId)
        .order("created_at", { ascending: true });

      if (!mountRef.current) return;

      if (rows && rows.length > 0) {
        setQueueJobs(rows);
        setDisplayStatus(getCreationDisplayStatus(rows));
        return;
      }
    }

    // Strategy 2: fall back to a single jobs row
    if (jobId) {
      const { data: job } = await supabase
        .from("jobs")
        .select("id, status, progress, attempts, retry_after")
        .eq("id", jobId)
        .single();

      if (!mountRef.current) return;
      if (job) {
        setRawJob(job);
        setDisplayStatus(getJobDisplayStatus(job));
        return;
      }
    }
  }, [parentGenerationId, jobId, enabled]);

  // Initial fetch + start polling
  useEffect(() => {
    mountRef.current = true;
    if (!enabled || (!parentGenerationId && !jobId)) return;

    fetchStatus();

    // Keep polling while status is active
    const scheduleNext = () => {
      pollRef.current = setTimeout(async () => {
        await fetchStatus();
        // Re-schedule only if still active
        const isActive = !displayStatus || isActiveStatus(displayStatus.tone);
        if (mountRef.current && isActive) scheduleNext();
      }, POLL_INTERVAL_MS);
    };

    scheduleNext();

    return () => {
      mountRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentGenerationId, jobId, enabled]);

  // Re-poll when display status changes and is still active
  useEffect(() => {
    if (!displayStatus) return;
    if (!isActiveStatus(displayStatus.tone)) {
      if (pollRef.current) clearTimeout(pollRef.current);
    }
  }, [displayStatus]);

  return {
    displayStatus,
    queueJobs,
    rawJob,
    isLoading: !displayStatus,
  };
}

/**
 * Lightweight hook: watches a single job row from the jobs table
 * and returns a DisplayStatus object with real status labels.
 *
 * @param {string|null} jobId
 */
export function useJobDisplayStatus(jobId) {
  const [displayStatus, setDisplayStatus] = useState(null);
  const [job, setJob]                     = useState(null);
  const mountRef = useRef(true);
  const pollRef  = useRef(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    const { data } = await supabase
      .from("jobs")
      .select("id, status, progress, attempts, retry_after")
      .eq("id", jobId)
      .single();

    if (!mountRef.current || !data) return;
    setJob(data);
    setDisplayStatus(getJobDisplayStatus(data));
  }, [jobId]);

  useEffect(() => {
    mountRef.current = true;
    if (!jobId) return;

    fetchJob();

    // Realtime subscription
    const channel = supabase
      .channel(`job-status-${jobId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "jobs",
        filter: `id=eq.${jobId}`,
      }, (payload) => {
        if (!mountRef.current) return;
        const data = payload.new;
        setJob(data);
        setDisplayStatus(getJobDisplayStatus(data));
      })
      .subscribe();

    // Polling fallback every 4s
    const poll = () => {
      pollRef.current = setTimeout(async () => {
        await fetchJob();
        const isActive = !displayStatus || isActiveStatus(displayStatus.tone);
        if (mountRef.current && isActive) poll();
      }, POLL_INTERVAL_MS);
    };
    poll();

    return () => {
      mountRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return { displayStatus, job };
}
