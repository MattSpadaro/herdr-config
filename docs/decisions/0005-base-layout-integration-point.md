---
type: Architecture Decision Record
title: "0005: chowdr-herdr-ctrl as the base layout for every plugin"
description: The primary layout moves out of the Agent Columns patch queue into a repository-owned layout that hosts all plugins.
tags: [adr, layout, integration]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T18:00:00-03:00 }
---

# Context

[ADR 0002](/decisions/0002-unified-primary-layout.md) built the primary layout as Agent Columns' layout plus a patch that embedded Agent Ask. That patch made one plugin's queue carry the integration of another, and each new plugin would add more of that coupling. Flockbook was added as a second whole-window layout instead, which splits the work across layouts. The owner asked that the primary layout be renamed `chowdr-herdr-ctrl` and serve as the base into which new plugins are installed, rather than adding layouts beside it.

# Decision

- The layout is `config/layouts/chowdr-herdr-ctrl.json`, owned by this repository and edited directly, without patches.
- Plugins install mods only. Agent Columns no longer installs `layouts/agent-columns.json`; its layout patches `0001-monokai-theme` and `0002-asks-panel-layout` were folded into the base and removed. `0003-spaces-asks-count` was renamed `0001-spaces-asks-count` and is unchanged.
- A plugin whose mod assumes it owns the window gets a patch for an embedded mode in its own queue. The base layout then hosts it.

# Alternatives considered

- **Rename only (install `layouts/agent-columns.json` under a new name):** a one-line change, but integration keeps accumulating in Agent Columns' patch queue.
- **A plugin entry with no upstream for the base:** consistent with `plugins/`, but needs `herdrcfg.py` support for local sources and adds nothing that `config/` does not already give.

# Consequences

- Plugin patch queues contain only changes to their own plugin, as [ADR 0001](/decisions/0001-vendor-plus-patches.md) intended.
- Upstream improvements to Agent Columns' layout must be ported by hand into the base. Its mods still update through the normal pin.
- The `layout:agent-columns` state in `layouts/.state/` is orphaned; Herdr ignores it.
- Flockbook remained a separate layout until its chat view had an embedded mode; [ADR 0006](/decisions/0006-per-terminal-chat-view.md) removed it.
