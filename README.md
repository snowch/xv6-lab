# xv6 Lab

Learn how an operating system works, one small experiment at a time.

**[Open the lab](https://snowch.github.io/xv6-lab/)** · [Systems From Scratch](https://snowch.github.io/computer-systems/)

A real xv6 RISC-V kernel runs locally in a WebAssembly emulator inside a browser worker. The terminal is guest UART output; commands execute guest binaries. No server, account, cross-origin-isolation headers or shared memory is required.

## First increment

Six small lessons follow predict → run → inspect → change → check:

1. Boot and meet the shell.
2. Follow a write into the kernel.
3. Catch the shell creating a child process.
4. Connect programs with a pipe.
5. Redirect output into a file.
6. Pause and step kernel instructions.

The live machine supports boot/reset, pause/continue, instruction stepping, one-shot kernel-function breakpoints, integer register snapshots, disassembly and eight-byte virtual-memory reads. Breakpoints resolve symbols from the actual guest ELF. Completion is explicitly marked and saved locally per lesson; quiz answers do not automatically complete a lesson. Storage failures keep marks for the current tab session.

Wait for the `$` prompt before sending shell commands. Click/focus the console for direct keyboard input; Ctrl-D sends guest EOF. Reset terminates the worker and boots the original disk image, discarding session changes. The console retains the last 100 KB of output.

## Run and verify

Requires Node 24 and Python 3 for the local server.

```sh
npm ci
npm test
npm run serve
# Open http://localhost:8000
```

Tests execute the shipped Wasm against the shipped kernel/disk, check real shell output, hit kernel breakpoints, step instructions, and exercise the worker protocol and lesson interface. There are no simulated success responses. GitHub Actions runs the checks before deploying `site/` to Pages on `main`.

## Scope and next increments

This lab teaches function, not hardware performance. One emulated hart is enough to demonstrate process scheduling, traps and blocking. Guest instruction ticks are not hardware cycles.

This version does **not** yet provide an editor/compiler, source-line stepping, process-table/trapframe visualization, a page-table inspector, persistent disk snapshots, or multicore execution. Lessons describe those boundaries where relevant. Students run and vary existing guest commands; they cannot rebuild guest C from the webpage yet.

Next: pin and reproducibly build a matching xv6 source tree; add a tiny editable user program and `getpid()` experiment; then process/trapframe and page-table views. Preserve the small-lesson structure as capabilities grow. The RISC-V assembly lab is a separate project.

## Runtime provenance and licenses

See [NOTICE](site/vendor/NOTICE.md) and [asset hashes](docs/assets.json). This initial increment vendors riscv-rust’s known-compatible legacy xv6 images and its precompiled Wasm. The originating emulator commit is pinned, but the exact xv6 source commit used to build those upstream binaries is not recorded by upstream. Source links therefore open current xv6 for orientation and do not claim line-for-line correspondence.

New lab code is MIT licensed. riscv-rust and xv6 retain their MIT notices. All runtime assets are served from this repository.
