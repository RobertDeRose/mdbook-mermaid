"""Exercise the release version hook using an isolated dependency-free package."""

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "set_version", Path(__file__).with_name("set-version.py")
)
set_version = importlib.util.module_from_spec(spec)
spec.loader.exec_module(set_version)


class SetVersionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.manifest = self.root / "Cargo.toml"
        self.lockfile = self.root / "Cargo.lock"
        self.manifest.write_text(
            '[package]\nname = "mdbook-mermaid"\nversion = "1.2.0"\nedition = "2021"\n'
        )
        (self.root / "src").mkdir()
        (self.root / "src/lib.rs").write_text("")
        subprocess.run(
            ["cargo", "generate-lockfile", "--offline"], cwd=self.root, check=True
        )
        location = patch.object(set_version, "__file__", str(self.root / "scripts/set-version.py"))
        location.start()
        self.addCleanup(location.stop)

    def bump(self, version):
        with patch.object(sys, "argv", ["set-version.py", version]):
            set_version.main()

    def test_updates_manifest_and_lockfile(self):
        manifest = self.manifest.read_text()
        lock = self.lockfile.read_text()
        self.bump("1.2.1")
        self.assertEqual(self.manifest.read_text(), manifest.replace('"1.2.0"', '"1.2.1"'))
        self.assertEqual(self.lockfile.read_text(), lock.replace('"1.2.0"', '"1.2.1"'))
        self.bump("1.2.1")
        self.assertEqual(self.lockfile.read_text(), lock.replace('"1.2.0"', '"1.2.1"'))

    def test_rejects_invalid_versions_without_writes(self):
        manifest = self.manifest.read_bytes()
        lock = self.lockfile.read_bytes()
        for version in ["v1.2.1", "1.2", "01.2.1", "1.2.1-beta.1", "1.2.1; echo unsafe"]:
            with self.subTest(version=version), self.assertRaises(SystemExit):
                self.bump(version)
        self.assertEqual(self.manifest.read_bytes(), manifest)
        self.assertEqual(self.lockfile.read_bytes(), lock)

    def test_rejects_ambiguous_manifest(self):
        original = self.manifest.read_text() + '\n[other]\nversion = "2.0.0"\n'
        self.manifest.write_text(original)
        with self.assertRaises(SystemExit):
            self.bump("1.2.1")
        self.assertEqual(self.manifest.read_text(), original)

    def test_restores_files_when_cargo_fails(self):
        manifest = self.manifest.read_bytes()
        lock = self.lockfile.read_bytes()

        def fail(*args, **kwargs):
            self.lockfile.write_text("partial lockfile update")
            raise subprocess.CalledProcessError(1, "cargo")

        with patch.object(set_version.subprocess, "run", side_effect=fail):
            with self.assertRaises(subprocess.CalledProcessError):
                self.bump("1.2.1")
        self.assertEqual(self.manifest.read_bytes(), manifest)
        self.assertEqual(self.lockfile.read_bytes(), lock)


if __name__ == "__main__":
    unittest.main()
