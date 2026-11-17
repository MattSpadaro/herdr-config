# herdr-config

A reproducible [Herdr app](https://herdr.dev) setup for working with coding agents: an agent board, a per-terminal chat view, a question inbox, plan-limit and token usage, a file tree and a Git panel, all composed in one Monokai layout.

<!-- Screenshot: replace the path below once the image is added. -->
<!-- ![chowdr-herdr-ctrl layout](docs/assets/screenshot.png) -->

Seven upstream plugins are vendored at pinned commits and changed only through patches kept next to each plugin. One layout owned by this repository, `chowdr-herdr-ctrl`, decides where every piece appears. A small Python tool builds the result and installs it into `~/.config/herdr-app` without touching files it did not write.

## What you get

| Piece | Source | What it does here |
|---|---|---|
| Monokai | [pedroparra/herdr-monokai](https://github.com/pedroparra/herdr-monokai) | Theme for the whole window |
| Agent Columns | [elied-dev/herdr-agent-columns](https://github.com/elied-dev/herdr-agent-columns) | Agents as cards in status columns, spaces with nested tabs |
| Agent Ask | [sachin-philip/herdr-agent-ask](https://github.com/sachin-philip/herdr-agent-ask) | Every question and approval agents ask, answered from one panel |
| Flockbook | [minchenlee/flockbook](https://github.com/minchenlee/flockbook) | An agent's conversation as a chat, switchable per terminal |
| filetree | [cybertron288/herdr-mods](https://github.com/cybertron288/herdr-mods/tree/main/filetree) | File tree with Git status in the Files panel |
| Better Changes | [munza/herdr-mods](https://github.com/munza/herdr-mods/tree/main/better-changes) | Git panel with staging, commits, history and diff tabs |
| Better Icons | [munza/herdr-mods](https://github.com/munza/herdr-mods/tree/main/better-icons) | Material icons shared by the file tree and the Git panel |
| `agent-usage` | this repository | Plan limits in the sidebar; tokens, cost and context per agent |
| `folder-picker` | this repository | The Spaces `+` opens a folder picker with a default and favorites |
| `chowdr-herdr-ctrl` | this repository | The base layout and the Terminal / Chat switch |

## How it is put together

Herdr itself knows two things: **layouts** (`layouts/<name>.json`, the whole window as a tree of blocks, with no code) and **mods** (`mods/<name>/`, small JavaScript programs that draw one block). This repository adds a third concept, the **plugin**: a third-party source pinned to a commit, with its own queue of patches, that contributes mods.

```
plugins/<name>/upstream/   pristine snapshot of the pinned commit
plugins/<name>/patches/    numbered diffs applied on top, one intent each
config/layouts/            the base layout: where every mod appears and with which props
config/mods/               mods owned by this repository (integration and features)
herdrcfg.py                vendor, stage, mkpatch, build, install, uninstall
```

Rules that keep the pieces independent:

- A patch changes only its own plugin. It never reads another plugin's shared state or files, and never opens another plugin's mods by name.
- Plugins are wired together in the base layout through props (for example, which mod the Spaces `+` opens), or through a shared-state contract documented in `docs/architecture/`.
- Plugins install mods, not layouts.

Details are in [docs/architecture/repository-layout.md](docs/architecture/repository-layout.md) and [docs/architecture/base-layout.md](docs/architecture/base-layout.md).

## Install

Requirements: the Herdr app (started once), `git`, `patch` and `python3`. Flockbook's helper also needs `rustup`; Rust 1.90.0 is installed side by side and does not replace your default toolchain.

```sh
git clone https://github.com/JPChowder/herdr-config ~/herdr-config
~/herdr-config/install.sh
```

`install.sh` prints a dry run, asks for confirmation, installs into `~/.config/herdr-app` and switches to `chowdr-herdr-ctrl`. Files it did not install are never overwritten (`--force` backs them up first). `python3 herdrcfg.py uninstall` removes everything it installed and you did not edit.

Before installing, read [docs/references/privacy-surface.md](docs/references/privacy-surface.md): it lists which mods run programs, read files outside Herdr and reach the network.

## Day to day

```sh
python3 herdrcfg.py stage <plugin>             # editable copy in work/<plugin>
python3 herdrcfg.py mkpatch <plugin> <slug>    # your edits become plugins/<plugin>/patches/NNNN-<slug>.patch
python3 herdrcfg.py vendor <plugin> --update   # move the pin and check that the patches still apply
python3 herdrcfg.py install
```

| Key | Action |
|---|---|
| `ctrl-shift-m` | Terminal / Chat for the focused agent terminal |
| `ctrl-shift-a` | Asks panel |
| `ctrl-shift-l` | Next layout |
| `ctrl-alt-shift-escape` | Reset the window to Herdr's `main` layout |

## Documentation

`docs/` is an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/open-knowledge-format) bundle: architecture, each plugin and its patches, layouts, playbooks (install, modify, update and add a plugin), decision records, keybindings and the privacy surface. Start at [docs/index.md](docs/index.md). Agents working in this repository should read [CLAUDE.md](CLAUDE.md).

## Licences

Vendored code keeps its licence. Monokai, Agent Columns, Better Changes and Better Icons (code) are Apache-2.0; Agent Ask, Flockbook and filetree are MIT (the icons are Material Icon Theme, MIT). See each `plugins/*/upstream/LICENSE`, `NOTICE` and `THIRD_PARTY_NOTICES.md`. `config/layouts/chowdr-herdr-ctrl.json` and its preview are derived from Agent Columns' layout, Apache-2.0. The `NOTICE.md` in each `config/mods/*` folder credits the projects those mods draw on.
