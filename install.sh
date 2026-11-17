#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v herdr-app >/dev/null || { echo "herdr-app not found: install the Herdr app and start it once" >&2; exit 1; }
python3 -I herdrcfg.py install --dry-run "$@"
read -r -p "Apply? [y/N] " answer
[[ "$answer" == [yY]* ]] || exit 0
python3 -I herdrcfg.py install --switch chowdr-herdr-ctrl "$@"
