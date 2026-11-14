#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
make -C guest clean
make -C guest -j2 TOOLPREFIX="${TOOLPREFIX:-riscv64-linux-gnu-}" kernel/kernel fs.img
python3 tools/package-guest.py
