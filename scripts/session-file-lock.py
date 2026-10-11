"""POSIX advisory lock held until the parent's stdin pipe closes; no stale-lock deletion."""
import fcntl
import os
import stat
import sys

try:
    if len(sys.argv) != 1:
        raise ValueError()
    # fd 3 is inherited from the parent: both processes retain the same open
    # file description, so helper death cannot release the parent's lock.
    descriptor = 3
    if not stat.S_ISREG(os.fstat(descriptor).st_mode):
        raise ValueError()
    fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
    sys.stdout.write("LOCKED\n")
    sys.stdout.flush()
    while sys.stdin.buffer.read(4096):
        pass
except Exception:
    sys.stdout.write("UNAVAILABLE\n")
    sys.stdout.flush()
    sys.exit(1)
