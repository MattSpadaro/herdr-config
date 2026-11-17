---
type: Playbook
title: Update an upstream plugin
description: Move a plugin's pin to a newer upstream commit and make its patches apply again.
tags: [patches, upgrade]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Update an upstream plugin

# Examples

    python3 herdrcfg.py vendor agent-ask --update             # tip of plugin.json "ref"
    python3 herdrcfg.py vendor flockbook --ref v0.14.0        # another tag/branch
    python3 herdrcfg.py vendor monokai --commit <sha>

`vendor` rewrites `upstream/` and the pin, then reports whether every patch still applies.

## When a patch no longer applies

1. `git stash` or keep the old patch file aside.
2. Move the failing patch and every later one out of `patches/`, and run `stage <plugin>`.
3. Reapply the intent by hand in `work/<plugin>` (read the old patch), then `mkpatch`; repeat for each later patch.
4. Agent Ask: patch `0002-no-model` must still remove every `exec("claude"` path. Grep the staged tree for it before installing.
5. Read the upstream CHANGELOG/RECIPE diff: Agent Ask's `tabs-asks` and Agent Columns' `agent-columns-chrome` are snapshot clones of Herdr's shipped mods and drift from Herdr's own updates.

Agent Columns: its layout is not installed. If upstream changed `layouts/agent-columns.json`, read the diff in `upstream/` and port what you want into `config/layouts/chowdr-herdr-ctrl.json` by hand.

Flockbook: the helper rebuilds automatically for a new commit (new cache dir). Check upstream's required Rust version and bump `rustup_toolchain` and the `cargo +<v>` argument together.
