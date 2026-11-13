# Blender kit engine: no network for a sandboxed program, enforced by the kernel. RunPod containers allow no namespaces
# (unshare: Operation not permitted, probe 2026-11-13), but any process may install a seccomp filter on itself after
# PR_SET_NO_NEW_PRIVS. This one (x86_64) lets socket() create AF_UNIX sockets only (EPERM for INET / INET6 / PACKET /
# NETLINK ...), refuses io_uring_setup (io_uring can open sockets without socket()) and the x32 syscall range, then execs
# the program. The filter is inherited by every child and cannot be removed.
#   python3 netblock.py -- <program> [args...]
import ctypes
import os
import struct
import sys

PR_SET_NO_NEW_PRIVS, PR_SET_SECCOMP, SECCOMP_MODE_FILTER = 38, 22, 2
AUDIT_ARCH_X86_64 = 0xC000003E
RET_KILL, RET_ALLOW, RET_EPERM = 0x80000000, 0x7FFF0000, 0x00050000 | 1
LD_W_ABS, JEQ_K, JGE_K, RET_K = 0x20, 0x15, 0x35, 0x06
NR_SOCKET, NR_IO_URING_SETUP, AF_UNIX = 41, 425, 1

# (code, jt, jf, k); jumps are relative to the next instruction
PROG = [
    (LD_W_ABS, 0, 0, 4),                   # 0  A = arch
    (JEQ_K, 1, 0, AUDIT_ARCH_X86_64),      # 1  x86_64 -> 3
    (RET_K, 0, 0, RET_KILL),               # 2  any other ABI: kill
    (LD_W_ABS, 0, 0, 0),                   # 3  A = syscall nr
    (JGE_K, 4, 0, 0x40000000),             # 4  x32 range -> 9 (EPERM)
    (JEQ_K, 3, 0, NR_IO_URING_SETUP),      # 5  io_uring_setup -> 9
    (JEQ_K, 0, 3, NR_SOCKET),              # 6  not socket() -> 10 (allow)
    (LD_W_ABS, 0, 0, 16),                  # 7  A = args[0] (domain, low 32 bits)
    (JEQ_K, 1, 0, AF_UNIX),                # 8  AF_UNIX -> 10
    (RET_K, 0, 0, RET_EPERM),              # 9  refuse
    (RET_K, 0, 0, RET_ALLOW),              # 10 allow
]


class SockFprog(ctypes.Structure):
    _fields_ = [("len", ctypes.c_ushort), ("filter", ctypes.c_char_p)]


def install():
    libc = ctypes.CDLL(None, use_errno=True)
    libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong]
    raw = b"".join(struct.pack("<HBBI", *ins) for ins in PROG)
    buf = ctypes.create_string_buffer(raw, len(raw))
    prog = SockFprog(len(PROG), ctypes.cast(buf, ctypes.c_char_p))
    if libc.prctl(PR_SET_NO_NEW_PRIVS, 1, None, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), "PR_SET_NO_NEW_PRIVS failed")
    if libc.prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, ctypes.cast(ctypes.pointer(prog), ctypes.c_void_p), 0, 0) != 0:
        raise OSError(ctypes.get_errno(), "PR_SET_SECCOMP failed")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--"]:
        args = args[1:]
    if not args:
        sys.exit("usage: netblock.py -- <program> [args...]")
    install()
    os.execvp(args[0], args)
