---
type: Architecture Decision Record
title: "0003: Build flockbook-modfeed from source with a pinned toolchain"
description: Helper compiled from the pinned tag with Rust 1.90.0 installed side by side.
tags: [adr, flockbook, rust]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Context

Flockbook's chat requires `flockbook-modfeed`. Releases ship prebuilt binaries; the owner chose to compile from source. The machine's default cargo (1.84.1) cannot build upstream (edition 2024 needs >= 1.85).

# Decision

Build at the pinned commit (`v0.13.0`) with `cargo +1.90.0 build --release --locked -p flockbook-modfeed`. `herdrcfg.py` installs that toolchain with rustup (`--profile minimal`) without touching the default toolchain. The mod is vendored from the same commit, so protocol versions match.

# Consequences

- First install on a machine takes a few minutes and needs network for crates.
- A source build reports `release: null` and never checks for updates.
- Updating Flockbook means bumping the pin for the mod and the helper together.
