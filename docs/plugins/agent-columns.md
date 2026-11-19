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
10. `0010-card-slide-and-focus-ring.patch`: a card that changes slot within its column glides from its old place (fresh element id, `top` offset, 420 ms ease-out transition). The focused agent keeps a ring in its column color. Seen/entered/slot memory lives at module level, so it survives the board being hidden (not a reload).
11. `0011-card-hover-lift-square-left.patch`: the slide moves to an outer slot (650 ms ease-out); the inner card lifts 2 px on hover with a spring (response 220 ms, damping 0.6). Cards are square on the left (the color bar replaces the left border) and rounded on the right, fixing the rounded border drawn around the square bar.
12. `0012-subtle-hover-nudge-wider-bar.patch`: hover no longer holds the card up; on pointer entry it springs up 1 px for 110 ms and back (response 260 ms, damping 0.75). The color bar is 5 px.
13. `0013-column-change-fold-and-draw.patch`: when an agent goes from Done to Working or Needs you, a ghost of its card stays in Done and folds right-to-left into its color bar (380 ms ease-in); then in the new column the bar draws downward (320 ms) and the card slides out of it to the right (380 ms). Column widths come from `on_size_change`. The hover nudge returns more slowly (response 340 ms, held 130 ms).
14. `0014-slower-column-change.patch`: the column-change effect takes about 1.6 s: fold 520 ms, bar 450 ms, slide out 520 ms.
15. `0015-column-change-everywhere.patch`: the fold-and-draw effect runs for every column change, from any column to any other; the ghost stays in the column the agent left.
16. `0016-stable-card-id-after-effect.patch`: the entering card gets a fresh element id once, when the effect starts, and keeps it afterwards, so the end of the effect no longer rebuilds the card (visible hitch). Ghost ids are prefixed `ghost-` so they never share an id with the entering card.
17. `0017-sequential-move-hover-clip.patch`: an arriving card takes no space until the ghost is gone; its slot then opens from 0 with the bar (height transition), slots carry the 9 px column gap themselves, and arriving cards are left out of the slide count (re-slotted silently when the effect ends). The column list has 2 px top padding so the hover nudge no longer clips the first card's top border.
18. `0018-zoom-aware-card-width.patch`: the measured column width is divided by the app zoom before it is used with `w()`, which the zoom scales; at zoom 1.1 the arriving card grew 10% too wide and snapped back.
19. `0019-windows-labelled-agents.patch`: terminals Herdr does not see as agents (Windows ConPTY drops OSC 7501) become cards when their terminal carries `cc.state` (`idle`, `working`, `blocked`, `done`) and `cc.seq` labels, set by a Claude Code hook on the notebook (`hc-agent-state.sh`). `done` turns `idle` once the pane is focused; clicking focuses the pane.
20. `0020-labelled-hermes-agent.patch`: a labelled terminal with `cc.agent=hermes` is drawn as Hermes (icon `icons/hermes.svg`) instead of Claude Code. `~/.local/bin/harry` sets it for Harry, Hermes on the notebook run over ssh; see [Agent usage](/architecture/agent-usage.md#labelled-agents).
21. `0021-card-shows-session-title.patch`: a card shows its terminal's title (Claude Code writes the session title there: `/rename` or the automatic one) instead of the tab name, so two agents in one tab read apart. Labelled agents keep the tab name, since their pane title is the Windows console's.
22. `0022-double-click-zoom-terminal-view.patch`: a second click on the pane header's yellow light within 1 s, in Split, keeps the pane zoomed and switches to Terminal view (board hidden), so only that terminal is left. The next click on the light unzooms and goes back to Split; switching views by hand in between forgets this state.
23. `0023-card-context-menu.patch`: right-clicking a card opens a popup (this mod, `role: "card-menu"`): the agent's name and what it is about (the newest of Claude's `away_summary` recap and its last reply's first paragraph, at most 140 characters / 3 lines, the full text in a tooltip, with its age), then Espiar, Marcar como não lida, Fixar no topo / Desafixar (`terminal.pin`; pinned cards sort first and show a pin), Copiar `claude --resume <id>`, Abrir terminal na pasta dele (`terminal.open` right of the agent, in its folder) and Fechar agente (Herdr's `confirm` dialog, then `terminal.kill`). The session comes from the [session labels](/architecture/session-labels-contract.md); the transcript tail is read with `exec` on the agent's machine. Unread marks live in `shared("agent-columns.unread")` (`{address: {wasFocused}}`) and clear when the card is focused again (after a blur, if marked while focused). Espiar opens a dialog (`frame: "none"`, 80% of the window) whose layout is three 1 px padded bands in the peek color (outside dark to inside light: lilac `#8b5cf6 #a78bfa #c4b5fd` for Done/Idle, orange `#ea580c #f97316 #fb923c` for Working, pink `#db2777 #ec4899 #f472b6` for Needs you/Failed) around a header (`role: "peek"`) and the agent's terminal block. The header shows a PRÉ-VISUALIZAÇÃO pill and three lights: yellow grows to the whole window and back, green closes the preview and focuses the agent, blue closes the preview only. Labels in these menus are Portuguese, as the owner asked.
24. `0024-peek-window-over-terminal.patch`: Espiar opens as a `window` overlay (not a dialog) placed exactly over the live terminal: below the board, whose bounds the board records on mouse move, inside the `workspace` padding, down to the window bottom less the root blocks under the main row (the sysstat bar). `at` is in window px while `width`/`height` are scaled by the app zoom. It is dragged by its header (the lights stop the press), a click beside it does not close it, and one preview replaces the last. Without a measure, or outside Split, it opens centered at 80%. Yellow grows it to the whole window (`at` 0,0) and back.
25. `0025-peek-resize-grip.patch`: the peek gets a 12 px bottom strip (`role: "peek-foot"`) with a ◢ grip. Herdr can't resize an overlay and a mod only hears the pointer while over itself, so pressing the grip opens a clear full-window layer (`role: "peek-resize"`) that follows the pointer and draws the new outline with its size; releasing (or clicking) reopens the peek at that place and size, right click cancels. Minimum 320 × 200. The top-left corner comes from the grip's bounds and the size the peek was opened with.

The former layout patches (`0001-monokai-theme`, `0002-asks-panel-layout`) were folded into the base layout by [ADR 0005](/decisions/0005-base-layout-integration-point.md).

## Contract with the mod

The `agent-columns` mod hides, shows and resizes the ids `cols-cards`, `workspace` and `sidebar`. Keep those ids when editing the base layout. Board view resizes `cols-cards` to weight 1; Split restores 355 px.

## Runtime surface

Agent Columns runs programs only from the card menu (patch 0023: the transcript tail). The Usage dialog (`agent-columns-usage`), which ran `usage.py`, read `~/.claude/.credentials.json` (Linux) or the macOS keychain and `~/.codex/auth.json`, and called the Claude, Codex and Copilot usage endpoints with `curl`, is no longer installed.

## Watch out

- The Failed column uses a fixed `#ef4444`. It was left unpatched because Monokai's red is the same as `blocked`.
- Space avatar colors are the fixed palette shared with Herdr's shipped mods, not Monokai's, so they stay consistent with the `agents` list.

[^columns-recipe]: herdr-agent-columns RECIPE.md
