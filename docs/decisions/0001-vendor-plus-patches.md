---
type: Architecture Decision Record
title: "0001: Vendor upstream snapshots and keep changes as per-plugin patches"
description: Each plugin is a pinned pristine snapshot plus an ordered patch queue in its own directory.
tags: [adr, structure]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Context

The owner required that any combination or change to a plugin be done in isolation within that plugin. They also wanted the repository importable on another machine.

# Decision

Vendor pristine files at a pinned commit in `plugins/<name>/upstream/` and express every change as unified-diff patches in `plugins/<name>/patches/`, applied at build time by `herdrcfg.py`.

# Alternatives considered

- **Edited copies only:** simpler, but upstream and local intent become indistinguishable and updates turn into manual merges.
- **Fetch at install time, no vendoring:** smaller repo, but installs depend on upstream availability and patches could silently target a moved branch.
- **git submodules/subtree:** submodules need write access or forks to carry patches; subtree mixes histories.

# Consequences

- Upgrades are `vendor --update` plus re-applying failing patches; each patch documents one intent.
- Licences and notices travel with the snapshots (Apache-2.0, MIT).
- Binary assets cannot be patched; vendor a different asset instead.
