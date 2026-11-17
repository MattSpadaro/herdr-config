---
type: Architecture
title: Install semantics
description: How install decides between add, update, conflict and removal, and how keys/settings are merged.
tags: [install, safety]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Install semantics

Target home: `--home`, else `$HERDR_APP_HOME`, else `~/.config/herdr-app`. The home must already exist (start Herdr once).

## Managed files

The manifest `<home>/.herdr-config/manifest.json` maps every installed path to its sha256. For each built file:

| Destination state | Action |
|---|---|
| absent | add |
| identical to build | nothing |
| hash equals manifest (untouched since last install) | update |
| anything else (not ours, or edited) | conflict: install aborts, nothing is written |

`--force` turns conflicts into replacements after copying the old file to `<name>.bak-<YYYYmmdd-HHMMSS>`. Files present in the old manifest but no longer built are removed only if untouched. This follows Herdr's own rule for third-party layouts: never overwrite something the person owns.

## Merged JSON

- `keys.json`: every plugin's `keys` file, then `config/keys.json`, merged per section. A key the person already binds to another action is kept and reported (`keep`), unless `--force`. Editing `keys.json` at all makes Herdr stop upgrading it with new default shortcuts.
- `settings.json`: `config/settings.json` merged per top-level key with the same keep-unless-force rule.
- Both get a `.bak-<time>` copy before being rewritten.

## Checks

After writing, `herdr-app check` runs on every installed `mods/<name>` with `HERDR_APP_HOME` set to the target home, then any `*.error` file in the home or `layouts/` fails the install. `--switch <layout>` runs `herdr-app do layout.switch` at the end. Herdr hot-reloads layouts, mods, keys and settings, so no restart is needed.

## Related

- [Build pipeline](/architecture/build-pipeline.md)
- [Troubleshooting](/playbooks/troubleshooting.md)
