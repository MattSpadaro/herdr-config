---
type: Tool
title: herdrcfg.py build pipeline
description: Subcommands of herdrcfg.py and the order in which build assembles the Herdr home tree.
tags: [tooling, build]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
resource: herdrcfg.py
---

# herdrcfg.py

Single-file Python 3 tool, standard library only. External programs it calls: `git`, `patch`, `diff`, `cargo`/`rustup` (only for helpers), `herdr-app` (only for checks and layout switch).

# Examples

    python3 herdrcfg.py vendor [plugin...] [--update | --ref REF | --commit SHA]
    python3 herdrcfg.py stage <plugin...>
    python3 herdrcfg.py mkpatch <plugin> <slug>
    python3 herdrcfg.py build [--no-helpers]
    python3 herdrcfg.py install [--dry-run] [--force] [--home DIR] [--switch LAYOUT] [--no-helpers] [--no-check]
    python3 herdrcfg.py uninstall [--dry-run] [--home DIR]

## Subcommands

- `vendor`: shallow-fetches the pinned commit into `~/.cache/herdr-config/src/<repo>-<sha>` (atomic: temp dir then rename), replaces `upstream/` with the paths listed in `plugin.json.vendor`, rewrites the pin, then verifies every patch still applies. `--update` moves to the tip of `ref`; for annotated tags the peeled commit is used.
- `stage`: writes `work/.base/<plugin>` (upstream + patches) and an identical editable copy `work/<plugin>`.
- `mkpatch`: diffs `work/.base/<plugin>` against `work/<plugin>` with `diff -ruN a/ b/`, writes the next `NNNN-<slug>.patch`, and advances the base so the next patch only contains new edits. Binary changes are refused. A file deleted in `work/` becomes a hunk that empties it; patches are applied with `patch --remove-empty-files`, so the file is removed rather than left empty.
- `build`: for each plugin in `order`: stage into `build/stage/<plugin>`, copy every `install` entry into `build/home`, collect its `keys` file, build its `helpers`. Then copy `config/` (except `settings.json`/`keys.json`), and write the merged overlays to `build/merge/`. Two plugins installing the same destination path is an error.
- `install`: see [Install semantics](/architecture/install-semantics.md).
- `uninstall`: removes every file recorded in the manifest whose hash still matches; leaves edited files, `keys.json` and `settings.json` alone.

## Helpers

`plugin.json.helpers[]` declares a compiled program: `workdir`, `command`, `artifact`, `dest`, optional `rustup_toolchain`. The source is the same pinned commit (from the cache). A toolchain is installed side by side with `rustup toolchain install <v> --profile minimal` and never replaces the default toolchain. The artifact is reused while it exists in the cache. See [Flockbook](/plugins/flockbook.md).

Optional `patches`: a folder in the plugin directory (Flockbook: `helper-patches/`) of `NNNN-<slug>.patch` files with paths from the source root (`a/xplat/...`). With patches, the cached source is copied (without `.git`, with its `target/`, so cargo builds incrementally) to `~/.cache/herdr-config/patched/<source>-<hash of the patches>`, the patches are applied in order, and the command always runs there (a no-op for cargo when nothing changed). Older patched copies of the same source are deleted. There is no `stage`/`mkpatch` for helpers: edit a copy of the source and write the patch with `diff -ruN`.

## Related

- [Repository layout](/architecture/repository-layout.md)
- [Modify a plugin](/playbooks/modify-plugin.md)
