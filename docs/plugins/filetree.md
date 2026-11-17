---
type: Herdr Plugin
title: filetree
description: File tree with Tree and Recent views, git status, filter across unopened folders and in-panel previews; replaces Herdr's Files panel in the base layout.
tags: [files, git, panel]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T09:00:00-03:00 }
resource: https://github.com/cybertron288/herdr-mods/tree/main/filetree
sources:
  - id: filetree-recipe
    resource: plugins/filetree/upstream/filetree/RECIPE.md
    title: filetree RECIPE.md
  - id: filetree-readme
    resource: plugins/filetree/upstream/filetree/README.md
    title: filetree README.md
---

# filetree

Pinned at `34e7c3348e954fd0a1147b846898db8c3e37e526` (branch `main`) of `cybertron288/herdr-mods`, MIT. The repository holds several mods; only the `filetree/` folder is vendored.

## Patches

| Patch | Why |
|---|---|
| `0001-stat-c-locale` | The folder listing parses `stat -c '%F'`, whose type name is localized: under `LANG=pt_BR.UTF-8` it prints `diretório`, the mod expects `directory`, and every folder showed as a file. The listing script now starts with `export LC_ALL=C`. Upstream bug; affects any non-English locale. |
| `0002-better-icons` | Icons come from [Better Icons](/plugins/better-icons.md), the single icon source of this setup. Adds a byte-identical copy of Better Icons' `file-icons.js` and resolves through it; removes the bundled `icons.js` table and its licence file. Without the pack, filetree's own `file.svg`/`folder.svg` glyphs. |

## What it installs

- `mods/filetree`: the panel. Follows the focused terminal's folder; Tree and Recent views, branch summary with `+N -N` and a modified/new/deleted bar, filter over a one-time index of the whole folder, Markdown and code preview, right-click menu (preview, open, reveal, copy path, send `@path` to the tab's agent).[^filetree-recipe]
- Not installed: `mods/file-icons` (upstream's icon store, a duplicate of Better Icons). It stays in `upstream/` for reference.
- `mods/filetree/config.json`: upstream defaults (`activity`, `follow`, `column`, `open`). Changing them is a patch.

## Where it sits

The `files` child of the `panel-body` stack in the [base layout](/layouts/chowdr-herdr-ctrl.md) shows `filetree` instead of Herdr's shipped `files` mod. The child id stays `files`, so the Files button of `tabs-asks` keeps selecting it. Colors come from `theme()`, so Monokai applies without a patch.

## Not enabled

- The Claude Code hook `bridge.ts` (read/write/commit highlights, the Recent tab) is installed as a file but not registered in `~/.claude/settings.json`. It needs `bun`, which this machine does not have. Without it the Recent tab stays empty and everything else works.

## Icons

Upstream ships Material Icon Theme 5.40.0 twice in effect: `mods/file-icons` (1,184 SVGs, 4.8 MB) and [Better Icons](/plugins/better-icons.md) hold the same SVGs byte for byte (36 renamed `*.clone.svg` in Better Icons). Patch 0002 makes filetree read Better Icons, so the Files and Changes panels show identical icons from one folder. Better Icons' resolver follows the same VS Code rules, but checks at most two path parts for a path rule (enough for every rule in its table). Keep `file-icons.js` identical to Better Icons' when updating either plugin.

## Watch out

- It runs programs and reads the shown project folder; see the [privacy surface](/references/privacy-surface.md).
- The git calls are read-only and skip writes under `.git`; a write there would trip the folder watch into a refresh loop.[^filetree-recipe]
- Narrow panels hide the tab labels (under 300 px) and the date column (250 px or less).

[^filetree-recipe]: filetree RECIPE.md
