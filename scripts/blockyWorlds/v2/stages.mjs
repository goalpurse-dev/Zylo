// the stages by id (a row says which one it is on; Stage A when it says nothing)
import { STAGE_A } from "./stageA.mjs";
import { STAGE_B } from "./stageB.mjs";
export const STAGES = { A: STAGE_A, B: STAGE_B };
export const stageOf = (r, fallback = STAGE_A) => (r?.stage && STAGES[r.stage] ? { ...STAGES[r.stage], cameras: {} } : { ...fallback, cameras: {} });
