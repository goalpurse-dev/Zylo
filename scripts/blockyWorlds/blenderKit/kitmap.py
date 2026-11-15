"""Blender kit engine: the TOOLKIT MAP for the director, generated from the kit's own code (never hand-written, so it
cannot drift from the kit). For every public top-level function and class (and the public methods of the classes) in
engine/rbx/*.py: the signature and a one-line purpose (the first docstring line, else the comment right above it).
    python -I kitmap.py <kit engine dir> <out.md>
Pure parsing (ast): the kit's code is read, never run."""
import ast
import os
import sys


def first_line(node, src_lines):
    doc = ast.get_docstring(node)
    if doc:
        return doc.strip().splitlines()[0].strip()
    ln = node.lineno - 2  # the comment right above the def (decorators excluded)
    while ln >= 0 and src_lines[ln].strip().startswith("@"):
        ln -= 1
    if ln >= 0 and src_lines[ln].strip().startswith("#"):
        return src_lines[ln].strip().lstrip("#").strip()
    return ""


def sig(fn):
    a = fn.args
    parts = []
    pos = a.posonlyargs + a.args
    defaults = [None] * (len(pos) - len(a.defaults)) + list(a.defaults)
    for p, d in zip(pos, defaults):
        if p.arg in ("self", "cls"):
            continue
        parts.append(p.arg + ("=" + ast.unparse(d) if d is not None else ""))
    if a.vararg:
        parts.append("*" + a.vararg.arg)
    elif a.kwonlyargs:
        parts.append("*")
    for p, d in zip(a.kwonlyargs, a.kw_defaults):
        parts.append(p.arg + ("=" + ast.unparse(d) if d is not None else ""))
    if a.kwarg:
        parts.append("**" + a.kwarg.arg)
    s = ", ".join(parts)
    return s if len(s) <= 160 else s[:157] + "..."


def main():
    eng, out = sys.argv[1], sys.argv[2]
    rbx = os.path.join(eng, "rbx")
    lines = ["# rbx toolkit map (generated from the kit's code: signature - purpose)",
             "Import names as the kit's shots.py files do: `from shotkit import *` gives core helpers, chars, acting, sets, locs, fx, "
             "W (world.py), W2 (world2.py); `from rbx import story` + `from rbx.story import *` gives the story helpers.", ""]
    alias = {"world": "W", "world2": "W2"}
    for name in sorted(os.listdir(rbx)):
        if not name.endswith(".py") or name.startswith("__"):
            continue
        mod = name[:-3]
        src = open(os.path.join(rbx, name), encoding="utf-8").read()
        src_lines = src.splitlines()
        tree = ast.parse(src)
        head = ast.get_docstring(tree)
        prefix = alias.get(mod, mod)
        lines.append(f"## {mod}.py (use as `{prefix}.name`" + (" or bare `name` via the star imports" if mod in ("core", "story") else "") + ")")
        if head:
            lines.append(head.strip().splitlines()[0])
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and not node.name.startswith("_"):
                lines.append(f"- {node.name}({sig(node)}) - {first_line(node, src_lines)}".rstrip(" -"))
            elif isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
                lines.append(f"- class {node.name} - {first_line(node, src_lines)}".rstrip(" -"))
                for m in node.body:
                    if isinstance(m, ast.FunctionDef) and (not m.name.startswith("_") or m.name == "__init__"):
                        nm = node.name if m.name == "__init__" else f"{node.name}.{m.name}"
                        lines.append(f"  - {nm}({sig(m)}) - {first_line(m, src_lines)}".rstrip(" -"))
            elif isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) and node.targets[0].id.isupper():
                v = ast.unparse(node.value)
                if len(v) <= 120:
                    lines.append(f"- {node.targets[0].id} = {v}")
        lines.append("")
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(out, len(lines), "lines")


main()
