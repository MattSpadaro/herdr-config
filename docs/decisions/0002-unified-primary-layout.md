---
type: Architecture Decision Record
title: "0002: Agent Columns + Asks as the primary layout; Flockbook separate"
description: Why Asks is merged into Agent Columns while Flockbook remains its own layout.
tags: [adr, layout]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Context

Herdr shows one layout at a time. Agent Columns and Agent Ask are both derived from Herdr's `main`. Flockbook replaces the whole window and its mod switches its own layout ids (`screen`, `sidebar`, `chat`, `tab`).

# Decision

The owner chose "Principal unificado": Agent Columns is patched to host the Asks bar (`tabs-asks`) and the panel stack (`files`, `changes`, `asks`). Flockbook stays a separate layout, also in Monokai, reached with `ctrl-shift-l`.

# Alternatives considered

- **Four separate layouts:** least divergence from upstream, but Asks and the board never show together.
- **Embed Flockbook's chat too:** requires rewriting the Flockbook mod's screen and sidebar logic, so updates become costly.

# Consequences

- The primary layout depends on two plugins. It references Agent Ask's mod names, so renaming them in Agent Ask breaks it.
- The board, the Asks engine and the window buttons live in one window.

# Amended

[ADR 0005](/decisions/0005-base-layout-integration-point.md) keeps this composition but moves it out of Agent Columns' patches into the repository-owned base layout `chowdr-herdr-ctrl`, and makes that layout the place where future plugins are added. [ADR 0006](/decisions/0006-per-terminal-chat-view.md) supersedes the Flockbook part: its chat is now a view inside the base layout and the `flockbook` layout is no longer installed.
