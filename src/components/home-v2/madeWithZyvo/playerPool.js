// At most MAX_PLAYING section videos play at once (Home is the first page people see). A card claims a slot
// when it wants to play; the oldest claim is told to stop when a fourth one arrives.
export const MAX_PLAYING = 3;
const active = []; // [{ id, stop }]

export function claim(id, stop) {
  release(id);
  active.push({ id, stop });
  while (active.length > MAX_PLAYING) active.shift().stop();
}

export function release(id) {
  const i = active.findIndex((a) => a.id === id);
  if (i >= 0) active.splice(i, 1);
}

/** The viewer opens: every card video stops. */
export function stopAll() {
  while (active.length) active.shift().stop();
}

export const playingCount = () => active.length;
