---
type: Herdr Plugin
title: Agent Columns
description: Board of agents as cards in status columns over the live terminal workspace; its mods are hosted by the base layout.
tags: [agents, board]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
resource: https://github.com/elied-dev/herdr-agent-columns
sources:
  - id: columns-recipe
    resource: plugins/agent-columns/upstream/RECIPE.md
    title: herdr-agent-columns RECIPE.md
---

# Agent Columns

Pinned at `376da6301221bef23dc88027140005e62c2919bb` (branch `main`), Apache-2.0.

## What it installs

Only the mods `agent-columns` (board, header and pane header by `props.role`), `agent-columns-chrome` (a `workspace-chrome` 0.1.11 clone without the fold button), and `agent-columns-spaces` (spaces with nested tabs). `agent-columns-usage` (Usage dialog) is vendored but not installed: it reads agent credentials and calls undocumented usage endpoints, which [ADR 0007](/decisions/0007-usage-from-statusline-tap.md) rejected; the repository's [agent-usage](/architecture/agent-usage.md) panel replaces it.[^columns-recipe] Its `layouts/agent-columns.json` is vendored for reference but not installed; the [base layout](/layouts/chowdr-herdr-ctrl.md) started from it.

## Patches

1. `0001-spaces-asks-count.patch`: `agent-columns-spaces` shows a pill with the count of pending asks per space, read from `shared("asks.state")` under the [asks.state contract](/architecture/asks-state-contract.md): every `pending` ask counts, `UNCLEAR` included, the same as the tab bar badge.
2. `0002-new-space-overlay.patch`: with `props.newSpace = {mod, width?, height?, props?}`, the `+` beside "Spaces" opens that mod as a popup instead of running `space.new`. The base layout points it at the [folder picker](/architecture/folder-picker.md).
3. `0003-usage-button-prop.patch`: the sidebar footer's Usage button comes from `props.usage = {icon, label?, run: [{name, args?}]}` and runs those commands in order; without the prop there is no button. Upstream opened `agent-columns-usage`. The base layout points it at the `agent-usage` panel.
4. `0004-keep-split-board-height.patch`: choosing Split keeps a board height the user dragged; it resets `cols-cards` to 355 px only when coming from Board (weight size) or when no px size is set. The base layout makes `board-area` resizable so the board/terminal boundary can be dragged.
5. `0005-pane-header-buttons.patch`: the pane header (`role: "pane"`) ends with two traffic lights: yellow runs `pane.zoom` (full screen, click again to restore) and red runs `pane.close` (ends the terminal). `config/keys.json` also binds `ctrl-t` to `pane.split:right` in this layout.
6. `0006-smaller-pane-lights.patch`: the traffic lights are 6 px dots (the status dot's size) in 14 px hit areas, and the status dot is drawn only when the pane has a known agent state (no grey dot).
7. `0007-animated-pane-lights.patch`: the lights are 8 px with a hover halo; a click springs the dot to 13 px (overshoot) and runs the command 160 ms later. The close light carries a black ✕, and the status dot moves next to the program name.
8. `0008-unseen-tint-apple-press.patch`: a card you have not seen (Herdr status `done`, or its column changed since it was last focused) gets its column color as a faint background (`1a`) and border (`66`). The pane lights squeeze to 6 px on press, spring to 14 px on release (response 380 ms, damping 0.55) and run their command 300 ms after the click.
9. `0009-newest-card-on-top.patch`: each column lists the agent that entered it most recently first (the `seq` recorded when its column changed); the agent order follows. The pane light pops to 11 px instead of 14.

The former layout patches (`0001-monokai-theme`, `0002-asks-panel-layout`) were folded into the base layout by [ADR 0005](/decisions/0005-base-layout-integration-point.md).

## Contract with the mod

The `agent-columns` mod hides, shows and resizes the ids `cols-cards`, `workspace` and `sidebar`. Keep those ids when editing the base layout. Board view resizes `cols-cards` to weight 1; Split restores 355 px.

## Runtime surface

No installed mod runs programs. The Usage dialog (`agent-columns-usage`), which ran `usage.py`, read `~/.claude/.credentials.json` (Linux) or the macOS keychain and `~/.codex/auth.json`, and called the Claude, Codex and Copilot usage endpoints with `curl`, is no longer installed.

## Watch out

- The Failed column uses a fixed `#ef4444`. It was left unpatched because Monokai's red is the same as `blocked`.
- Space avatar colors are the fixed palette shared with Herdr's shipped mods, not Monokai's, so they stay consistent with the `agents` list.

[^columns-recipe]: herdr-agent-columns RECIPE.md
