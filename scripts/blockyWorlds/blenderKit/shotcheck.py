"""Blender kit engine: the cheap STATIC PRE-CHECK of a generated shots.py, before anything runs it (laptop / Fly worker
before upload, and the GPU worker again before Blender). It is a filter for obviously bad code, not the sandbox: the
code only ever runs inside the render sandbox (handler.py: render user, whitelisted env, seccomp network block,
boot.py, --offline-mode).
Rules (the kit's example shots.py files pass them unchanged):
  - imports: only `from shotkit import *`, `from rbx import ...`, `from rbx.<module> import ...`, `import math`,
    `import random`, `from mathutils import ...` (and `import math, random`)
  - names never used (reachable through the star import or builtins): os (except the chain os.path.join), sys, json,
    re, subprocess, socket, shutil, pathlib, ctypes, importlib, builtins, open, eval, exec, compile, __import__, globals,
    locals, vars, getattr, setattr, delattr, input, breakpoint, exit, quit, memoryview, type, help
  - no attribute or name that starts with "__" (no dunder tricks), no `bpy.ops` / `bpy.app` / `bpy.utils` / `bpy.path`
    (scene data through D / bpy.data / bpy.context only), no `global` / `nonlocal` of a forbidden name
  - no `while True` without a break, no lambda default trick reaching a forbidden name (covered by the name rule)
    python -I shotcheck.py <shots.py> [--json]   -> exit 0 = ok; problems listed with the shot they sit in"""
import ast
import json
import sys

ALLOWED_FROM = {"shotkit", "rbx", "mathutils", "math", "random"}
ALLOWED_IMPORT = {"math", "random"}
# names reachable without an import: shotkit's own module imports come in through `from shotkit import *` (os, sys,
# json, re, bpy) and the dangerous builtins; every other module is unreachable because imports are whitelisted
FORBIDDEN = {"os", "sys", "json", "re", "subprocess", "socket", "shutil", "pathlib", "ctypes", "importlib", "builtins",
             "open", "eval", "exec", "compile", "__import__", "globals", "locals", "vars", "getattr", "setattr", "delattr",
             "input", "breakpoint", "exit", "quit", "memoryview", "type", "help", "copyright", "credits", "license"}
BPY_FORBIDDEN = {"ops", "app", "utils", "path", "msgbus", "props", "types"}


def shot_of(tree):
    """line -> the shot id of the @S(id, ...) function it sits in"""
    spans = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            for d in node.decorator_list:
                if isinstance(d, ast.Call) and getattr(d.func, "id", None) == "S" and d.args and isinstance(d.args[0], ast.Constant):
                    spans.append((node.lineno, node.end_lineno, d.args[0].value))
    def f(line):
        for a, b, sid in spans:
            if a <= line <= b:
                return sid
        return None
    return f, len(spans)


def check(src):
    probs = []
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return [{"line": e.lineno, "shot": None, "problem": f"syntax error: {e.msg}"}], 0
    where, n = shot_of(tree)

    def bad(node, msg):
        probs.append({"line": getattr(node, "lineno", None), "shot": where(getattr(node, "lineno", 0) or 0), "problem": msg})

    parents = {}
    for node in ast.walk(tree):
        for ch in ast.iter_child_nodes(node):
            parents[ch] = node
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                if a.name not in ALLOWED_IMPORT:
                    bad(node, f"import {a.name} is not allowed")
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            if node.level or mod.split(".")[0] not in ALLOWED_FROM:
                bad(node, f"from {mod} import is not allowed")
            elif mod.split(".")[0] == "rbx" and any(a.name.startswith("_") and a.name != "*" for a in node.names):
                bad(node, "importing private kit names is not allowed")
        elif isinstance(node, ast.Name):
            if node.id == "__file__":  # only the kit's header line V = Video(__file__)
                p = parents.get(node)
                if not (isinstance(p, ast.Call) and getattr(p.func, "id", None) == "Video" and p.args == [node]):
                    bad(node, "__file__ is allowed only in V = Video(__file__)")
            elif node.id.startswith("__"):
                bad(node, f"name {node.id} is not allowed")
            elif node.id in FORBIDDEN:
                ok = False
                if node.id == "os":  # only os.path.join(...)
                    p = parents.get(node)
                    pp = parents.get(p)
                    ok = isinstance(p, ast.Attribute) and p.attr == "path" and isinstance(pp, ast.Attribute) and pp.attr == "join"
                if not ok:
                    bad(node, f"{node.id} is not allowed in shot code")
        elif isinstance(node, ast.Attribute):
            if node.attr.startswith("__"):
                bad(node, f"attribute .{node.attr} is not allowed")
            if isinstance(node.value, ast.Name) and node.value.id == "bpy" and node.attr in BPY_FORBIDDEN:
                bad(node, f"bpy.{node.attr} is not allowed (scene data via D / bpy.data / bpy.context only)")
        elif isinstance(node, (ast.Global, ast.Nonlocal)):
            for nm in node.names:
                if nm in FORBIDDEN or nm.startswith("__"):
                    bad(node, f"global {nm} is not allowed")
        elif isinstance(node, ast.While):
            if isinstance(node.test, ast.Constant) and node.test.value and not any(isinstance(x, ast.Break) for x in ast.walk(node)):
                bad(node, "while True without a break")
        elif isinstance(node, ast.Constant) and isinstance(node.value, str) and ("__" in node.value and ("class" in node.value or "import" in node.value)):
            bad(node, "string looks like a dunder escape")
    return probs, n


def main():
    path = sys.argv[1]
    src = open(path, encoding="utf-8").read()
    probs, n = check(src)
    if "--json" in sys.argv:
        print(json.dumps({"ok": not probs, "shots": n, "problems": probs}))
    else:
        for p in probs:
            print(f"line {p['line']} (shot {p['shot']}): {p['problem']}")
        print(f"{'OK' if not probs else 'FAILED'}: {n} shots, {len(probs)} problem(s)")
    sys.exit(0 if not probs else 1)


if __name__ == "__main__":
    main()
