// Which image each tag of the render app points to on Fly's registry (the digest of its manifest), so a
// deploy of ONE tag can be shown to have left the others alone:
//   blocky-final   Blocky Stories' final video and clip-frame machines
//   fruit-final    AI Fruit Story's final video machines
// Read only. The Fly token is read from the local fly login and never printed.
//   node scripts/blocky/flyImageTags.mjs [tag ...]        prints {tag: digest}
import { execFileSync } from "child_process";

const APP = process.env.FLY_APP || "zyvo-render";
const tags = process.argv.slice(2).length ? process.argv.slice(2) : ["blocky-final", "fruit-final", "latest"];
const fly = process.env.FLY_BIN || "fly";
const token = execFileSync(fly, ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\r?\n/).pop();
const auth = `Basic ${Buffer.from(`x:${token}`).toString("base64")}`;
const ACCEPT = "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json";
const out = {};
for (const tag of tags) {
  const res = await fetch(`https://registry.fly.io/v2/${APP}/manifests/${tag}`, { method: "HEAD", headers: { Authorization: auth, Accept: ACCEPT } });
  out[tag] = res.ok ? res.headers.get("docker-content-digest") : `HTTP ${res.status}`;
}
console.log(JSON.stringify(out, null, 1));
