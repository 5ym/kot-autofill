#!/bin/sh
# Xvfb をバックグラウンドで起動し、bun をメインプロセスとして exec する。
# (xvfb-run はコマンド終了後に Xvfb の後始末でハングするため使わない。
#  exec しておけば bun の終了 = コンテナの終了になり、Xvfb は道連れで消える)
Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp &
export DISPLAY=:99
exec bun run src/index.ts "$@"
