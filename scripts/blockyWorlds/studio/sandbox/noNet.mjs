// STUDIO MODE sandbox: the child process's network switch-off, loaded BEFORE the shot-check core (studio/shotCheck.mjs
// starts the child). Every way out of the process over the network throws: fetch, WebSocket, EventSource, net / tls
// sockets, http / https / http2 requests, dns lookups, udp sockets.
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import http2 from "node:http2";
import dns from "node:dns";
import dgram from "node:dgram";

const no = (what) => () => { throw new Error(`network is off in the shot-check sandbox (${what})`); };
for (const k of ["fetch", "WebSocket", "EventSource", "XMLHttpRequest"]) {
  try { Object.defineProperty(globalThis, k, { value: no(k), writable: false, configurable: false }); } catch { /* not defined in this Node */ }
}
const off = (obj, keys, label) => { for (const k of keys) { if (typeof obj?.[k] === "function") { try { Object.defineProperty(obj, k, { value: no(`${label}.${k}`), writable: false, configurable: false }); } catch { obj[k] = no(`${label}.${k}`); } } } };
off(net, ["connect", "createConnection", "createServer"], "net");
off(net.Socket.prototype, ["connect"], "net.Socket");
off(tls, ["connect", "createServer"], "tls");
off(http, ["request", "get", "createServer"], "http");
off(https, ["request", "get", "createServer"], "https");
off(http2, ["connect", "createServer", "createSecureServer"], "http2");
off(dns, ["lookup", "resolve", "resolve4", "resolve6", "resolveAny"], "dns");
off(dns.promises, ["lookup", "resolve", "resolve4", "resolve6", "resolveAny"], "dns.promises");
off(dgram, ["createSocket"], "dgram");
