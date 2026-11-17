---
type: Herdr Plugin
title: Agent Ask (Asks)
description: Detects questions and permission prompts from agents, lists them as cards in a side panel and answers them through hc.
tags: [agents, panel]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
resource: https://github.com/sachin-philip/herdr-agent-ask
sources:
  - id: ask-recipe
    resource: plugins/agent-ask/upstream/RECIPE.md
    title: herdr-agent-ask RECIPE.md
  - id: ask-engine
    resource: plugins/agent-ask/upstream/mods/tabs-asks/engine.js
    title: Asks detection engine
---

# Agent Ask

Pinned at `fa9b4f569e0b61ad72b7d6f84743dab28494300d` (branch `main`, version 0.3.0), MIT.

## What it installs

- `mods/tabs-asks`: a clone of Herdr's `tabs` mod (0.1.13) with an **Asks** button and badge, plus the detection `Engine`, ticked every 1 s. Detection lives here because the tab bar is always shown; a hidden stack child never starts.[^ask-recipe]
- `mods/asks`: the panel. It must be a child named `asks` of a stack named `panel-body` inside a column named `panel`.
- Not installed: `mods/spaces-asks` (replaced by [patch 0003 of Agent Columns](/plugins/agent-columns.md)) and `layouts/asks.json` (superseded by the base layout `chowdr-herdr-ctrl`).

## Patches

- `0001-linux-keys.patch`: adds `ctrl-shift-a -> tabs-asks.toggle` to `global`, keeping upstream's `cmd-shift-a` for macOS.
- `0002-no-model.patch`: removes every model call. `Engine.classify()` returns `null` without running anything, and the unused `SCHEMA` prompt constant is deleted. The `DEFAULTS` in both `state.js` copies become `classify: "off"`, `trailing_questions: false`, `log: "~/.config/herdr-app/decisions.md"`, so a missing or invalid `asks.json` cannot re-enable the model. Both `state.js` copies stay identical.
- `0003-extra-panel-buttons.patch`: `tabs-asks` takes `props.panels`, a list of `{id, label, icon}`; each becomes a panel button after Changes and counts as an enabled panel for the per-space memory. The base layout passes the Usage panel this way, so the plugin names no repository mod.

## How it works

1. Claude Code reports its question in its OSC status (`kind: question` or `kind: permission`). The engine parses that report and reads the screen with `hc read <t> --json` for option numbers and context. No model is used here.[^ask-engine]
2. Other agents: numbered options parsed from the screen. Upstream falls back to `claude -p` (Haiku) when parsing fails; here that path is removed by patch 0002, so the card is `UNCLEAR` with `Open terminal` only.
3. Finished turns ending in a plain-text question: upstream asks `claude -p` whether the agent waits on the person. That path is removed here. Such an agent simply shows Herdr's `done` status (Done column, sound and toast when not looked at) and waits for input in its terminal or in Flockbook's chat.
4. Answering: `hc keys <t> <n>` (+ `enter`) for dialogs, `hc send` for plain-text questions, after re-checking the agent still shows the same prompt. Nothing is answered without a click.
5. Each delivered answer is appended to the `log` path.

## Configuration in this repo

The owner decided that Asks must never use a model (2026-11-12). Option and permission dialogs are enough; plain-text questions are handled by reading the agent when it shows `done`. This is enforced in code by patch 0002, and `config/asks.json` repeats it explicitly. See [ADR 0004](/decisions/0004-asks-no-model.md).

## Known issues

- A typed answer was not sent (owner, 2026-11-13). Not investigated.

## Runtime surface

Runs `hc` (read/get/keys/send) and `sh -c` to append to the log. Never runs `claude` or any model. Reads `<home>/asks.json`. See [Privacy surface](/references/privacy-surface.md).

[^ask-recipe]: herdr-agent-ask RECIPE.md
[^ask-engine]: Asks detection engine
