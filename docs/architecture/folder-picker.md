---
type: Architecture
title: Folder picker for new spaces
description: The repository-owned folder-picker mod - a dropdown on the Spaces + that opens a new space with a plain shell in the chosen folder, with a default folder and pinned favorites.
tags: [spaces, folders, favorites, mod]
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T15:00:00-03:00 }
resource: config/mods/folder-picker/main.js
---

# Folder picker for new spaces

Herdr's `space.new` starts in the home folder unless it gets `folder`, and no shipped control asks for one. The `+` beside "Spaces" in the sidebar (`agent-columns-spaces`) now opens `folder-picker` as a popup at the pointer. Choosing a folder runs `space.new {folder, machine: ""}`: a new space with the default shell in that folder and no agent.

## Wiring

    agent-columns-spaces  props.newSpace = {mod: "folder-picker", width, height}   (base layout, block `spaces`)
        └── + click --> openOverlay({mod: props.newSpace.mod, kind: "popup", ...})   (agent-columns patch 0002)
                         └── folder-picker --> run("space.new", {folder, machine: ""})

Agent Columns patch `0002-new-space-overlay` only reads `props.newSpace`; without it the `+` keeps running `space.new`. The plugin does not name this mod, so the [ownership rule](/architecture/base-layout.md) holds: the base layout chooses the mod.

`mod.json` also carries an `overlay` spec, so `herdr-app do mod.open --name folder-picker` (or a `mod.open:folder-picker` key) opens it at the top of the window. No key is bound.

## Dropdown

| Part | Behaviour |
|---|---|
| Filter box | Plain text filters favorites and subfolders by substring. Text starting with `/` or `~` is a path: as it is typed, the list shows the folder before the last `/`, filtered by the prefix after it, and Tab completes it (one match: the whole name and `/`, showing its folders; several: their common prefix, keeping the typed part as typed; never the selected one). Tab on plain text turns the selected folder into its path. A leading `.` shows hidden folders. |
| Path bar | Folder being browsed; `<` goes to the parent. "Set as default" makes it the default; on the default folder the same chip reads "Default" in the accent colour. |
| FAVORITES | Pinned at the top, in the order added: folder name and absolute path. The filled star (accent colour) removes it; `>` browses into it. |
| FOLDERS | "Open <folder>" for the browsed folder itself (star toggles it as a favorite), then its subfolders sorted by name, symlinks followed. Star adds or removes a favorite; `>` browses in. |
| Browse... | The system folder picker (`pickFolder`); a chosen folder opens at once. |
| Keys | Up/Down select, Enter opens the selection, Tab completes, Backspace on an empty filter goes up, Esc closes. |

Clicking a row opens it; the star and `>` buttons stop the click.

## Implementation notes

- Tab, Up and Down are bound with `cx.bind_keys` to actions in the `FolderPicker` context (and `FolderPicker > Input`); GPUI otherwise uses Tab to move focus and the key never reaches `on_key_down`.
- A handler's `cx` is stale after an `await`. Every async step (saving, listing a folder) runs in `cx.spawn` and redraws with the task's own context. Using the click's `cx` saved the file but never redrew.
- A button must not stop `mouse_down`: that swallowed the stars' `on_click`.
- `InputState.set_value` fires no `change` event, so completion calls the update itself.

## State

`~/.config/herdr-app/data/folder-picker.json`, written only on a star or "Set as default" click:

    { "defaultFolder": "/home/me/projects", "favorites": ["/home/me/projects/api"] }

It can be edited by hand. Each write re-reads the file and writes with `writeTextFile`'s compare-and-swap (`expected` = the text just read), retrying once. A failed save shows an error line in the popup. With no default, or a default that is no longer a folder, browsing starts at home. The file is runtime data, not part of this repository, so `install` never touches it.

## Runtime surface

`find -L <dir> -mindepth 1 -maxdepth 1 -type d` to list the browsed folder, `test -d` to check a typed path or the default, both local. Reads and writes only its state file. No network.

## Limits

- Local machine only: `pickFolder` and the listing run here, and the space is created with `machine: ""`.
- The popup has a fixed height of 480 px. A popup sizes to its content, so the list has an explicit height (372 px); a `flex_1` list collapsed to zero.
- Only the `+` next to "Spaces" changed. The `+` on each space row still runs `tab.new` in that space's current folder, and `ctrl-shift-n` still runs a plain `space.new`.

## Verified

`herdr-app check` passes. The owner verified the sidebar `+`, opening a space, Set as default, browsing and Browse. With `xdotool` on the popup opened by `mod.open`: typing `~/her` lists `herdr-config`, Tab completes to `~/herdr-config/` and lists its folders, a second completion moves into `config/`, Down moves the selection, and a star click adds the favorite (pinned with its absolute path, file written) and a second click removes it.

## Related

- [Base layout](/layouts/chowdr-herdr-ctrl.md)
- [Agent Columns](/plugins/agent-columns.md)
- [Privacy surface](/references/privacy-surface.md)
