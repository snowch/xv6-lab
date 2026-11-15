# xv6 Lab

**[Open the lab](https://snowch.github.io/xv6-lab/)** · [Companion book](https://snowch.github.io/computer-systems/) · [Open in Codespaces](https://codespaces.new/snowch/xv6-lab)

Learn how an operating system works, one small experiment at a time. A real xv6 RISC-V kernel executes locally in a WebAssembly worker. Its console, process records, trapframes and page tables come from actual guest execution.

## Complete core curriculum

25 lessons follow **predict → run and observe → explain → vary → retrieve**. Each has a concrete outcome, saved prediction, guided experiment, concept map, optional hints and expected observations, misconception-specific quiz feedback and a transfer question. Completion is the learner’s explicit choice; neither output nor a quiz answer automatically grants mastery.

| Experiments | Focus |
| --- | --- |
| 1–6 | Boot, system calls, fork, pipes, redirection, instruction stepping |
| 7–9 | PID, exec identity, exit/wait and memory isolation |
| 10–13 | dup/shared offsets, unlink lifetime, hard links, pathname traversal |
| 14–16 | sbrk, real Sv39 page-table walks, contained user faults |
| 17–20 | Saved trapframes, scheduling, timer sleep/wakeup, blocking pipes and EOF |
| 21–24 | Spinlocks, buffer cache, indirect blocks, transaction commit and recovery reasoning |
| 25 | End-to-end capstone connecting processes, VM, IPC, scheduling and exit |

**Run this experiment** boots if necessary, waits for the shell and prepares the command/breakpoint. A breakpoint is global: shell or other kernel activity can reach it first. Continue resumes the same machine. Commands wait for a shell prompt; interactive programs accept direct console input, including Ctrl-D.

## Inspect the real kernel

- Pause/continue, instruction step, one-shot named breakpoints, registers and disassembly.
- A matching source excerpt for the current kernel instruction, plus an in-page full source reader.
- Process table: PID, name, state, virtual size, open descriptor count, saved user epc/a0/a7.
- Per-process Sv39 walker: actual indices, PTEs, permissions and translated physical address, or an unmapped result.
- Eight-byte virtual-memory reads in the current CPU context.

Stop inside a kernel function (for example `sys_getpid`) before reading processes or walking page tables. Refresh selects `lab` when present. CPU registers and saved user registers are different contexts. Optimization can associate multiple instructions with one source line; stepping is at instruction level.

Reading text is at least 18px on desktop, tablet and phone. Tablets use a full-width Lesson/Live machine switch and a collapsed curriculum instead of a fixed sidebar. Advanced tools remain in disclosures. Lesson/machine jumps, keyboard focus, coarse-pointer touch targets and reduced-motion preferences are supported.

## Run and test

```sh
npm ci
npm test
npm run serve
# http://localhost:8000
```

Requires Node 24; local serving uses Python 3. The checked-in assets run without a compiler, server backend, account, SharedArrayBuffer or special hosting headers. All runtime assets are served from the repository.

Tests drive all 25 lessons through the application using the actual Wasm worker and guest images, check guest outputs, breakpoints, source mapping, process/trapframe reads and real page-table translations. Independent runtime and interface tests also check error recovery, progress, predictions, grading, reset and asset hashes. GitHub Actions builds the guest from source before running these tests and deploying Pages.

## Build or modify the guest

`guest/` vendors xv6 at **d7c0a1b7a703f7366942092f9cf421b6cd111a36**, with the additions listed below. `guest/user/lab.c` contains the experiment programs. Edit them in Codespaces, the dev container, or Linux with the RISC-V cross toolchain:

```sh
# Debian/Ubuntu dependencies:
sudo apt-get install gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu make gcc perl python3
./tools/build-guest.sh
npm test
```

The build packages the ELF, disk image, DWARF source associations, complete source text, ELF symbol addresses, host-computed process-field offsets, and hashes. Run it after any guest change so inspectors stay consistent. Compiler versions can change binary bytes and source mappings; this is a rebuildable pinned source tree, not a claim of identical output from every toolchain.

Local guest changes: add `user/lab.c` and its Makefile entry; use explicit RV64GC/LP64D, O3 flags; expose **16 MiB of guest RAM**. The upstream precompiled debugger’s memory bounds check compares a byte offset with a u64 element count. Restricting the guest’s managed RAM to 16 MiB keeps its allocations inside the debugger-readable range while leaving the upstream Wasm unchanged. This also reduces boot work. Generated inspector metadata comes from this configured build, not guessed struct offsets.

## Functional scope

This is a single-hart functional lab. It does not claim hardware timing, real multicore contention or weak-memory coverage. Logging lessons execute filesystem operations and examine actual commit/recovery code, but do not claim a physical power-loss experiment. Reset discards session disk changes and boots the original image; it is not crash replay. Draft predictions and progress persist locally with a session-only fallback when storage is unavailable.

Browser-side C compilation, C source-line stepping, persistent disk snapshots and multi-hart emulation are not supplied. Guest C can be edited and rebuilt with the included toolchain setup. Functional and Chromium rendering checks are automated. Safari, Firefox, physical-device and assistive-technology verification remain unperformed.

## Provenance

[Runtime notice](site/vendor/NOTICE.md) · [Asset/build manifest](docs/assets.json) · [Design and learning review](docs/design-learning-review.md)

New code is MIT licensed. xv6 and riscv-rust retain their MIT licenses. The RISC-V assembly lab is a separate project.

## Design and browser UX checks

The [design and UX review](docs/design-ux-review.md) records the Frontend Design and Web Interface Guidelines skills used for this pass. The interface now uses self-hosted Source Sans 3 and IBM Plex Mono, clear lesson search, shareable workspace views and reset confirmation.

```sh
# Debian/Ubuntu: sudo apt-get install chromium
npm run test:browser
# Or: CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

The browser runner serves the site on an ephemeral local port, executes real guest interactions and saves previews under `.artifacts/`. CI repeats these checks at desktop, tablet and phone viewport sizes. Font licenses are in `site/fonts/`.
