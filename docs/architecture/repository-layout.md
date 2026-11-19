---
type: Architecture
title: Repository layout
description: Directory structure of herdr-config and the ownership rule for each directory.
tags: [structure, conventions]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-17T09:15:00-03:00 }
---

# Repository layout

    herdr-config/
    ├── herdrcfg.py            build/install tool (Python 3 stdlib only)
    ├── install.sh             one-shot entry point for a new machine
    ├── config/                personal files, owned by this repo
    │   ├── settings.json      merged key by key into <home>/settings.json
    │   ├── keys.json          merged section by section into <home>/keys.json
    │   ├── asks.json          copied to <home>/asks.json (Agent Ask config)
    │   ├── layouts/chowdr-herdr-ctrl.{json,svg}   the base layout, edited directly
    │   ├── mods/chowdr-herdr-ctrl/   repository-owned glue mod (chat view switch)
    │   ├── mods/agent-usage/         repository-owned usage strip and panel
    │   ├── mods/folder-picker/       repository-owned new space folder dropdown
    │   └── flockbook/config.json
    ├── plugins/<name>/
    │   ├── plugin.json        repo, ref, pinned commit, vendor list, install map, keys, helpers
    │   ├── upstream/          pristine snapshot of the pinned commit, never edited by hand
    │   └── patches/NNNN-*.patch   unified diffs applied in order on top of upstream/
    ├── claude-hooks/          Claude Code hooks copied by hand into each machine's ~/.claude (session labels)
    ├── docs/                  this OKF bundle
    ├── build/                 generated (gitignored)
    └── work/                  editable staging trees (gitignored)

## Ownership rule

Every change to a third-party plugin lives in that plugin's own `patches/` directory. Nothing in `upstream/` is edited by hand, and no plugin's patch touches another plugin's files. Cross-plugin integration (for example, the Asks panel beside the Agent Columns board) is not a patch: it lives in the repository-owned base layout. See [Base layout as the integration point](/architecture/base-layout.md). See [ADR 0001](/decisions/0001-vendor-plus-patches.md).

### Runtime coupling between plugins

Not touching another plugin's files is necessary but not sufficient: a mod can still depend on another plugin at run time without any import. A patch therefore must not make its plugin read or write another plugin's `shared()` keys, read files under another plugin's `mods/<name>/` folder, or call another plugin's mods by name (`mod.open`, `openOverlay`, `<mod>.<command>`).

Cross-plugin integration goes through one of two channels:

- **Layout props.** The patch adds a generic, plugin-agnostic prop to its own mod, and the base layout fills it with the other plugin's name or key. Examples: Agent Columns `0002-new-space-overlay` (`props.newSpace.mod`, set to `folder-picker`) and Agent Ask `0003-extra-panel-buttons` (`props.panels`, set to the `agent-usage` panel).
- **A documented contract.** When a plugin's state is meant to be read by others, its key, value shape and owner are described in `docs/architecture/`, and readers depend only on that description. Example: [asks.state](/architecture/asks-state-contract.md), read by Agent Columns `0001-spaces-asks-count`.

Repository-owned mods in `config/mods/` may couple to plugins, since that is their purpose, but each such dependency is listed in the mod's architecture page.

Known exceptions, kept until they are reworked:

- filetree `0002-better-icons` reads `mods/better-icons/icons.json` and its SVGs by path; without Better Icons it falls back to plain glyphs.

Files that describe the person rather than a plugin (theme choice, personal keys, Asks behaviour, the base layout) live in `config/`.

## Related

- [Build pipeline](/architecture/build-pipeline.md)
- [Plugins](/plugins/index.md)
