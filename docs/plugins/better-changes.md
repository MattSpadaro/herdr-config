---
type: Herdr Plugin
title: Better Changes
description: Git panel with changes, staging, commits and history; clicking a file opens its diff in one reusable centre tab per space. Replaces Herdr's Changes panel in the base layout.
tags: [git, diff, panel]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T09:30:00-03:00 }
resource: https://github.com/munza/herdr-mods/tree/main/better-changes
sources:
  - id: bc-readme
    resource: plugins/better-changes/upstream/better-changes/README.md
    title: Better Changes README.md
  - id: bc-recipe
    resource: plugins/better-changes/upstream/better-changes/RECIPE.md
    title: Better Changes RECIPE.md
---

# Better Changes

Pinned at `860626068cb7e32a1db96b2f66baadc271d5667a` (branch `main`, mod version 2.5.0) of `munza/herdr-mods`, Apache-2.0. Only the `better-changes/` folder is vendored. Icons come from [Better Icons](/plugins/better-icons.md).

## Patches

| Patch | Why |
|---|---|
| `0001-place-none` | Upstream `mod.json` has `"place": "right"`, which makes Herdr dock a copy into the shown layout the first time it sees the folder. The base layout is repository-owned, so placement belongs in `config/layouts/chowdr-herdr-ctrl.json`. |

## Where it sits

- Panel: the `changes` child of `panel-body` shows `better-changes` instead of Herdr's shipped `changes`. The child id stays, so the Changes button of `tabs-asks` keeps selecting it.
- Diff: clicking a file runs `tab.new {space, name, mod: "better-changes", props: {mode: "diff", ...}}`. The tab is reused and renamed per space (`shared("better-changes.diff-tabs")`) and shows in `live-terminals`. The [chat view switch](/architecture/chat-view.md) always selects `live-terminals` while a mod pane has focus, otherwise the diff would hide behind the chat.

## What it does not do

- The diff is read-only: no editing, no discard, no hunk staging. Conflicts are shown, not resolved.[^bc-readme]
- No push or fetch; ahead/behind reads the last fetch.

## Watch out

- The diff tab's pane header is Agent Columns' (`role: pane`), which labels a mod pane "Terminal". Upstream's own one-row header is not used, since it would replace the header of every pane in the layout.
- `herdr-app check` only draws the empty state; list rows and the commit box are verified in the running app.[^bc-readme]
- Settings go in a `settings` block of the installed `mod.json`; changing them here is a patch.

[^bc-readme]: Better Changes README.md
