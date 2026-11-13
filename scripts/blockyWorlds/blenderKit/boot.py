# Blender kit engine: the first script Blender runs (-P boot.py before the kit's render.py), inside Blender's Python.
# One layer of the render sandbox (README.md "Sandbox"): the scene code (today the kit's shots.py, later generated
# shot code) gets no network and cannot start other programs from Python. The outer layers are the worker's: Blender
# runs as the unprivileged user "render" with a whitelisted environment (no keys, no RunPod variables) and, where the
# container allows it, in a network namespace with no interfaces. This layer stays on even when the namespace is not
# available.
import os
import socket
import subprocess

_MSG = "disabled in the render sandbox"


def _refuse(*_a, **_k):
    raise PermissionError("network / processes are " + _MSG)


class _NoSocket(socket.socket):
    def __init__(self, family=-1, *a, **k):
        if family in (-1, socket.AF_INET, socket.AF_INET6):
            raise PermissionError("network is " + _MSG)
        super().__init__(family, *a, **k)


socket.socket = _NoSocket
socket.create_connection = _refuse
socket.getaddrinfo = _refuse
socket.gethostbyname = _refuse
socket.socketpair = _refuse
subprocess.Popen = _refuse
subprocess.run = _refuse
subprocess.call = _refuse
subprocess.check_call = _refuse
subprocess.check_output = _refuse
for _name in ("system", "popen", "execv", "execve", "execvp", "execvpe", "execl", "execle", "execlp", "execlpe",
              "spawnv", "spawnve", "spawnl", "spawnle", "posix_spawn", "posix_spawnp", "fork", "forkpty"):
    if hasattr(os, _name):
        setattr(os, _name, _refuse)
try:
    import bpy
    bpy.app.online_access  # read-only; --offline-mode on the command line keeps it False
except Exception:
    pass
print("SANDBOX boot: python network + subprocess disabled", flush=True)
