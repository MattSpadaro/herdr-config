---
type: Architecture
title: Base layout as the integration point
description: chowdr-herdr-ctrl is the one layout that composes every plugin; new plugins plug into it instead of shipping their own layout.
tags: [layout, integration, conventions, base]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T18:00:00-03:00 }
resource: config/layouts/chowdr-herdr-ctrl.json
---

# Base layout as the integration point

`chowdr-herdr-ctrl` is the layout this setup lives in. It is owned by this repository, in `config/layouts/chowdr-herdr-ctrl.json`, not by any plugin. Every plugin contributes mods; the base layout decides where those mods appear. See [ADR 0005](/decisions/0005-base-layout-integration-point.md) and the [node tree](/layouts/chowdr-herdr-ctrl.md).

## The two kinds of change

| Change | Where it goes | Mechanism |
|---|---|---|
| Behaviour or look of one plugin (theme, Linux keys, removing a feature, an option for embedding) | that plugin | a patch in `plugins/<name>/patches/` ([Modify a plugin](/playbooks/modify-plugin.md)) |
| Where a plugin's mods sit and how plugins appear together | the base layout | a direct edit of `config/layouts/chowdr-herdr-ctrl.json` |

A plugin patch never references another plugin's layout ids. The base layout may reference any installed mod by its folder name and props.

## Rules for a new plugin

1. Install its mods, not its layout. The upstream layout stays in `upstream/` as reference only and is left out of `install` in `plugin.json`.
2. Add it to the base layout as a block, a stack child, a panel child or a floating block. Prefer an existing container: the `panel-body` stack takes side panels, and the `work` column takes bars.
3. If the mod assumes it owns the whole window (it switches its own stack ids, draws its own title bar, watches the window edge), patch that plugin to add an embedded mode selected by props. Do not rename the base layout's ids to match the plugin.
4. Keys for the base layout go in `config/keys.json` under `layout:chowdr-herdr-ctrl`. A plugin's own `layout:<its-layout>` section stops applying once its layout is not installed.
5. Keep the ids the hosted mods drive (see the table below) when restructuring.

## Ids other mods drive

| Id | Driven by | How |
|---|---|---|
| `sidebar`, `cols-cards`, `workspace` | `agent-columns` | hide, show, resize |
| `panel`, `panel-body`; children `files`, `changes`, `asks` | `tabs-asks` | toggle, `layout.select` |
| `term-view`; children `live-terminals`, `term-chat` | `chowdr-herdr-ctrl` | `layout.select` |
| `panel`, `panel-body`; child `usage` | `agent-usage`, `tabs-asks` through `props.panels`, `agent-columns-chrome` through `props.usage` | `layout.select`, show, hide |
| `usage-strip` | `agent-usage` (strip, `props.block`) | `layout.resize` to fit its rows |

The root is a column: `main-row` (the whole window as before) over `sysstat`, a 28 px block with the external [sysstat](https://github.com/DarkoKuzmanovic/herdr-mods/tree/main/sysstat) mod (CPU, memory and GPU of the shown space's machine; installed by hand in `mods/sysstat`, not by `herdrcfg.py`). Root-only fields (`theme`, fonts, `titlebar`, `traffic_lights`, `preview`) stay on `root`.

## Repository-owned mods

Glue between plugins that needs code, not just placement, is a mod owned by this repository in `config/mods/<name>/`, for example `chowdr-herdr-ctrl`, which drives the [per-terminal chat view](/architecture/chat-view.md), and `agent-usage`, the [usage strip and panel](/architecture/agent-usage.md), and `folder-picker`, the [new space dropdown](/architecture/folder-picker.md) opened by the Spaces `+`. It may read plugins' shared keys and select the base layout's ids. Plugins never depend on it.

No plugin installs its own layout any more. Flockbook's was removed by [ADR 0006](/decisions/0006-per-terminal-chat-view.md).

## Origin

The JSON started as Agent Columns' `layouts/agent-columns.json` (Apache-2.0) with the former Agent Columns patches `0001-monokai-theme` and `0002-asks-panel-layout` applied. The preview SVG is that plugin's preview recoloured to Monokai. Upstream changes to that layout are not merged automatically; see [Update an upstream plugin](/playbooks/update-upstream.md).
