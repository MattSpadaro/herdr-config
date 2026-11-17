---
type: Playbook
title: Troubleshooting
description: Recovering from install conflicts, failed patches, mod errors and a broken window.
tags: [debugging]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Troubleshooting

- **Window unusable after a change:** `ctrl-alt-shift-escape` sets aside the shown layout and `keys.json` and returns to Herdr's `main`. Nothing can rebind it.
- **`refusing to overwrite`:** the destination exists and is not in the manifest, or was edited after install. Diff it against `build/home/<path>`. Move the edit into a patch or pass `--force`, which backs up the file first.
- **`patch ... does not apply`:** see [Update an upstream plugin](/playbooks/update-upstream.md).
- **`check FAIL`:** run `herdr-app check ~/.config/herdr-app/mods/<name>` to get the exact error. A broken save keeps the last good version running; `herdr-app status` lists mod errors.
- **Layout/keys/settings invalid:** look for `*.error` files in the home and `layouts/`.
- **Asks finds nothing:** the panel only lists what the engine in `tabs-asks` found, so the tab bar must be in the layout. By design (patch 0002) plain-text questions never show and unparseable dialogs are `UNCLEAR`. Set `debug: true` in `asks.json` and read `<home>/asks.log`. `tabs-asks.recheck` re-reads every agent.
- **Chat button or `ctrl-shift-m` does nothing:** `herdr-app do chowdr-herdr-ctrl.toggle-chat` must return ok, and `view-switch` must be visible in the header (commands reach shown copies only). Chat is disabled when the focused terminal runs no agent. State: `chowdr-herdr-ctrl.chat` in `<home>/shared.json`.
- **Flockbook chat says the helper is missing:** `<home>/flockbook/bin/flockbook-modfeed version` must print a protocol line. Reinstall without `--no-helpers`.
- **Network failures during vendor/build:** fetches are atomic and safe to retry.
