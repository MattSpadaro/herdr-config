---
type: Reference
title: Keybindings
description: Keys this setup adds to keys.json, by section, and how they relate to Herdr's defaults.
tags: [keys]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Keybindings

Merged into `~/.config/herdr-app/keys.json`. Herdr's defaults (`ctrl-shift-t` new tab, `ctrl-shift-l` next layout, `ctrl-shift-b` toggle sidebar, `ctrl-1..9` tab, ...) remain.

| Section | Key | Action | Origin |
|---|---|---|---|
| global | `ctrl-shift-a` | `tabs-asks.toggle` (Asks panel) | agent-ask patch 0001 |
| global | `cmd-shift-a` | `tabs-asks.toggle` | agent-ask upstream |
| layout:asks | `cmd-shift-a` | `tabs-asks.toggle` | agent-ask upstream (layout not installed) |
| layout:chowdr-herdr-ctrl | `ctrl-shift-m` | `chowdr-herdr-ctrl.toggle-chat` (Terminal / Chat for the focused terminal) | `config/keys.json` |

Flockbook's keys are not merged: its `layout:flockbook` section applied only to the removed layout. `ctrl-shift-m` was chosen because it is not a Herdr default and avoids plain ctrl+letters, which terminal programs rely on. Unbound commands: `chowdr-herdr-ctrl.show-chat`, `chowdr-herdr-ctrl.show-terminal`.

Asks extra commands (unbound): `tabs-asks.open`, `tabs-asks.recheck`, `asks.accept` (works only while the panel is shown).
