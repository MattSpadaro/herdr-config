---
type: Reference
title: Privacy surface
description: Programs, files and network endpoints each installed plugin touches.
tags: [privacy, security]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
---

# Privacy surface

| Plugin | Runs | Reads outside its folder | Network |
|---|---|---|---|
| Monokai | nothing | nothing | none |
| Agent Ask | `hc read/get/keys/send`; `sh -c` (log append). Model calls removed by patch 0002 | `<home>/asks.json`; agent screens | none |
| Agent Columns | none (the Usage dialog `agent-columns-usage` is not installed since 2026-11-17) | none | none |
| Flockbook | `flockbook-modfeed` (which runs `hc`); `hc read` and `hc keys shift+tab` from the mod (mode chip, patch 0007); `xdg-open` on the folder tag's Open in file manager; `osascript` on macOS | session logs under `~/.claude`, `~/.codex`, `~/.grok`, `~/.cursor`, `~/.pi`, `~/.gemini`; the agent terminal's last lines every 2 s while the chat shows. Writes `~/.cache/flockbook/gate-refusal.txt` (the expected question and the terminal screen) when the key gate refuses an answer on screen grounds (helper patch 0003) | none from a source build (update check disabled) |
| Better Changes | `git` on the space's machine: reads, plus `add`, `reset -q HEAD`, `rm --cached` (index only) and `commit` / `commit --amend` on click. Never push or fetch | the shown repository | none |
| Better Icons | nothing | nothing | none |
| filetree | read-only `git` in the shown folder; `sh -c` with `stat`, `find`, `du -sk`, `mkdir -p`; `xdg-open` on Open/Reveal. `bridge.ts` hook not registered | the focused terminal's folder (listing, search index, previews); watches `~/.local/state/herdr-filetree/`; reads `mods/better-icons/icons.json` and watches that folder | none |

| chowdr-herdr-ctrl (this repo) | nothing | nothing; stores terminal addresses in `shared.json` | none |
| agent-usage (this repo) | `python3 -I usage.py`; `hc get` per agent; `hc send /compact` or `/clear` on click | `~/.claude/sessions`, transcripts and `subagents/` under `~/.claude/projects`, `~/.codex/sessions` and `session_index.jsonl`. Writes `~/.claude/settings.json` only on Connect/Disconnect (backup in `data/agent-usage/settings.backup.json`). `tap.sh`, run by Claude Code, writes each statusline payload (session id, cwd, model, limits, context) to `data/agent-usage/sessions/` (mode 700/600, kept 8 days). Never reads credentials | none |
| folder-picker (this repo) | `find -L` (one folder level) and `test -d`, local | the folders browsed in the popup. Writes `data/folder-picker.json` (default folder, favorites) on click | none |

Keys and text are only sent to agents on an explicit click or key press, in both Agent Ask and Flockbook.
