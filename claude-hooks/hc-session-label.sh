#!/bin/sh
# Claude Code hook (SessionStart, UserPromptSubmit): labels this Claude's herdr-core
# terminal with its session, so mods can find the transcript of each agent:
#   cc.session=<session id>  cc.transcript=<transcript path>
# Only acts inside an hc terminal (HC_TERMINAL_ID set). $1: the hc binary (default: hc).
# Prints nothing: UserPromptSubmit output would reach the model.
payload="$(cat)"
[ -n "$HC_TERMINAL_ID" ] || exit 0
sid="$(printf '%s' "$payload" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([A-Za-z0-9_-]*\)".*/\1/p' | head -n 1)"
path="$(printf '%s' "$payload" | sed -n 's/.*"transcript_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1 | sed 's/\\\\/\\/g')"
[ -n "$sid" ] || exit 0
"${1:-hc}" label "$HC_TERMINAL_ID" "cc.session=$sid" "cc.transcript=$path" >/dev/null 2>&1
exit 0
