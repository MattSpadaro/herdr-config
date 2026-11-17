---
type: Herdr Plugin
title: Flockbook
description: Chat reading view of agents (bubbles, tool chips, approval cards, composer) as a separate layout, with its Rust helper compiled from source.
tags: [agents, chat, layout, helper, privacy-sensitive]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-12T16:00:00-03:00 }
resource: https://github.com/minchenlee/flockbook
sources:
  - id: fb-recipe
    resource: plugins/flockbook/upstream/herdr-app/RECIPE.md
    title: Flockbook herdr-app RECIPE.md
  - id: fb-protocol
    resource: plugins/flockbook/upstream/herdr-app/docs/protocol.md
    title: flockbook-modfeed protocol
---

# Flockbook

Pinned at the release tag `v0.13.0`, commit `a8fa3db80460cd9ee0ad1ec9f3dd229921043b36`, MIT. Only `herdr-app/` (layout, mod, keys, docs) is vendored; the layout and keys stay as reference. The Rust source is fetched into the cache only to build the helper.

## What it installs

- `mods/flockbook`: one mod with all views selected by `props.view`, because a mod cannot import another mod's files. Only the `chat` view is used, embedded in the [base layout](/layouts/chowdr-herdr-ctrl.md) as the [per-terminal chat view](/architecture/chat-view.md). Upstream's `layouts/flockbook.json` (a whole window whose `screen` stack the mod switches) is not installed.[^fb-recipe]
- `flockbook/bin/flockbook-modfeed`: the helper, built with `cargo +1.90.0 build --release --locked -p flockbook-modfeed` in `xplat/`. Upstream needs Rust edition 2024 (cargo >= 1.85); 1.90.0 is installed side by side through rustup. `version` prints `protocol: 1`, `release: null`.[^fb-protocol]
- `flockbook/config.json` from `config/`: `check_updates: false`. A helper built from source never checks for updates anyway; the explicit value documents the intent.

## Patches

1. `0001-embedded-chat.patch`: `props.embed: true` on the chat view.
   - It draws no Flockbook top bar and no bar offset.
   - It never starts the `screen` sync, so it never selects the `screen` stack.
   - It does not load or open Flockbook's sidebar, including at the window edge.
   - It accepts only the `settings` and text-size commands.
   - It skips polling while `shared("flockbook.screen")` is not `"chat"`.
   - Without `embed` the views behave as upstream.
2. `0002-chat-tags-activity.patch`, embedded mode only:
   - An activity line above the tags: "Working" with the elapsed time (`TabInfo.working_since`), "Needs you" while blocked, "Sent, waiting for the agent" for up to 15 s after a send.
   - Clickable tags: model and context fill the box with `/model ` or `/compact `; the folder offers Copy path and Open in file manager; the branch offers Copy branch name; the agent offers Show terminal (through `shared("flockbook.request")`) and Copy terminal address.
   - The reply box takes the keyboard when the chat becomes shown.
   - `menu.js` gains the actions `open` and `request`.
