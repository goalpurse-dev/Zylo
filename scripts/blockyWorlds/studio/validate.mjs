// STUDIO MODE: the shot-code validator (runs before any code reaches the page). Shot code is the BODY of a function of
// `api`: it may use only `api.<member>` (studio/shotApi.js API), `Math.<fn>` (MATH) and its own local variables.
// A WHITELIST of syntax, checked on the parsed tree (esprima, from the engine's node_modules):
//   - no eval / Function / import / require / fetch / globals of any kind (every free name must be api, Math or a local)
//   - no `this`, `new`, function expressions, classes, try / throw, while / do, labels, template literals, regex, spread
//   - calls only to api.<whitelisted method> or Math.<whitelisted fn>
//   - member access by name only (never `x[expr]`, except a numeric literal or a for-loop counter index), and never a
//     name like constructor / __proto__ / prototype
//   - for loops only as `for (let i = <num>; i < <num <= 64>; i++)`; assignment only to locals
//   - at most LIMITS.codeChars characters
// -> { ok, errors: [string] }
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_NAMES, MATH, LIMITS } from "./shotApi.js";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../engine/package.json"));
const esprima = require("esprima");

const BAD_PROPS = new Set(["constructor", "__proto__", "prototype", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__", "caller", "callee", "arguments", "call", "apply", "bind", "valueOf", "toString"]);
const OK_NODES = new Set(["Program", "ExpressionStatement", "VariableDeclaration", "VariableDeclarator", "Identifier", "Literal", "ArrayExpression", "ObjectExpression", "Property", "BinaryExpression", "LogicalExpression", "UnaryExpression", "ConditionalExpression", "CallExpression", "MemberExpression", "IfStatement", "BlockStatement", "ReturnStatement", "ForStatement", "UpdateExpression", "AssignmentExpression", "EmptyStatement"]);

export function validateShotCode(code) {
  const errors = [];
  if (typeof code !== "string" || !code.trim()) return { ok: false, errors: ["empty code"] };
  if (code.length > LIMITS.codeChars) errors.push(`code is ${code.length} chars (max ${LIMITS.codeChars})`);
  let ast;
  try { ast = esprima.parseScript(`function __shot(api) {\n${code}\n}`, { range: false }); }
  catch (e) { return { ok: false, errors: [`syntax: ${e.description ?? e.message}${e.lineNumber ? ` (line ${e.lineNumber - 1})` : ""}`] }; }
  const fn = ast.body[0];
  const locals = new Set(), counters = new Set();
  // pass 1: every declared local (block scoping is not modelled: a name declared anywhere is a local)
  const collect = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(collect); return; }
    if (n.type === "VariableDeclarator" && n.id?.type === "Identifier") locals.add(n.id.name);
    for (const k of Object.keys(n)) if (k !== "type") collect(n[k]);
  };
  collect(fn.body);
  for (const name of ["api", "Math", "undefined", "NaN", "Infinity"]) if (locals.has(name)) errors.push(`"${name}" may not be redeclared`);
  const err = (msg) => { if (errors.length < 12) errors.push(msg); };
  // every for-loop counter name (a counter may never be assigned anywhere, so no loop can run forever)
  const loopNames = new Set(); let depth = 0;
  const findLoops = (n) => { if (!n || typeof n !== "object") return; if (Array.isArray(n)) { n.forEach(findLoops); return; } if (n.type === "ForStatement" && n.init?.type === "VariableDeclaration") for (const d of n.init.declarations) if (d.id?.type === "Identifier") loopNames.add(d.id.name); for (const k of Object.keys(n)) if (k !== "type") findLoops(n[k]); };
  findLoops(fn.body);
  const walk = (n, parent = null) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach((x) => walk(x, parent)); return; }
    if (!n.type) return;
    if (!OK_NODES.has(n.type)) { err(`not allowed: ${n.type}`); return; }
    switch (n.type) {
      case "VariableDeclaration": if (n.kind === "var") err("use const / let, not var"); break;
      case "VariableDeclarator": if (n.id.type !== "Identifier") err("destructuring is not allowed"); walk(n.init, n); return;
      case "Identifier": {
        // a bare name in an expression: a local, api, Math, or the constants
        if (!(locals.has(n.name) || ["api", "Math", "undefined", "NaN", "Infinity"].includes(n.name))) err(`unknown name "${n.name}" (only api.*, Math.* and your own const/let)`);
        return;
      }
      case "Literal": if (n.regex) err("regex literals are not allowed"); if (typeof n.value === "string" && n.value.length > 80) err("string literal too long"); return;
      case "Property": {
        if (n.computed || n.kind !== "init" || n.method) { err("object keys must be plain names"); return; }
        const key = n.key.type === "Identifier" ? n.key.name : String(n.key.value);
        if (BAD_PROPS.has(key)) err(`key "${key}" is not allowed`);
        walk(n.value, n); return;
      }
      case "MemberExpression": {
        if (n.computed) {
          const okIdx = (n.property.type === "Literal" && typeof n.property.value === "number") || (n.property.type === "Identifier" && counters.has(n.property.name));
          if (!okIdx) err("x[...] only with a number or a for-loop counter");
          walk(n.object, n); walk(n.property, n); return;
        }
        const prop = n.property.name;
        if (BAD_PROPS.has(prop)) { err(`".${prop}" is not allowed`); return; }
        if (n.object.type === "Identifier" && n.object.name === "api") { if (!API_NAMES.includes(prop)) err(`api.${prop} does not exist`); return; }
        if (n.object.type === "Identifier" && n.object.name === "Math") { if (!MATH.includes(prop)) err(`Math.${prop} is not allowed`); return; }
        walk(n.object, n); return; // a local's / a returned object's field (x, door, win, length...)
      }
      case "CallExpression": {
        const c = n.callee;
        const ok = c.type === "MemberExpression" && !c.computed && c.object.type === "Identifier" && ((c.object.name === "api" && API_NAMES.includes(c.property.name)) || (c.object.name === "Math" && MATH.includes(c.property.name)));
        if (!ok) { err("calls only to api.<method>(...) or Math.<fn>(...)"); return; }
        walk(n.arguments, n); return;
      }
      case "AssignmentExpression": case "UpdateExpression": {
        const target = n.type === "AssignmentExpression" ? n.left : n.argument;
        let base = target; while (base.type === "MemberExpression") { if (!base.computed && BAD_PROPS.has(base.property.name)) err("assignment to a forbidden key"); base = base.object; }
        if (base.type !== "Identifier" || !locals.has(base.name)) err("only your own const/let may be assigned");
        else if (counters.has(base.name) || loopNames.has(base.name)) err(`the loop counter "${base.name}" may not be changed`);
        if (n.type === "AssignmentExpression") { walk(n.left.type === "MemberExpression" ? n.left : null, n); walk(n.right, n); } else walk(n.argument.type === "MemberExpression" ? n.argument : null, n);
        return;
      }
      case "UnaryExpression": if (["delete", "typeof", "void"].includes(n.operator)) err(`"${n.operator}" is not allowed`); break;
      case "ForStatement": {
        const init = n.init, test = n.test, upd = n.update;
        const name = init?.type === "VariableDeclaration" && init.kind === "let" && init.declarations.length === 1 ? init.declarations[0].id.name : null;
        const okInit = name && init.declarations[0].init?.type === "Literal" && typeof init.declarations[0].init.value === "number";
        const okTest = test?.type === "BinaryExpression" && ["<", "<="].includes(test.operator) && test.left.type === "Identifier" && test.left.name === name && test.right.type === "Literal" && typeof test.right.value === "number" && test.right.value - (okInit ? init.declarations[0].init.value : 0) <= LIMITS.loopMax;
        const okUpd = upd?.type === "UpdateExpression" && upd.operator === "++" && upd.argument.name === name;
        if (!(okInit && okTest && okUpd)) { err(`for loops only as for (let i = 0; i < N; i++) with N <= ${LIMITS.loopMax}`); return; }
        counters.add(name);
        if (++depth > 2) err("at most 2 nested loops");
        walk(n.body, n); depth--; return;
      }
      default: break;
    }
    for (const k of Object.keys(n)) if (!["type", "range", "loc"].includes(k)) walk(n[k], n);
  };
  walk(fn.body.body);
  // counters are checked after the walk too (an index used before its loop)
  return { ok: errors.length === 0, errors };
}
