---
type: Herdr Plugin
title: Better Icons
description: Material Icon Theme 5.40.0 icon pack, the single source of file and folder icons for Better Changes and filetree; draws nothing in the layout.
tags: [icons]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T09:30:00-03:00 }
resource: https://github.com/munza/herdr-mods/tree/main/better-icons
sources:
  - id: bi-recipe
    resource: plugins/better-icons/upstream/better-icons/RECIPE.md
    title: Better Icons RECIPE.md
---

# Better Icons

Pinned at `860626068cb7e32a1db96b2f66baadc271d5667a` (branch `main`) of `munza/herdr-mods`. Mod code Apache-2.0; icons MIT (`LICENSE-material-icon-theme.txt`). No patches.

Installs `mods/better-icons/`: `icons.json` (name, extension and folder rules) and 1,184 SVGs, about 5 MB. It is not placed in any layout. [Better Changes](/plugins/better-changes.md) keeps a byte-identical copy of `file-icons.js` and reads `mods/better-icons/icons/<name>.svg`; without this pack it falls back to plain icons.[^bi-recipe]

The folder name is fixed: consumers read it by path. Runs no programs, reaches no network, reads only its own folder.

[filetree](/plugins/filetree.md) reads it too, through its patch `0002-better-icons`, which adds the same `file-icons.js` copy. Its own `mods/file-icons` duplicate is no longer installed. Removing this pack leaves both panels with plain icons.

[^bi-recipe]: Better Icons RECIPE.md
