---
type: Architecture Decision Record
title: "0006: Flockbook's chat as a per-terminal view in the base layout; flockbook layout removed"
description: The chat is hosted inside chowdr-herdr-ctrl and toggled per terminal; the separate flockbook layout is no longer installed.
tags: [adr, chat, flockbook, base]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T19:00:00-03:00 }
---

# Context

The owner wanted to switch an open terminal between its terminal view and a chat view like an AI chat app, without a separate layout. [ADR 0005](/decisions/0005-base-layout-integration-point.md) left Flockbook as the only plugin with its own layout. Its chat view is a mod view fed by the `flockbook-modfeed` helper, but it assumed it owned the window: it drew its own tab bar, selected a `screen` stack every 300 ms, and opened its sidebar at the window edge.

# Decision

The owner chose:

1. The choice is per terminal.
2. In split tabs, the chat takes the workspace and shows the focused pane's agent.
3. The `flockbook` layout is removed once the embedded chat works.

Implementation:

- Flockbook patch `0001-embedded-chat` adds `props.embed`. Its former patches `0001-monokai-theme` and `0002-linux-keys` only served the removed layout and were dropped. The plugin no longer installs `layouts/flockbook.json` or its keys.
- The base layout wraps `live-terminals` in the stack `term-view` with `term-chat`, and adds `view-switch` beside `cols-header` in `header-row`.
- A repository-owned mod, `config/mods/chowdr-herdr-ctrl`, keeps the list of chat terminals in shared state and selects the stack child. See [Per-terminal chat view](/architecture/chat-view.md).

# Alternatives considered

- **One global switch:** simpler, but a choice made for one agent would apply to every tab.
- **A mod pane per terminal (`pane.split {mod}`):** Herdr places mod panes beside a terminal, not in its place, so it does not switch views.
- **Chat in a floating window over the terminal:** it is not part of the layout and covers other panes.
- **The toggle inside Flockbook's patch:** a copy in a hidden stack child gets no commands, and the patch would have to know the base layout's ids, which [the base layout rules](/architecture/base-layout.md) forbid.

# Consequences

- Flockbook's Needs you, Overview, sidebar, phone page and floating terminal window are no longer reachable. The board and the Asks panel cover Needs you and Overview.
- The base layout depends on Flockbook's shared key `flockbook.screen` and on `props.embed`. A Flockbook update that renames them breaks the view, so recheck both on `vendor --update`.
- The `layout:flockbook` section was removed from the installed keys.json, with a backup. `layouts/.state/flockbook.json` is orphaned.
