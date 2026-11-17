---
type: Herdr Plugin
title: Monokai
description: Monokai and Monokai Dimmed themes plus monokai-for-herdr, Herdr's main layout with the Monokai theme.
tags: [theme, visual-base]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
resource: https://github.com/pedroparra/herdr-monokai
sources:
  - id: monokai-recipe
    resource: plugins/monokai/upstream/RECIPE.md
    title: herdr-monokai RECIPE.md
---

# Monokai

Pinned at `a984dfd21d4c5b79eda99d1209ba62ce897e2186` (branch `main`), Apache-2.0. No patches.

## What it installs

- `themes/monokai.json`: background `#272822`, foreground `#f8f8f2`, chrome `#1e1f1c`, canvas `#232420`, accent `#fd971f`. Status colors derive from ANSI: working = ANSI 3 `#e6db74`, blocked = ANSI 1 `#f92672`, done = ANSI 4 `#66d9ef`.[^monokai-recipe]
- `themes/monokai-dimmed.json`: the quieter variant, offered in Settings -> Look.
- `layouts/monokai-for-herdr.json` (+ `.svg` preview): a copy of Herdr 0.1.14's `main` with `"theme": "monokai"`. Kept as a fallback layout that looks like stock Herdr.

## How it is the visual base

- `config/settings.json` sets `"theme": "monokai"` and `"appearance": "dark"`, so every layout that sets no theme (Herdr's `main`, `terminals`) renders in Monokai. Monokai has no light variant; `appearance: dark` keeps it on when the system is light.
- The [base layout](/layouts/chowdr-herdr-ctrl.md) sets `"theme": "monokai"` and has no status `colors` override, so Monokai's derived status colors apply. No third-party layout is installed.
- Herdr's theme picker overrides any layout's theme; picking another theme in Settings wins over all of this.

## Watch out

- Theme names must differ from layout names, otherwise Settings only offers the theme on the same-named layout.
- `monokai-for-herdr` is a snapshot of `main` 0.1.14 while this machine runs Herdr 0.1.15. Upstream has a weekly sync workflow; re-vendor to pick it up.

[^monokai-recipe]: herdr-monokai RECIPE.md
