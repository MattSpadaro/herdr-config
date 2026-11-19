---
type: Architecture
title: Agent usage (plan limits and per-agent metrics)
description: The repository-owned agent-usage mod - a sidebar strip with plan limits and a side panel with tokens, cost and context per agent, fed by a statusline tap and local transcripts.
tags: [usage, limits, metrics, claude, codex, mod]
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-13T18:30:00-03:00 }
resource: config/mods/agent-usage/main.js
sources:
  - id: posthog-claude-usage
    resource: https://github.com/PostHog/herdr/tree/main/claude-usage
    title: PostHog herdr claude-usage RECIPE.md (MIT)
  - id: brutal-metrics
    resource: https://github.com/coldtatooine/brutal-metrics
    title: Brutal Metrics RECIPE.md
---

# Agent usage

One mod, `config/mods/agent-usage`, in two roles chosen by `props.role`. It combines the plan-limit strip of PostHog's `claude-usage`[^posthog-claude-usage] with the per-agent metrics of Brutal Metrics[^brutal-metrics], without avatars, rainbow borders or a palette of its own: every color comes from `theme()`, so it follows the theme picked in Herdr. Why the limits come from a statusline tap is [ADR 0007](/decisions/0007-usage-from-statusline-tap.md).

## What it shows

| Role | Block | Content |
|---|---|---|
| `strip` | `usage-strip` in `sidebar`, between `sidebar-lists` and `sidebar-footer` | one card per provider: a row per limit window (`5h`, `week`, `spend` behind a gateway) with a bar, the percentage and the time to reset; Connect when Claude Code is not connected. A click toggles the panel. The strip resizes its own block (`props.block`) with `layout.resize` to fit the number of rows. |
| `panel` | `usage` child of `panel-body`, opened by the Usage button in `tabs-asks` | header with Space/All scope and Turn/Session view; the limits again, with a pace tick (where even use would be) and Disconnect; a summary (estimated cost, agents, tokens, cache hit, fullest context); one card per agent |

Agent card: status dot and label (`waiting` when a sub-agent is working or blocked), name (the tab name unless it is a bare number, else the session title), terminal address (click: `agent.focus`), estimated cost; model, model calls and tool calls, time since last activity; context bar (base context in `muted`, conversation in `accent`, `working` from 60%, `blocked` from 80%); `used / window`, cache hit, calls left at the recent growth, tokens; the last tool while working, blocked or waiting; `/compact` and `/clear` (`/clear` arms for 3 s and sends on the second click) through `hc send`. Sub-agents (terminals whose `parent` is a shown agent) are indented under their parent.

Alerts: the strip posts a notification when a window crosses 80% (`warning`) and 95% (`error`), once per level per window period (localStorage `alerts`). Its action runs `agent-usage.open`.

## Data flow

    Claude Code --statusline stdin--> tap.sh --> <home>/data/agent-usage/sessions/<session id>.json
    usage.py limits  (strip, every 10 s)         -> providers[] from the tap files + newest Codex rollout
    usage.py all     (panel, every 5 s, only while the panel shows usage) -> providers[] + sessions[]
    main.js: agents() --hc get <t> --json--> foreground pid --> session with that pid (Claude)
                                                foreground cwd --> newest rollout in that cwd (Codex)