3. `0003-slash-menu.patch`: a Comandos button in the composer opens the agent's slash commands grouped by origin. Picking one fills the box with `/<name> `. Works in both modes.
4. `0004-keep-draft.patch`: when a command is filled into the box (model tag, Comandos menu), the draft is set aside and comes back after the send, with Esc, when the box is emptied, or on an agent change.
5. `0005-card-own-answer-linux.patch`: the question card's own-answer box takes typing on Linux and grows to 6 rows. Upstream stopped every key at the box's row so 1-9 and Enter would not pick options; on Linux a key stopped in `key_down` is never inserted. The card now ignores its keys while an own-answer box has the focus (`focus`/`blur` events). Enter in the box sends (or moves to the next question), Shift+Enter adds a line.
6. `0006-linux-mono-font.patch`: monospace text (approval command, code blocks, settings, phone) uses Menlo on macOS and JetBrains Mono, which ships with Herdr, elsewhere. Menlo is not installed on Linux.
7. `0007-agent-mode.patch`, embedded mode only: the agent's mode read from its terminal footer (`hc read`, every 2 s while shown), a mode chip beside Comandos, and the reply box border in the mode's ANSI colour (plan `ansi4`, accept edits `ansi5`, auto `ansi3`, bypass `ansi1`; default: normal border). While the agent works: "Working" and `theme().working`. Switching (chip list, or Shift+Tab in the reply box) presses Shift+Tab through `hc keys`, only while the agent is neither working nor blocked; the chip list repeats it until the footer shows the chosen mode.
10. `0010-approval-detail.patch`: the approval card shows the call's description (helper field `detail`, see helper patch 0004) under its title.
8. `0008-reply-while-blocked.patch`, embedded mode only: while the agent is blocked (question or approval), the reply box shows "Responda apenas pelo card de pergunta." and does not send. The note turns red after a send is tried and goes away with the block.
9. `0009-mode-key-chat-wide.patch`: Shift+Tab for the next mode works with the keyboard anywhere in the chat view (key context on the chat root), not only in the reply box. Outside the chat it stays the terminal's.
12. `0012-minimize-card.patch`, chat view only: Minimize folds the question or approval card into one line (title, current question or the call's description, note), and Expand restores it. The state belongs to the request: a new request shows in full. Folded, the card ignores 1-9 and Enter, so no answer goes out by accident; Expand to answer. The message list takes the freed space and keeps the newest message in view.
13. `0013-question-history.patch`: an answered question in the history shows each question (with its header) followed by the answer in a bubble, "Skipped" for an empty one, instead of "Question answered". It uses the `answers` the helper's `question` row already carries; no helper change. A declined question reads "Question declined"; when the answers could not be matched, the old note stays. Heights in `estimate.js` (`qaPairs`), sizes in `metrics.js`.
11. `0011-approval-options.patch`: the approval card lists every option the agent offers (helper field `options`, see helper patch 0005), one row each, keys 1-9. "Yes" (1) and "No" use the existing allow and deny (Esc); any other option goes through `approve --choice <digit> --label <text>`.

## Helper patches

Applied to the Rust source before `cargo build` (see [Build pipeline](/architecture/build-pipeline.md#helpers)). Each adds tests; `cargo +1.90.0 test -p herdr-core` passes.

1. `0001-paste-own-answers.patch`: an own answer with non-ASCII text or line breaks is pasted with hc `terminal.send` (`force: true`, which also presses Enter) instead of typed key by key; hc `terminal.keys` knows ASCII key names only and refused the whole answer (`unknown key "ã"`). Only where the text is followed by Enter (single choice; Codex notes); elsewhere (multi-choice) it is refused before any key with a clear message. Carriage returns and other control characters stay refused.
2. `0002-claude-question-gutter.patch`: Claude Code 2.1.323 draws a `│` gutter before the question text. The key gate's exact compare (`claude_exact`) and the screen parser read it as text, so every key of every answer was refused, reported as "another agent is in this pane now". The gutter is dropped from the question text, and from the review screen of a multi-question request, where it stands before a later question's `●` (that refused the final "1", Submit answers). The same gutter was the "|" seen in cards read from the screen.
4. `0004-approval-detail.patch`: the approval card carries `detail`, the call's own description (Claude's Bash `description`), which the helper already read from the log but did not send.
5. `0005-approval-options.patch`: `box_options` reads the option rows of Claude's permission prompt (wrapped rows joined); the card carries them as `options`; `approve --choice <digit> --label <text>` presses that digit only while the same prompt is open and its row with that digit still reads exactly that text (`respond_choice_if_open`). Grok prompts are refused.
3. `0003-gate-refusal-reason.patch`: the key gate records why it refused (`agent`, `screen`, `allowed`). A screen refusal of a question answer now says "the question on screen did not look as the card expects" instead of "another agent is in this pane now", and writes the expected request and the screen read to `~/.cache/flockbook/gate-refusal.txt`.

The former patches `0001-monokai-theme` and `0002-linux-keys` served only the removed layout. The mod draws with `theme()`, so it follows Monokai from settings.json.

## Runtime surface

The helper reads agent session logs (`~/.claude/projects/`, `~/.codex/sessions/`, `~/.grok/sessions/`, `~/.cursor/projects/`, `~/.pi/agent/sessions/`, `~/.gemini/antigravity-cli/`). It runs `hc` to read screens and to send keys and text, but only on a press or a key. In embedded mode it no longer reads `<home>/layouts/.state/flockbook.json`. On Linux the + file dialog is off; attach files by dropping or pasting them.

## Watch out

- Upstream builds and tests on macOS only. Verified here on Linux: the embedded chat renders in Monokai and shows a live Claude Code session.
- The base layout relies on `props.embed` and `shared("flockbook.screen")`. After `vendor --update`, check that the patch still applies and that both still mean the same.
- The mod and helper must come from the same commit (`protocol`). Bump both together by changing the pin: `plugin.json` drives both.
- Do not add a `mod:flockbook` section to keys.json: upstream reports that it breaks every key.

[^fb-recipe]: Flockbook herdr-app RECIPE.md
[^fb-protocol]: flockbook-modfeed protocol
