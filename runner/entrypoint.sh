#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$XDG_RUNTIME_DIR" && chmod 700 "$XDG_RUNTIME_DIR"

# Virtual screen: Meet blocks headless browsers, so the bot runs a real window on a fake display.
Xvfb :99 -screen 0 1280x720x24 -nolisten tcp >/dev/null 2>&1 &

# Sound server. Each meeting gets its own virtual speaker inside it.
pulseaudio -D --exit-idle-time=-1 --log-target=stderr
for _ in $(seq 1 20); do pactl info >/dev/null 2>&1 && break; sleep 0.5; done

exec /app/node_modules/.bin/tsx /app/src/index.ts
