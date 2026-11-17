---
type: Reference
title: Herdr facts relied upon
description: Behaviours of Herdr app 0.1.15 that this setup depends on, from its AGENTS.md.
tags: [herdr, assumptions]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
stale_after: 2027-05-12T00:00:00Z
sources:
  - id: herdr-agents
    resource: ~/.config/herdr-app/AGENTS.md
    title: Herdr app AGENTS.md (rewritten on every start)
---

# Herdr facts relied upon

Verified against Herdr app 0.1.15 on Linux.[^herdr-agents]

- Layouts, keys, settings and mods hot-reload; invalid files leave `<name>.error` and the last good version keeps running.
- Shipped layouts and mods are replaced on every start. This repo never edits them; it adds new names only.
- A layout without `theme` uses `settings.json`'s theme. The Settings theme picker overrides any layout.
- A mod copy starts the first time its block is shown and stays alive while its block is in the layout. This is why the Asks engine lives in the always-visible tab bar.
- `<mod>.<command>` key actions reach shown copies only.
- Section precedence in keys.json: `terminal` > `layout:<name>` > `global`. Editing keys.json stops Herdr from upgrading it with new default shortcuts.
- Mods cannot import files from another mod's folder; shared helpers are duplicated (e.g. Agent Ask's `state.js` in two mods must stay identical).
- Escape hatch `ctrl-alt-shift-escape` always restores `main`.
- `herdr-app check`, `status` and `shot` are the verification tools.

[^herdr-agents]: Herdr app AGENTS.md (rewritten on every start)
