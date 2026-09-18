#!/bin/bash
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 music_helper.py
elif [ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" ]; then
  "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" music_helper.py
else
  echo 'Python 3 is required. Ask Codex to help install Python 3, then reopen this file.'
fi
read -r -p 'Press Return to close.'
