#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PLUGINS_DIR = ROOT / "plugins"
CONFIG_DIR = ROOT / "config"
BUILD_DIR = ROOT / "build"
WORK_DIR = ROOT / "work"
CACHE_DIR = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "herdr-config"
MANIFEST_REL = ".herdr-config/manifest.json"
MERGED_JSON = ("settings.json", "keys.json")
GENERATED_BY_CHECK = ("gpui-kit.d.ts", "jsconfig.json")


class CfgError(RuntimeError):
    pass


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    res = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    if check and res.returncode != 0:
        raise CfgError(f"{' '.join(cmd)} failed ({res.returncode}):\n{res.stdout}{res.stderr}")
    return res


def read_json(path: Path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    tmp.replace(path)


def copy_path(src: Path, dst: Path) -> None:
    if src.is_dir():
        shutil.copytree(src, dst, dirs_exist_ok=True)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def iter_files(base: Path):
    for p in sorted(base.rglob("*")):
        if p.is_file():
            yield p


@dataclass
class Plugin:
    name: str
    dir: Path
    spec: dict

    @property
    def upstream(self) -> Path:
        return self.dir / "upstream"

    @property
    def patches(self) -> list[Path]:
        d = self.dir / "patches"
        return sorted(d.glob("*.patch")) if d.is_dir() else []


def load_plugins(names: list[str] | None = None) -> list[Plugin]:
    plugins = []
    for d in sorted(PLUGINS_DIR.iterdir()):
        spec_path = d / "plugin.json"
        if not spec_path.is_file():
            continue
        spec = read_json(spec_path)
        if names and spec["name"] not in names:
            continue
        plugins.append(Plugin(spec["name"], d, spec))
    if names:
        missing = set(names) - {p.name for p in plugins}
        if missing:
            raise CfgError(f"unknown plugin(s): {', '.join(sorted(missing))}")
    plugins.sort(key=lambda p: p.spec.get("order", 100))
    return plugins


def fetch_source(repo: str, commit: str) -> Path:
    dest = CACHE_DIR / "src" / f"{Path(repo).name}-{commit}"
    if dest.is_dir():
        head = run(["git", "rev-parse", "HEAD"], cwd=dest, check=False).stdout.strip()
        if head == commit:
            return dest
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix=f".{dest.name}-", dir=dest.parent))
    try:
        run(["git", "init", "-q"], cwd=tmp)
        run(["git", "remote", "add", "origin", repo], cwd=tmp)
        run(["git", "fetch", "-q", "--depth", "1", "origin", commit], cwd=tmp)
        run(["git", "checkout", "-q", "FETCH_HEAD"], cwd=tmp)
        tmp.rename(dest)
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    return dest


def resolve_ref(repo: str, ref: str) -> str:
    lines = [l.split("\t") for l in run(["git", "ls-remote", repo, ref]).stdout.splitlines() if l]
    if not lines:
        raise CfgError(f"ref {ref} not found in {repo}")
    peeled = [sha for sha, name in lines if name.endswith("^{}")]
    return peeled[0] if peeled else lines[0][0]


def apply_patches(plugin: Plugin, target: Path) -> None:
    for patch in plugin.patches:
        res = run(["patch", "-p1", "--batch", "--forward", "--no-backup-if-mismatch", "--remove-empty-files", "-r", "-",
                   "-d", str(target), "-i", str(patch)], check=False)
        if res.returncode != 0:
            raise CfgError(f"[{plugin.name}] patch {patch.name} does not apply:\n{res.stdout}{res.stderr}")


def stage_plugin(plugin: Plugin, target: Path) -> Path:
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(plugin.upstream, target)
    apply_patches(plugin, target)
    return target


def cmd_vendor(args) -> None:
    for plugin in load_plugins(args.plugins):
        spec = plugin.spec
        commit = args.commit or (resolve_ref(spec["repo"], args.ref or spec["ref"]) if args.update else spec["commit"])
        src = fetch_source(spec["repo"], commit)
        if plugin.upstream.exists():
            shutil.rmtree(plugin.upstream)
        for rel in spec["vendor"]:
            s = src / rel
            if not s.exists():
                raise CfgError(f"[{plugin.name}] {rel} missing upstream at {commit}")
            copy_path(s, plugin.upstream / rel)
        spec["commit"] = commit
        if args.ref:
            spec["ref"] = args.ref
        write_json(plugin.dir / "plugin.json", spec)
        log(f"[{plugin.name}] vendored {spec['repo']} @ {commit[:12]}")
        with tempfile.TemporaryDirectory() as tmp:
            stage_plugin(plugin, Path(tmp) / "stage")
        log(f"[{plugin.name}] {len(plugin.patches)} patch(es) apply cleanly")


