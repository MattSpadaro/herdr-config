---
type: Herdr Layout
title: Base layout (chowdr-herdr-ctrl)
description: Repository-owned base layout composing Agent Columns and Agent Ask in Monokai; the default and the place where new plugins are added.
tags: [layout, primary, composite, base]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T18:00:00-03:00 }
resource: config/layouts/chowdr-herdr-ctrl.json
---

# Base layout

Owned by this repository in `config/layouts/chowdr-herdr-ctrl.json` and installed to `~/.config/herdr-app/layouts/chowdr-herdr-ctrl.json`. It hosts the mods of [Agent Columns](/plugins/agent-columns.md) and [Agent Ask](/plugins/agent-ask.md). Theme `monokai`; terminal font size 13; `titlebar: none`. New plugins are added here; see [Base layout as the integration point](/architecture/base-layout.md).

## Node tree

    root (row, theme monokai)
    ├── sidebar (column 268px, chrome)
    │   ├── brand            agent-columns-chrome            46px
    │   ├── sidebar-lists
    │   │   ├── spaces       agent-columns-spaces (+asks pill) {newSpace: folder-picker}
    │   │   └── agents       agents (shipped)
    │   ├── usage-strip      agent-usage {role: strip, block}  104px, resized by the mod
    │   └── sidebar-footer   agent-columns-chrome {footer, usage}    69px
    └── work (column)
        ├── tabs             tabs-asks {panels: [usage]}      42px, window_drag
        ├── header-row (row 48px)
        │   ├── cols-header  agent-columns {role: header}
        │   └── view-switch  chowdr-herdr-ctrl                170px, Terminal / Chat
        └── work-body (row, 1px divider)
            ├── board-area (column)
            │   ├── cols-cards   agent-columns (board)        355px
            │   └── workspace (column, padding 14/24)
            │       └── term-view (stack, active live-terminals)
            │           ├── live-terminals  {tab: active}, pane header agent-columns {role: pane}
            │           └── term-chat       flockbook {view: chat, embed: true}, radius 7, border
            └── panel (column 368px, min 280, max 900, hidden, padding 8)
                └── panel-body (stack, active asks)
                    ├── files    filetree (plugin filetree)
                    ├── changes  better-changes (plugin better-changes)
                    ├── asks     asks
                    └── usage    agent-usage {role: panel}

## Why this shape

- `tabs-asks` sits on top and always shows, so the Asks engine always runs. It also draws the window buttons on platforms where `window().buttons` is true. Upstream Agent Columns has no bar that draws them.
- `tabs-asks` toggles the panel through the fixed ids `panel` / `panel-body` and the child ids `files`, `changes` and `asks`. The Files and Changes buttons follow `shared("workspace.panels")`.
- The `workspace-title` rail was dropped because the tab bar already shows the space's tabs.
- `term-view` and `view-switch` implement the [per-terminal chat view](/architecture/chat-view.md). `view-switch` must stay shown so its commands reach it.

## Editing

Edit the JSON directly; it is not a patch. Keep 2-space indentation and no trailing newline, and keep the ids listed in [the integration rules](/architecture/base-layout.md). Run `python3 herdrcfg.py install`; a `layouts/chowdr-herdr-ctrl.json.error` file means Herdr rejected it.

## Verified

After the rename, `herdr-app status` reported layout `chowdr-herdr-ctrl` with no errors, and a screenshot matched the former `agent-columns` layout. Before it, `herdr-app status` showed no errors. A screenshot showed the board in Monokai status colors, the Asks/Files/Changes buttons, and the Asks panel opening on the right at the Files width.

## Related

- [ADR 0005](/decisions/0005-base-layout-integration-point.md)
- [Per-terminal chat view](/architecture/chat-view.md)
- [Keybindings](/references/keybindings.md)
