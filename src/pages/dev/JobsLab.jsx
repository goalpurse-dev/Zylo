// src/pages/dev/JobsLab.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createJob,
  listJobs,
  subscribeJob,
  simulateJob,
  cancelJob,
} from "../../lib/jobs";
import { useAuth } from "../../context/AuthContext";

export default function JobsLab() {
  const { user, loading } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [active, setActive] = useState(null);
  const [err, setErr] = useState(null);
  const unsubRef = useRef(null);

  // fetch list when logged in
  useEffect(() => {
    if (!user) return;
    refresh();
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [user]);

  async function refresh() {
    try {
      setErr(null);
      const data = await listJobs(25);
      setJobs(data);
    } catch (e) {
      console.error(e);
      setErr(e.message || String(e));
    }
  }

  async function newJob() {
    try {
      setErr(null);

      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      const job = await createJob("image", { prompt: "Tractor at sunset" }, null);

      setActive(job);

      // live updates for this job
      unsubRef.current = subscribeJob(job.id, (j) => {
        setActive(j);
        setJobs((prev) => {
          const idx = prev.findIndex((x) => x.id === j.id);
          if (idx === -1) return [j, ...prev];
          const copy = prev.slice();
          copy[idx] = j;
          return copy;
        });
      });

      // DEV: fake progress -> success
      simulateJob(job.id);
    } catch (e) {
      console.error(e);
      setErr(e.message || String(e));
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  if (!user) {
    return (
   
      <div className="p-6 space-y-3">
        <div className="text-lg font-semibold">Jobs Lab</div>
        <p className="text-sm text-black/70">
          You need to be signed in to create jobs.
        </p>
        <Link
          to="/login"
          className="inline-block rounded-full bg-blue-600 text-white px-4 py-2"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={newJob}
          className="rounded-full bg-blue-600 text-white px-4 py-2"
        >
          Create job
        </button>
        <button
          onClick={refresh}
          className="rounded-full border px-4 py-2"
          title="Fetch jobs from DB again"
        >
          Refresh
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {active && (
        <div className="rounded-xl border p-4">
          <div className="font-semibold mb-1">Active job</div>
          <div className="text-xs text-black/60 break-all">{active.id}</div>
          <div className="mt-2 text-sm">
            Status: <b>{active.status}</b> • Progress: <b>{active.progress}%</b>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => cancelJob(active.id).then(setActive).catch((e)=>setErr(e.message))}
              className="rounded-full border px-3 py-1.5 text-sm"
              disabled={["succeeded", "failed", "canceled"].includes(active.status)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-4">
        <div className="font-semibold mb-3">Recent jobs</div>
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="rounded-lg border p-3">
              <div className="text-xs text-black/60 break-all">{j.id}</div>
              <div className="text-sm">
                {j.type} • {j.status} • {j.progress}%
              </div>
            </div>
          ))}
          {!jobs.length && <div className="text-sm text-black/60">No jobs yet.</div>}
        </div>
      </div>
    </div>
  );
}
