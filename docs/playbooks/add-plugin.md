---
type: Playbook
title: Add a new plugin
description: Vendor another Herdr plugin from GitHub and host its mods in the base layout.
tags: [plugins, workflow]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Add a new plugin

1. Read its `RECIPE.md` and every file first. Record whether it reaches the network, runs programs (`exec`, `hc`) or reads outside its folder, and tell the owner before installing. This is a Herdr AGENTS.md rule.
2. Create `plugins/<name>/plugin.json` with `name`, `description`, `repo`, `ref`, `commit` (any value; `vendor --update` fixes it), `license`, `order`, `vendor` (paths to snapshot, including LICENSE/NOTICE), `install` (staged path -> home path), and optionally `keys` and `helpers`.
3. `python3 herdrcfg.py vendor <name> --update`.
4. Install destinations must not collide with Herdr's shipped names or another plugin's; build fails on a collision between plugins.
5. Install its mods, not its layout: leave `layouts/*` out of `install`. Read its layout in `upstream/` to learn which props and ids its mods expect.
6. Host it in `config/layouts/chowdr-herdr-ctrl.json` following [the base layout rules](/architecture/base-layout.md). If the mod assumes it owns the window, first patch it with an embedded mode selected by props.
7. Make it Monokai: mods should read colours from `theme()`. Patch hard-coded colours in the plugin (see [Modify a plugin](/playbooks/modify-plugin.md)).
8. `cmd-*` keys are macOS-only. Put Linux equivalents for the base layout in `config/keys.json` under `layout:chowdr-herdr-ctrl` (or `global`), avoiding plain ctrl+letters. A plugin's own `layout:<name>` section no longer applies.
9. Install, check, screenshot, then add a concept under `docs/plugins/`, update [the base layout page](/layouts/chowdr-herdr-ctrl.md) and add an entry in `dev-docs/log.md` when that local folder exists.