def cmd_stage(args) -> None:
    for plugin in load_plugins(args.plugins):
        base = WORK_DIR / ".base" / plugin.name
        work = WORK_DIR / plugin.name
        stage_plugin(plugin, base)
        if work.exists():
            shutil.rmtree(work)
        shutil.copytree(base, work)
        log(f"[{plugin.name}] editable tree: {work}")


def cmd_mkpatch(args) -> None:
    plugin = load_plugins([args.plugin])[0]
    base = WORK_DIR / ".base" / plugin.name
    work = WORK_DIR / plugin.name
    if not base.is_dir() or not work.is_dir():
        raise CfgError(f"run `stage {plugin.name}` first")
    with tempfile.TemporaryDirectory() as tmp:
        a, b = Path(tmp) / "a", Path(tmp) / "b"
        a.symlink_to(base)
        b.symlink_to(work)
        excludes = [arg for name in GENERATED_BY_CHECK for arg in ("-x", name)]
        res = subprocess.run(["diff", "-ruN", *excludes, "a/", "b/"], cwd=tmp, text=True, capture_output=True)
    if res.returncode == 0:
        raise CfgError("no changes between staged base and work tree")
    if res.returncode != 1:
        raise CfgError(res.stderr)
    if "Binary files" in res.stdout:
        raise CfgError("binary changes cannot be expressed as patches; vendor the asset instead")
    pdir = plugin.dir / "patches"
    pdir.mkdir(exist_ok=True)
    num = len(plugin.patches) + 1
    out = pdir / f"{num:04d}-{args.name}.patch"
    lines = []
    for line in res.stdout.splitlines(keepends=True):
        if line.startswith(("--- ", "+++ ")):
            line = line.split("\t", 1)[0].rstrip("\n") + "\n"
        lines.append(line)
    out.write_text("".join(lines))
    shutil.rmtree(base)
    shutil.copytree(work, base)
    log(f"[{plugin.name}] wrote {out.relative_to(ROOT)}")


def helper_patches(plugin: Plugin, helper: dict) -> list[Path]:
    rel = helper.get("patches")
    return sorted((plugin.dir / rel).glob("*.patch")) if rel else []


