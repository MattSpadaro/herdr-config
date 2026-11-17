---
type: Playbook
title: Install on a new machine
description: Steps to reproduce this Herdr setup on another computer.
tags: [install, onboarding]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Install on a new machine

Prerequisites: Herdr app 0.1.13+ installed and started once (it creates `~/.config/herdr-app`), `git`, `patch`, `python3` >= 3.9. For Flockbook's helper: `rustup` (the build installs Rust 1.90.0 side by side). The Usage dialog needs `python3` and `curl`.

# Examples

    git clone <this repo> ~/herdr-config
    cd ~/herdr-config
    ./install.sh                     # dry run, then install, then switch to chowdr-herdr-ctrl

    # or step by step
    python3 herdrcfg.py install --dry-run
    python3 herdrcfg.py install --switch chowdr-herdr-ctrl

    # without Rust (Flockbook chat will say the helper is missing)
    python3 herdrcfg.py install --no-helpers --switch chowdr-herdr-ctrl

If the dry run lists conflicts, the machine already has files with those names that this repo did not install. Inspect them, then either rename them or rerun with `--force`, which backs them up as `*.bak-<time>`.

On macOS the upstream `cmd-*` keys still apply. The Linux additions are harmless there.
