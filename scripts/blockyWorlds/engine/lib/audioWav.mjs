// AUDIO agent helpers (Node): 16-bit PCM WAV read/write and simple level tools.
import fs from "node:fs";

/** Write mono or stereo float samples (-1..1) as 16-bit PCM WAV. channels: Float32Array[] (1 or 2). */
export function writeWav(file, channels, sampleRate) {
  const nCh = channels.length;
  const n = channels[0].length;
  const buf = Buffer.alloc(44 + n * nCh * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * nCh * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(nCh, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * nCh * 2, 28); buf.writeUInt16LE(nCh * 2, 32);
  buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * nCh * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(Math.round(v * 32767), o); o += 2;
    }
  }
  fs.writeFileSync(file, buf);
}

/** Raw little-endian 16-bit mono PCM -> Float32Array. */
export function pcm16ToFloat(buf) {
  const n = buf.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

/** Read a 16-bit PCM WAV (first channel) -> { samples, sampleRate }. */
export function readWav(file) {
  const buf = fs.readFileSync(file);
  let p = 12, fmt = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString("ascii", p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { ch: buf.readUInt16LE(p + 10), sr: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === "data") {
      if (!fmt || fmt.bits !== 16) throw new Error("readWav: only 16-bit PCM");
      const n = Math.floor(size / (2 * fmt.ch));
      const s = new Float32Array(n);
      for (let i = 0; i < n; i++) s[i] = buf.readInt16LE(p + 8 + i * 2 * fmt.ch) / 32768;
      return { samples: s, sampleRate: fmt.sr };
    }
    p += 8 + size + (size & 1);
  }
  throw new Error("readWav: no data chunk");
}

/** RMS per frame (frameSec) -> Float32Array of linear RMS values. */
export function frameRms(samples, sampleRate, frameSec = 0.005) {
  const f = Math.max(1, Math.round(sampleRate * frameSec));
  const n = Math.ceil(samples.length / f);
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0, c = 0;
    for (let i = k * f; i < Math.min(samples.length, (k + 1) * f); i++) { s += samples[i] * samples[i]; c++; }
    out[k] = Math.sqrt(s / Math.max(1, c));
  }
  return out;
}
