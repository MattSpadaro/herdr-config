---
type: Architecture Decision Record
title: "0004: Asks never calls a model"
description: The Asks engine's claude -p classification is removed in code; only agent-reported dialogs and on-screen options become cards.
tags: [adr, privacy, agent-ask]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T17:00:00-03:00 }
verified:
  - { by: human:JPChowder, at: 2026-11-12T17:00:00-03:00 }
---

# Context

Upstream Asks sends an agent's last message, or its last 45 screen lines, to `claude -p` (Haiku) in two cases: to detect plain-text questions at the end of a turn, and to classify dialogs it cannot parse. Upstream defaults also write `docs/decisions.md` inside each agent's repository. A config-only opt-out is fragile, because `loadConfig()` falls back to model-enabled `DEFAULTS` whenever `asks.json` is missing or invalid.

# Decision

The owner decided that Asks must never use a model. Option and permission dialogs cover what they need. Plain-text questions are seen through Herdr's own `done` status, and the agent waits for input anyway. Agent Ask patch `0002-no-model.patch` makes `Engine.classify()` return `null` and flips `DEFAULTS` to `classify: "off"`, `trailing_questions: false`, with the log at `~/.config/herdr-app/decisions.md`.

# Consequences

- Cards: Claude Code question and permission dialogs (from its status report) and dialogs with numbered options on screen. Unparseable dialogs become `UNCLEAR` with `Open terminal`.
- Plain-text questions never become cards; the agent lands in the board's Done column, with Herdr's sound and toast when you are not looking at it.
- Re-vendoring Agent Ask must keep patch 0002 applying. If it fails, do not install until it is rebased: a fallback to upstream defaults re-enables the model.
