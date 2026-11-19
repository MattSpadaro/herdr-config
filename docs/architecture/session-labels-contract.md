---
type: Architecture
title: Claude session labels contract
description: The cc.session and cc.transcript terminal labels that tell mods which Claude Code conversation runs in each herdr-core terminal, on any machine.
tags: [contract, labels, claude-code, integration]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-19T16:00:00-03:00 }
resource: claude-hooks/hc-session-label.sh
---

# Claude session labels contract

Herdr knows which terminals run an agent, but not which Claude Code conversation each one holds. A Claude Code hook, `claude-hooks/hc-session-label.sh`, writes that onto the terminal as herdr-core labels, so any mod can read it from `terminals()[i].labels`, for local and remote machines alike.

## Labels

| Label | Value |
|---|---|
| `cc.session` | the Claude Code session id (`claude --resume <id>`) |
| `cc.transcript` | the absolute path of the session's transcript (JSONL) on the terminal's machine; a Windows path on Windows |

They are rewritten on `SessionStart` (startup, resume, clear, compact) and on every `UserPromptSubmit`, so a conversation that was already open gets them with its next prompt. The hook only acts inside an hc terminal (`HC_TERMINAL_ID` set) and prints nothing.

## Install

Not installed by `herdrcfg.py`; it belongs to each machine's Claude Code settings.

- Fedora: `~/.claude/hooks/hc-session-label.sh`, hooks `sh ~/.claude/hooks/hc-session-label.sh` on `SessionStart` and `UserPromptSubmit` in `~/.claude/settings.json`.
- Notebook (Windows): `%USERPROFILE%/.claude/hooks/hc-session-label.sh`, run by Git Bash with the hc binary as its argument: `"C:/Program Files/Git/bin/bash.exe" <USERPROFILE>/.claude/hooks/hc-session-label.sh <USERPROFILE as /c/Users/...>/AppData/Local/Programs/herdr-core/hc.exe` (async), beside `hc-agent-state.sh`.

## Readers

- [Agent Columns](/plugins/agent-columns.md) `0023-card-context-menu`: the card menu's summary (newest of the transcript's `away_summary` recap and the last assistant reply) and Copy `claude --resume`. It reads the last 512 KB of the transcript on the terminal's machine with `exec` (`tail -c`, or PowerShell for a Windows path), since `readTextFile` stops at 1 MiB.

Readers treat missing labels as "no session known" and never write them.
