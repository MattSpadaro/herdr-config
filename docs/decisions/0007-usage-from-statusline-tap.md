---
type: Architecture Decision Record
title: "0007: Plan limits from a statusline tap; one repository-owned usage mod"
description: Claude plan limits are captured from Claude Code's statusline payload, not from the OAuth usage endpoint; usage and metrics live in one mod hosted by the base layout.
tags: [adr, usage, limits, claude, privacy]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-13T18:30:00-03:00 }
---

# Context

The owner wanted token use and plan limits visible in the app, combining PostHog's `claude-usage` (limits) and Brutal Metrics (per-agent cost and context), in Herdr's theme and without Brutal Metrics' avatars and animated borders. Claude Code 2.1.325 passes `rate_limits` (`five_hour`, `seven_day`, `spend_limit`) and `context_window` to its statusline command; this was confirmed in the installed binary's statusline documentation.

# Decision

The owner chose the statusline tap:

1. `tap.sh` goes in front of the user's `statusLine` command through an explicit Connect, saves each payload under `data/agent-usage/sessions/` and passes it through.
2. The mod never reads Claude credentials and makes no network requests.
3. One repository-owned mod, `agent-usage`, with a sidebar strip and a side panel, both in the base layout. The tab-bar button comes from a generic `props.panels` extension in `tabs-asks` (Agent Ask patch 0003), so the plugin patch names no repository mod.

# Alternatives considered

- **OAuth usage endpoint** (what `agent-columns-usage` does): real time and per-model weekly limits, but it reads the token from `~/.claude/.credentials.json` and calls an undocumented endpoint; PostHog's recipe notes Anthropic's terms forbid third-party apps from handling Claude.ai credentials. The token's refresh also belongs to Claude Code.
- **Installing both upstream mods:** `claude-usage` ships its own copy of Herdr's main layout and Brutal Metrics a whole layout with a fixed ten-color palette; neither fits the base-layout rule, and Brutal Metrics has no license file, so its code is not reused.
- **Limits only in the panel:** hidden most of the time; the strip keeps them always visible.

# Consequences

- Limits update only when a local Claude session replies; use elsewhere shows up on the next local reply.
- No per-model weekly limits (not in the statusline payload).
- `~/.claude/settings.json` is rewritten on Connect and Disconnect (2-space JSON); a backup is kept.
- Brutal Metrics' Flow tab, avatars, account email and config counts were left out.
