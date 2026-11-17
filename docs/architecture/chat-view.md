---
type: Architecture
title: Per-terminal chat view
description: How the base layout switches the workspace between an agent's terminal and Flockbook's chat, remembered per terminal.
tags: [chat, flockbook, base, mod]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T19:00:00-03:00 }
verified:
  - { by: human:JPChowder, at: 2026-11-12T19:30:00-03:00 }
  - { by: human:JPChowder, at: 2026-11-13T10:30:00-03:00, scope: "patches 0002-0003, partial" }
resource: config/mods/chowdr-herdr-ctrl/main.js
---

# Per-terminal chat view

The workspace of the [base layout](/layouts/chowdr-herdr-ctrl.md) shows either the active tab's terminals or [Flockbook](/plugins/flockbook.md)'s chat of the focused agent. The choice is remembered per terminal. Decided in [ADR 0006](/decisions/0006-per-terminal-chat-view.md).

## Parts

| Part | Where | Role |
|---|---|---|
| `term-view` stack | base layout, inside `workspace` | children `live-terminals` (the `{tab: active}` block) and `term-chat` |
| `term-chat` block | base layout | `{mod: "flockbook", props: {view: "chat", embed: true}}` |
| Embedded chat mode | Flockbook patches `0001-embedded-chat`, `0002-chat-tags-activity`, `0003-slash-menu` and `0004-keep-draft` | with `embed: true` the chat draws no Flockbook bar, never selects the `screen` stack, does not open Flockbook's sidebar at the window edge, ignores Flockbook commands other than settings and text size, and stops polling while `shared("flockbook.screen")` is not `"chat"` |
| `chowdr-herdr-ctrl` mod | `config/mods/chowdr-herdr-ctrl/`, block `view-switch` in `header-row` | the Terminal / Chat buttons, the commands, the per-terminal state and the stack selection |

## State

`shared("chowdr-herdr-ctrl.chat")` is the list of terminal addresses that are in chat view, for example `["t1"]`. Herdr persists shared state in `~/.config/herdr-app/shared.json`, so it survives restarts. The agent never sees it.

Every 200 ms the mod reads `focused()`:

- A mod pane has focus (`pane` set, `terminal` null): select `live-terminals`, where mod panes are drawn, and disable Chat. `focused().agent` is ignored here: it names the globally chosen agent, not the focused pane, and used to keep a mod tab (a Better Changes diff) hidden behind the chat.
- Focused terminal in the list and an agent: select `term-chat`.
- Otherwise: select `live-terminals`.
- Nothing focused: keep the current view.

It also sets `shared("flockbook.screen")` to `"chat"` or `"tab"`. Flockbook's chat uses that key to know whether it is shown.

`shared("flockbook.request")` goes the other way: the chat writes `{kind: "show-terminal", address, at}` when Show terminal is picked on the agent tag. The mod puts that address in terminal view, focuses its pane and clears the key. Requests older than the mod copy's start are ignored.

When no terminal is focused (the keyboard is in the reply box or another mod block), the commands and the buttons act on the last focused terminal.

An address leaves the list when its terminal, once seen alive in this session, disappears from `terminals()`. Addresses not seen yet are kept, so a list read before Herdr reconnects to the core is not wiped.

## Behaviour

- **Split tabs:** the chat takes the whole workspace and shows the agent of the focused pane, which is Flockbook's `currentAgent()`.
- **Shell terminals:** Chat is disabled and the command shows the toast "The focused terminal runs no agent."
- **Agent exits but its shell stays:** the address stays in the list, the view falls back to terminals, and the chat returns if an agent starts there again.
- **Board view of Agent Columns:** `workspace` is hidden, and so is the chat. The buttons still change the remembered choice.

## Inside the chat

- **Activity line** above the tags: "Working · 1m 05s" with a spinner while the agent works, "Needs you" while it is blocked, and "Sent, waiting for the agent" for up to 15 s after a send.
- **Tags**: model (fills `/model ` and opens the value list), folder (Copy path, Open in file manager), branch (Copy branch name), agent (Show terminal, Copy terminal address). `context` would fill `/compact `, but it only appears with Flockbook's status line wrapper, which is not ported to Linux.
- **Focus**: the reply box takes the keyboard each time the chat becomes shown.
- **Mode**: chip beside Comandos and coloured border (patch 0007); Shift+Tab in the reply box moves to the next mode, as in the terminal, only while the agent is not working or blocked.
- **Question open**: the reply box says "Responda apenas pelo card de pergunta." and does not send (patch 0008); hc holds sends to a blocked program anyway.
- **Question history**: answered questions show as question + answer pairs in the history (patch 0013). Owner-verified 2026-11-13.
- **Minimized card**: Minimize/Expand on the question or approval card (patch 0012); folded, it is one line and the list gets the rest of the column, nothing overlaps. Folded, the card ignores 1-9 and Enter. Owner-verified 2026-11-13.
- **Draft kept**: when a tag or the Comandos menu fills the box with a command, the text and files already in the box are set aside (a note says so). They come back after the command is sent, with Esc while the value list shows, when the box is emptied, or when the agent changes. A draft that itself starts with `/` is replaced, not kept.

