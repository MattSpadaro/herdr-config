#!/bin/sh
umask 077
dir="$(cd "$(dirname "$0")/../.." && pwd)/data/agent-usage/sessions"
payload="$(cat)"
sid="$(printf '%s' "$payload" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([A-Za-z0-9_-]*\)".*/\1/p' | head -n 1)"
if [ -n "$sid" ] && mkdir -p "$dir" && tmp="$(mktemp "$dir/.$sid.XXXXXX")"; then
  { printf '%s' "$payload" > "$tmp" && mv -f "$tmp" "$dir/$sid.json"; } || rm -f "$tmp"
fi
[ "$1" = "--tee" ] && printf '%s' "$payload"
exit 0
