// One video plays at a time on the Cutaway page: when a player starts, any other that is playing is paused.
// Players call claimPlayback(el) from their "play" event and releasePlayback(el) when they unmount.
let current = null;

export function claimPlayback(el) {
  if (current && current !== el && typeof current.pause === "function" && !current.paused) current.pause();
  current = el;
}

export function releasePlayback(el) {
  if (current === el) current = null;
}

export const playingNow = () => current;