## Slash command menu

The Comandos button at the left of the reply box's bottom row (light text at rest; the send button's accent colour on hover and while open) opens the agent's slash commands, from the helper's `commands` answer, in groups:

| Group | Contents |
|---|---|
| Built-in | `source: builtin` |
| Personal | `source: user` and `skill` (`~/.claude/commands`, `~/.claude/skills`, and the folder's `.claude/skills`) |
| Project | `source: project` (`.claude/commands` in the terminal's folder); hidden when empty |
| Plugins | one submenu per plugin, from the `<plugin>:` prefix |
| MCPs | plugins whose name contains `mcp`, and any `mcp__<server>__<prompt>` command, one submenu per server; hidden when empty |

Empty groups are hidden. Picking a command fills the box with `/<name> ` and moves the keyboard there; the existing value list then opens for commands such as `/model`. Keys while the menu is open (the keyboard moves into the reply box when it opens, and the keys are bound under the `FlockbookMenu` context, so they act on the menu instead of the box):

| Key | Effect |
|---|---|
| ↑ ↓ | move the highlight; the window of 8 rows follows it (the wheel scrolls it too) |
| Enter, Tab | open the highlighted group or pick the command |
| → | open the highlighted group |
| ← | back one level |
| Esc, Backspace | back one level; at the first level, close the menu |

The Comandos button again, or another agent, also closes it.

Nothing is stored. The list is asked of the helper when the menu opens (at most every 30 s per terminal), and the helper reads the commands, skills and enabled plugins from disk each time, so adding or removing them shows within 30 s.

Limits: the helper does not list MCP servers' prompts, so the MCPs group holds only plugins named like MCPs. Every installed plugin here ships a `.mcp.json` (compound-engineering bundles context7), so "has an MCP server" cannot tell them apart; the name is the rule.

## Commands

Bound in `config/keys.json` (`layout:chowdr-herdr-ctrl`) or runnable with `herdr-app do`:

| Command | Effect |
|---|---|
| `chowdr-herdr-ctrl.toggle-chat` | flip the focused terminal (`ctrl-shift-m`) |
| `chowdr-herdr-ctrl.show-chat` | put the focused terminal in chat view |
| `chowdr-herdr-ctrl.show-terminal` | put the focused terminal in terminal view |

## Verified

`herdr-app do chowdr-herdr-ctrl.toggle-chat` on the Claude Code tab switched the workspace to the chat, showing that session without Flockbook's bar, and stored `["t1"]`. A second toggle restored the terminals and the empty list. On a new shell tab, Chat was disabled and the toast appeared. `herdr-app status` reported no errors.

The owner then confirmed by hand that `ctrl-shift-m` switches the view, and that a message sent from the reply box reached the agent. The message shows as the owner's bubble, with the agent's answer below it. Across tabs, each tab's chat showed its own agent. After restarting Herdr, the terminal view and the chat view each came back as left.

## Owner verification (2026-11-13)

Passed: reply box takes the keyboard on opening the chat; `ctrl-shift-m` from the reply box returns to the terminal and typing works at once; model tag fills `/model `; folder tag Copy path and Open in file manager; agent tag Show terminal and Copy terminal address; Comandos button colours and toggle; menu keys (↑ ↓, Enter, Tab, →, ←, Esc and Backspace by level); wheel scrolling; a draft survives Backspace in the menu; keys behave normally after the menu closes; the menu closes when another agent's tab is shown.

Failed, then changed: the model tag replaced the draft and closing the list did not bring it back. Fixed by patch `0004-keep-draft`; the owner verified that Esc brings the draft back.

Later the same day: "Sent, waiting for the agent", "Working" until the turn ends and "Needs you" with a question card passed. Typing `/` with an empty box shows the suggestions; with text already in the box it does not, as upstream intends (a command must start the message).

Open:
- Branch tag (needs a git folder).
- Growth of the own-answer box to several rows (`0005`); typing and sending an ASCII own answer passed.
- Answering questions from the chat: picks, own answers (accents, line breaks, Enter to send) and two-question requests submitted from the card work after helper patches 0001-0002 (owner-verified). The reply box still cannot send while a question is open (hc holds sends to a blocked program).

Also verified on 2026-11-13: the activity line, the question and approval cards (picks, own answers with accents and line breaks, two-question requests, every approval option, the call's description), the approval command in a readable font, the mode chip and colours, switching the mode from the chip and with Shift+Tab, the note while a question is open.

Dropped: choosing another folder from the folder tag. Claude Code cannot change a running session's folder, and the owner does not want a new session or `/add-dir` instead.

## Watch out

- The mod's copy must stay shown, because `<mod>.<command>` reaches shown copies only. Do not move `view-switch` into a hidden or stacked node.
- Before patch 0002, keyboard focus stayed outside the reply box and typed keys went nowhere. The patch calls `focus()` from the chat's timer when the chat becomes shown; the owner verified that this works.
- Text typed in the terminal's prompt is the terminal's own draft. The chat does not show it, and it is still there when the terminal view returns.
- On start in chat view the conversation appears after a short delay. The chat's copy starts when first shown, and its first `feed` call makes the helper read the session log.