def patched_source(plugin: Plugin, src: Path, patches: list[Path]) -> Path:
    if not patches:
        return src
    digest = hashlib.sha256(b"".join(p.name.encode() + p.read_bytes() for p in patches)).hexdigest()[:12]
    dest = CACHE_DIR / "patched" / f"{src.name}-{digest}"
    if dest.is_dir():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix=f".{dest.name}-", dir=dest.parent))
    try:
        shutil.copytree(src, tmp, symlinks=True, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git"))
        for patch in patches:
            res = run(["patch", "-p1", "--batch", "--forward", "--no-backup-if-mismatch", "--remove-empty-files", "-r", "-",
                       "-d", str(tmp), "-i", str(patch)], check=False)
            if res.returncode != 0:
                raise CfgError(f"[{plugin.name}] helper patch {patch.name} does not apply:\n{res.stdout}{res.stderr}")
        tmp.rename(dest)
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    for stale in dest.parent.glob(f"{src.name}-*"):
        if stale != dest and stale.is_dir():
            shutil.rmtree(stale, ignore_errors=True)
    return dest


def build_helpers(plugin: Plugin) -> dict[str, Path]:
    out = {}
    for helper in plugin.spec.get("helpers", []):
        patches = helper_patches(plugin, helper)
        src = patched_source(plugin, fetch_source(helper.get("repo", plugin.spec["repo"]),
                                                  helper.get("commit", plugin.spec["commit"])), patches)
        artifact = src / helper["artifact"]
        toolchain = helper.get("rustup_toolchain")
        if toolchain and not artifact.exists():
            if not shutil.which("rustup"):
                raise CfgError(f"[{plugin.name}] rustup is required to build with Rust {toolchain}")
            run(["rustup", "toolchain", "install", toolchain, "--profile", "minimal", "--no-self-update"])
        if not artifact.exists() or helper.get("always_rebuild") or patches:
            log(f"[{plugin.name}] building {helper['artifact']} (this can take minutes)")
            res = subprocess.run(helper["command"], cwd=src / helper.get("workdir", "."))
            if res.returncode != 0:
                raise CfgError(f"[{plugin.name}] helper build failed")
        out[helper["dest"]] = artifact
    return out


def cmd_build(args) -> Path:
    home = BUILD_DIR / "home"
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    home.mkdir(parents=True)
    keys_layers: list[dict] = []
    owners: dict[str, str] = {}
    for plugin in load_plugins():
        staged = stage_plugin(plugin, BUILD_DIR / "stage" / plugin.name)
        for src_rel, dst_rel in plugin.spec.get("install", {}).items():
            src = staged / src_rel
            if not src.exists():
                raise CfgError(f"[{plugin.name}] install source {src_rel} missing")
            files = [src] if src.is_file() else list(iter_files(src))
            for f in files:
                rel = Path(dst_rel) / f.relative_to(src) if src.is_dir() else Path(dst_rel)
                key = rel.as_posix()
                if key in owners:
                    raise CfgError(f"{key} installed by both {owners[key]} and {plugin.name}")
                owners[key] = plugin.name
                copy_path(f, home / rel)
        if plugin.spec.get("keys"):
            keys_layers.append(read_json(staged / plugin.spec["keys"]))
        if not args.no_helpers:
            for dst_rel, artifact in build_helpers(plugin).items():
                copy_path(artifact, home / dst_rel)
                (home / dst_rel).chmod(0o755)
                owners[dst_rel] = plugin.name
    for f in iter_files(CONFIG_DIR):
        rel = f.relative_to(CONFIG_DIR)
        if rel.as_posix() in MERGED_JSON:
            continue
        if rel.as_posix() in owners:
            raise CfgError(f"config/{rel} collides with plugin {owners[rel.as_posix()]}")
        copy_path(f, home / rel)
    keys_layers.append(read_json(CONFIG_DIR / "keys.json", {}))
    merged_keys: dict = {}
    for layer in keys_layers:
        for section, binds in layer.items():
            merged_keys.setdefault(section, {}).update(binds)
    write_json(BUILD_DIR / "merge" / "keys.json", merged_keys)
    write_json(BUILD_DIR / "merge" / "settings.json", read_json(CONFIG_DIR / "settings.json", {}))
    log(f"built {sum(1 for _ in iter_files(home))} files into {home.relative_to(ROOT)}")
    return home


def merge_into(dest: Path, overlay: dict, force: bool, nested: bool) -> tuple[dict, list[str]]:
    current = read_json(dest, {})
    conflicts = []
    merged = json.loads(json.dumps(current))
    for key, value in overlay.items():
        if nested and isinstance(value, dict):
            section = merged.setdefault(key, {})
            for k, v in value.items():
                if k in section and section[k] != v and not force:
                    conflicts.append(f"{dest.name}: [{key}] {k} = {section[k]!r} (kept; wanted {v!r})")
                    continue
                section[k] = v
        else:
            if key in merged and merged[key] != value and not force:
                conflicts.append(f"{dest.name}: {key} = {merged[key]!r} (kept; wanted {value!r})")
                continue
            merged[key] = value
    return merged, conflicts


def cmd_install(args) -> None:
    home_dst = Path(args.home or os.environ.get("HERDR_APP_HOME") or Path.home() / ".config/herdr-app").expanduser()
    if not home_dst.is_dir():
        raise CfgError(f"{home_dst} does not exist; start herdr-app once first")
    built = cmd_build(args)
    manifest_path = home_dst / MANIFEST_REL
    manifest = read_json(manifest_path, {"files": {}})
    old = manifest["files"]
    new_files = {f.relative_to(built).as_posix(): f for f in iter_files(built)}
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    plan, conflicts, backups = [], [], []
    for rel, src in new_files.items():
        dst = home_dst / rel
        new_hash = sha256(src)
        if not dst.exists():
            plan.append(("add", rel))
            continue
        cur = sha256(dst)
        if cur == new_hash:
            plan.append(("same", rel))
        elif old.get(rel) == cur:
            plan.append(("update", rel))
        elif args.force:
            backups.append(rel)
            plan.append(("replace", rel))
        else:
            conflicts.append(f"{rel}: exists and was not installed by herdr-config (or was edited since)")
    kept_helpers = ({h["dest"] for plugin in load_plugins() for h in plugin.spec.get("helpers", [])}
                    if args.no_helpers else set())
    removals = [rel for rel in old if rel not in new_files and rel not in kept_helpers
                and (home_dst / rel).exists() and sha256(home_dst / rel) == old[rel]]
    keys_merged, kc = merge_into(home_dst / "keys.json", read_json(BUILD_DIR / "merge/keys.json"), args.force, True)
    settings_merged, sc = merge_into(home_dst / "settings.json", read_json(BUILD_DIR / "merge/settings.json"), args.force, False)
    for action, rel in plan:
        if action != "same":
            log(f"  {action:8} {rel}")
    for rel in removals:
        log(f"  remove   {rel}")
    for c in kc + sc:
        log(f"  keep     {c}")
    if conflicts:
        raise CfgError("refusing to overwrite (use --force to back up and replace):\n  " + "\n  ".join(conflicts))
    if args.dry_run:
        log("dry run: nothing written")
        return
    for rel in backups:
        dst = home_dst / rel
        shutil.copy2(dst, dst.with_name(f"{dst.name}.bak-{stamp}"))
    for action, rel in plan:
        if action != "same":
            copy_path(new_files[rel], home_dst / rel)
    for rel in removals:
        (home_dst / rel).unlink()
    for name, data in (("keys.json", keys_merged), ("settings.json", settings_merged)):
        dst = home_dst / name
        if read_json(dst, {}) != data:
            if dst.exists():
                shutil.copy2(dst, dst.with_name(f"{name}.bak-{stamp}"))
            write_json(dst, data)
            log(f"  merged   {name}")
    write_json(manifest_path, {"installed_at": stamp, "source": str(ROOT),
                               "files": {**{rel: old[rel] for rel in kept_helpers if rel in old},
                                         **{rel: sha256(f) for rel, f in new_files.items()}}})
    if not args.no_check:
        check(home_dst, sorted({"/".join(rel.split("/")[:2]) for rel in new_files if rel.startswith("mods/")}))
    if args.switch:
        res = run(["herdr-app", "do", "layout.switch", "--name", args.switch], check=False)
        log(res.stdout.strip() or res.stderr.strip())
    log(f"installed into {home_dst}")


def check(home: Path, mod_dirs: list[str]) -> None:
    if not shutil.which("herdr-app"):
        log("herdr-app not on PATH: skipping checks")
        return
    env = dict(os.environ, HERDR_APP_HOME=str(home))
    failed = []
    for mod in mod_dirs:
        res = subprocess.run(["herdr-app", "check", str(home / mod)], env=env, text=True, capture_output=True)
        status = "ok" if res.returncode == 0 else "FAIL"
        log(f"  check {status:4} {mod}")
        if res.returncode != 0:
            failed.append(f"{mod}:\n{res.stdout}{res.stderr}")
    for err in sorted(home.glob("*.error")) + sorted((home / "layouts").glob("*.error")):
        failed.append(f"{err.relative_to(home)}: {err.read_text().strip()}")
    if failed:
        raise CfgError("checks failed:\n" + "\n".join(failed))


def cmd_uninstall(args) -> None:
    home_dst = Path(args.home or os.environ.get("HERDR_APP_HOME") or Path.home() / ".config/herdr-app").expanduser()
    manifest_path = home_dst / MANIFEST_REL
    manifest = read_json(manifest_path)
    if not manifest:
        raise CfgError(f"no manifest at {manifest_path}")
    for rel, digest in manifest["files"].items():
        p = home_dst / rel
        if not p.exists():
            continue
        if sha256(p) != digest:
            log(f"  kept     {rel} (edited after install)")
            continue
        log(f"  remove   {rel}")
        if not args.dry_run:
            p.unlink()
    if not args.dry_run:
        for d in sorted({(home_dst / r).parent for r in manifest["files"]}, key=lambda p: len(p.parts), reverse=True):
            if d.is_dir() and d != home_dst and not any(d.iterdir()):
                d.rmdir()
        manifest_path.unlink()
    log("keys.json and settings.json were left as they are (backups: *.bak-<time>)")


def main() -> int:
    ap = argparse.ArgumentParser(description="Build and install this Herdr app configuration.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("vendor", help="refresh plugins/<name>/upstream from the pinned (or a new) commit")
    p.add_argument("plugins", nargs="*")
    p.add_argument("--update", action="store_true", help="move to the latest commit of `ref`")
    p.add_argument("--ref", help="track another branch or tag")
    p.add_argument("--commit", help="pin an exact commit")
    p.set_defaults(fn=cmd_vendor)

    p = sub.add_parser("stage", help="materialise upstream + patches into work/<name> for editing")
    p.add_argument("plugins", nargs="*")
    p.set_defaults(fn=cmd_stage)

    p = sub.add_parser("mkpatch", help="turn edits in work/<name> into the next patch")
    p.add_argument("plugin")
    p.add_argument("name", help="patch slug, e.g. monokai-theme")
    p.set_defaults(fn=cmd_mkpatch)

    p = sub.add_parser("build", help="assemble build/home without touching the Herdr home")
    p.add_argument("--no-helpers", action="store_true")
    p.set_defaults(fn=cmd_build)

    p = sub.add_parser("install", help="build and install into the Herdr home")
    p.add_argument("--home")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--force", action="store_true", help="back up and replace conflicting files and keys")
    p.add_argument("--no-helpers", action="store_true")
    p.add_argument("--no-check", action="store_true")
    p.add_argument("--switch", metavar="LAYOUT", help="switch to this layout afterwards")
    p.set_defaults(fn=cmd_install)

    p = sub.add_parser("uninstall", help="remove every file the last install wrote and nobody edited")
    p.add_argument("--home")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(fn=cmd_uninstall)

    args = ap.parse_args()
    try:
        args.fn(args)
    except CfgError as e:
        log(f"error: {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
