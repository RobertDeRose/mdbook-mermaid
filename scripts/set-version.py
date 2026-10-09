"""Cocogitto pre-bump hook: synchronize the package and lockfile versions."""

import re
import subprocess
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", sys.argv[1]):
        sys.exit("Usage: python3 scripts/set-version.py MAJOR.MINOR.PATCH")

    root = Path(__file__).resolve().parent.parent
    manifest = root / "Cargo.toml"
    original = manifest.read_text()
    lockfile = root / "Cargo.lock"
    original_lock = lockfile.read_bytes()
    updated, count = re.subn(
        r'(?m)^(version\s*=\s*")[^"]+("\s*)$',
        lambda match: match[1] + sys.argv[1] + match[2],
        original,
    )
    if count != 1:
        sys.exit("Expected exactly one package version in Cargo.toml")

    manifest.write_text(updated)
    try:
        subprocess.run(
            ["cargo", "update", "--offline", "--package", "mdbook-mermaid"],
            cwd=root,
            stdout=subprocess.DEVNULL,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        manifest.write_text(original)
        lockfile.write_bytes(original_lock)
        raise


if __name__ == "__main__":
    main()