- **Claude limits:** the statusline payload's `rate_limits.five_hour`, `seven_day` and `spend_limit`. All sessions report the same account, so per window the latest `resets_at` wins, then the highest `used_percentage`. Tap files older than 8 days are deleted. Numbers move only when a local session gets a reply.
- **Claude sessions:** `~/.claude/sessions/<pid>.json` for live pids, the transcript (from the tap's `transcript_path`, else `projects/<cwd encoded>/<id>.jsonl`) and `subagents/*.jsonl` beside it, read incrementally from byte offsets kept in `data/agent-usage/cache.json`. A message streamed over several lines counts once (the previous line of the same message id is subtracted). A turn starts at the person's last prompt; sub-agent usage after that prompt counts in the turn.
- **Context window:** the tap's `context_window.context_window_size` when the session reported one (exact), else a guess from the model id (1M for the Claude 5 family, Opus 4.6-4.8 and Sonnet 4.6, else 200k).
- **Codex:** rollouts under `~/.codex/sessions/YYYY/MM/DD/` touched in the last 2 days give tokens, context and tool; `token_count.rate_limits` (`primary`, `secondary`) gives the plan limits. No cost (no OpenAI price table). Written from Brutal Metrics' description; not exercised on this machine, which has no Codex.
- **Cost:** `PRICES` in `usage.py`, USD per million tokens for input, output, cache read, cache write 5 min and 1 h, from the Claude API pricing as of 2026-11-13. Haiku 5.5 requests over 100k prompt tokens use its long rate. An unknown `claude-*` model is priced as its family's current model and shown with `~`. It is the API list-price equivalent, not what a subscription bills.

## Labelled agents

Agents Herdr does not see (`agents()` misses them) are read from terminal labels, the contract of Agent Columns patches 0019/0020: a live terminal with `cc.state` in `idle|working|blocked|done` is a row, and `cc.agent=hermes` marks Harry.

    Hermes gateway (notebook) --plugin hc-agent-state--> %LOCALAPPDATA%\hermes\herdr-hc\cli.txt
        line 1 "<state> <ms>", line 2 JSON usage of the latest CLI session (state.db `sessions` row)
    ~/.local/bin/harry (Fedora, in the Harry tab) --hc file read every 1 s--> hc label cc.state, cc.seq, hermes.usage

- `hermes chat` is a client; turns run in the gateway, so the plugin follows CLI sessions (`platform` `cli`/`tui`), not the process. With two Harry tabs both show the latest CLI session.
- Cost is Hermes' own `actual_cost_usd`, else `estimated_cost_usd`, shown with `~`. Harry uses an API key, so unlike Claude Code it is what is billed. The turn view subtracts the totals read at `pre_llm_call`.
- Context: `_usage_anchor.prompt_tokens` from `model_config`, window guessed from the model as for Claude.
- Claude Code on the notebook (labelled, no `hermes.usage`) shows "No session data yet".

## Connect and disconnect

Both run through the shipped `confirm` dialog, whose command carries a per-copy token (`agent-usage.connect-<token>`) so only the copy that asked acts. `usage.py connect` wraps the existing command as

    { [ -f '<tap.sh>' ] && sh '<tap.sh>' --tee || cat; } | {
    <your command>
    }

or, with no statusline, `{ ... } >/dev/null`. It keeps every other `statusLine` key, resolves a symlinked `settings.json` to its target, keeps the file mode, writes a full copy beside it and renames it into place, and refuses if the file changed while it ran. The previous text is saved to `data/agent-usage/settings.backup.json` (mode 600). `disconnect` restores the inner command (with any edit made in between) or removes the key when Connect added it; a command no longer in that shape is left alone with an error.

## Files

| File | Role |
|---|---|
| `main.js` | both roles; commands `agent-usage.toggle`, `agent-usage.open` (handled by the strip) |
| `format.js` | number, time and color helpers; `find()` over `layout()` |
| `usage.py` | `limits`, `all`, `connect`, `disconnect`; Python 3 stdlib, run as `python3 -I` |
| `tap.sh` | the statusline wrapper, derived from PostHog's (MIT, see `NOTICE.md`) |
| `gauge.svg` | the panel and tab-bar icon |

## Watch out

- The panel shows session titles and tool arguments (the last Bash command). Same care with screenshots as with the chat view.
- A repository with its own `statusLine` in `.claude/settings.json` overrides the user one; its sessions do not report limits.
- `rate_limits` exists only for subscribers, after a session's first reply. An API-key login never shows limits.
- `init(props)` in this Herdr build does not carry the layout's props; the mod reads `props()` from `herdr`.
- The sidebar footer's Usage button (Agent Columns `0003-usage-button-prop`, `props.usage` in the base layout) opens this mod's panel. `agent-columns-usage` is no longer installed.

[^posthog-claude-usage]: PostHog herdr claude-usage RECIPE.md (MIT)
[^brutal-metrics]: Brutal Metrics RECIPE.md
