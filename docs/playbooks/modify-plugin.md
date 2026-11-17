---
type: Playbook
title: Modify a plugin
description: Change a vendored plugin through a new patch, keeping upstream pristine.
tags: [patches, workflow]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Modify a plugin

# Examples

    python3 herdrcfg.py stage agent-columns          # work/agent-columns = upstream + patches
    $EDITOR work/agent-columns/mods/agent-columns/main.js
    python3 herdrcfg.py mkpatch agent-columns short-slug
    python3 herdrcfg.py install
    git add plugins/agent-columns/patches && git commit

## Rules

- One patch per intent. Name it for the intent, not the file.
- Never edit `plugins/*/upstream/`; `vendor` overwrites it.
- To iterate fast, edit the installed copy in `~/.config/herdr-app/mods/<name>` (Herdr hot-reloads), then copy the final file into `work/<plugin>/` and run `mkpatch`. Install will refuse to overwrite the edited installed file until it matches the build again, or until you pass `--force`.
- Run `herdr-app check <mod dir>` and look at `herdr-app shot` before committing. `check` writes `gpui-kit.d.ts` and `jsconfig.json` into the mod folder; `mkpatch` ignores both, but delete them from `config/mods/*` before committing. Gotcha from upstream: gpui-kit setters reject `undefined`; use `.when(cond, el => ...)`.
- Layout JSON from upstream is serialised with `json.dumps(indent=2)` and no trailing newline; keep it that way so patches stay small.
- Placing a plugin's mods next to another plugin's is not a plugin change. Edit the [base layout](/architecture/base-layout.md) instead.
- To delete a patch, remove the file. Later patches may then fail to apply, so re-stage and regenerate them.
