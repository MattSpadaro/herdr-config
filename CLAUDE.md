# CLAUDE.md

Configuration of the Herdr app (a desktop app for terminals and coding agents), built from vendored plugins plus patches and installed into `~/.config/herdr-app` by `herdrcfg.py`.

## Read first

1. `docs/index.md`, then `docs/architecture/repository-layout.md` and `docs/architecture/base-layout.md`.
2. `~/.config/herdr-app/AGENTS.md`: Herdr's own manual for layouts, mods, the `herdr` API and commands. Herdr rewrites it on every start, so it matches the installed version. `herdr-app --skill` and `herdr-app commands` complement it.
3. The page of the plugin or mod you are about to touch: `docs/plugins/<name>.md` or `docs/architecture/<mod>.md`.

## Concepts

- **Layout** (`layouts/<name>.json`): the whole window as a tree of blocks, with look and props. It holds no code. `config/layouts/chowdr-herdr-ctrl.json` is the only layout this repository installs, and it is where every piece is composed.
- **Mod** (`mods/<name>/main.js` + `mod.json`): JavaScript (gpui-kit) that draws one block. A mod cannot import files from another mod's folder.
- **Plugin** (a concept of this repository, not of Herdr): `plugins/<name>/` with `plugin.json` (pin, vendor list, install map, keys, helpers), `upstream/` (pristine snapshot) and `patches/NNNN-<slug>.patch`.
- **Repository-owned mods** (`config/mods/<name>/`): `chowdr-herdr-ctrl` (glue for the Terminal / Chat switch), `agent-usage`, `folder-picker`. They are edited directly, with no patches.

## Rules

- Never edit `plugins/*/upstream/` (`vendor` overwrites it), `build/` or `work/.base/` (both generated). Shipped Herdr mods and layouts are read-only; clone them under a new name if you need to change one.
- A change to a plugin is a new patch in that plugin's `patches/`, one intent per patch: `python3 herdrcfg.py stage <plugin>`, edit `work/<plugin>/`, `python3 herdrcfg.py mkpatch <plugin> <slug>`, `python3 herdrcfg.py install`.
- No patch may touch another plugin's files, read or write another plugin's `shared()` keys, read another plugin's mod folder, or open another plugin's mods by name. Cross-plugin integration goes through props set in the base layout, or through a shared-state contract documented in `docs/architecture/` (for example `asks-state-contract.md`). The known exceptions are listed in `docs/architecture/repository-layout.md`.
- Plugins install mods, not layouts. Where a mod appears is decided in the base layout. Keep the block ids other mods drive (table in `docs/architecture/base-layout.md`).
- Before adding a plugin, read all of its files and tell the owner whether it reaches the network, runs programs (`exec`, `hc`) or reads outside its folder. Record that in `docs/references/privacy-surface.md`.
- Every change updates the matching page under `docs/` (OKF bundle: YAML frontmatter, relative links from the bundle root). Code, docs and commit messages are in English.

## Verification

- `herdr-app check <mod folder>` must pass for every mod you change. `install` runs it on all mods.
- Use `herdr-app status` for load errors (`errors` must be empty) and `herdr-app shot <file>.png` to look at the result. Screenshots can show terminal contents: crop to the region you need and do not share them.
- `python3 herdrcfg.py install --dry-run` before a real install. It must list only the paths you expect.

## Gotchas

- `herdr-app check` writes `gpui-kit.d.ts` and `jsconfig.json` into the mod folder. `mkpatch` ignores them; delete them from `config/mods/*` before committing.
- Never run `config/mods/*/usage.py` from the repository tree: it writes `config/data/`, which install then tries to copy over the live cache.
- Files duplicated because mods cannot import across folders must stay byte-identical: Agent Ask's `state.js` in `asks/` and `tabs-asks/`; `file-icons.js` in `better-changes/` and `filetree/`.
- Install refuses to overwrite an installed file that was edited by hand. To iterate quickly, edit the installed copy (Herdr hot-reloads), then copy the final version into `work/<plugin>/` and run `mkpatch`.
- gpui-kit setters reject `undefined`; use `.when(cond, el => ...)`. Keep side effects out of a mod's top-level code, since it runs again on every reload.
- A mod copy lives while its block is in the layout, and `<mod>.<command>` reaches shown copies only. Every `setShared` re-renders all mods, so write only on change.
- When driving the window with `xdotool`, never send Escape: it can reach the agent's terminal. Do not toggle the owner's chat view for screenshots without asking.
- Commit new patches promptly; an untracked patch has been lost before.

## Local-only material

`dev-docs/` (the update log and proposals), when present, is a separate local git repository ignored by this one. Read it for open work, update it for notable changes, and never add it to this repository.

## Git

Do not push unless asked. Do not add AI co-author trailers to commits or pull requests.
