# xv6 Lab

**[Open the lab](https://snowch.github.io/xv6-lab/)** · [Companion book](https://snowch.github.io/computer-systems/) · [Open in Codespaces](https://codespaces.new/snowch/xv6-lab)

Learn how an operating system works, one small experiment at a time. A real xv6 RISC-V kernel executes locally in a WebAssembly worker. Its console, process records, trapframes and page tables come from actual guest execution. The complete functional course contains **15 chapters and 99 source-led lessons**.

## Concept diagrams

91 lessons include a relevant diagram beside the explanation, covering 49 mechanisms and relationships. Eight diagrams have manual steps for following changes, including page-table walks, scheduling, lock handoff and journal recovery. Their labels remain readable on phones; keyboard controls and complete text transcripts support alternative ways to follow each sequence.

These are original drawings and explanations authored for this repository under its MIT license. Each names the matching xv6 source anchors. They illustrate mechanisms independently of the live guest; building and running still supplies the actual evidence. See [diagram provenance and inventory](docs/concept-diagrams.md).

## C prerequisite

Be comfortable reading small C programs: variables, conditions, loops, function calls and return values. The [course contents](https://snowch.github.io/xv6-lab/#c-prerequisites) links focused [C Foundry](https://snowch.github.io/c-foundry/) refreshers for those skills; completing its whole course is unnecessary.

Each lesson has a short, expandable C reminder beside the reading, covering the syntax it uses, including pointers, arrays and structs. Optional links open the relevant C Foundry topic in a new tab so your xv6 lesson and draft stay in place. xv6’s own headers and system calls are introduced in this lab.

## Chapter 1: Programs and system calls

The main entry point is a course contents page. Six short lesson pages each teach one concept through explanation, matching xv6 source, one runnable experiment and a takeaway. Previous/Next links connect the pages; the chapter menu allows direct access without gates. Drafts are saved separately for each lesson.

1. A running program is a process.
2. The kernel writes your bytes.
3. A system call returns a result.
4. `ecall` crosses into the kernel.
5. The kernel finds the current process.
6. A returned value is not the stored value.

The browser compiles real C to RISC-V using a WebAssembly build of TCC and incrementally links the selected program or kernel function against a matching native-built baseline. It does **not** rebuild all of xv6 in the browser. Each run uses a disposable machine. See [design decisions](docs/source-workbench.md) and [compiler provenance and limits](site/workbench/NOTICE.md).

## Chapter 2: Processes

Six more source-led lessons continue directly from Chapter 1:

1. `fork` creates a child process.
2. `wait` collects an exited child.
3. A child returns an exit status.
4. Parent and child have separate memory.
5. `exec` replaces the program.
6. A failed `exec` leaves the caller running.

These examples compile real user programs and exercise xv6's process implementation. Relevant excerpts come from `kernel/proc.c` and `kernel/exec.c`; no PID, status or memory results are simulated. The exec lesson compares actual kernel PID snapshots before replacement and at the replacement program's exit. Chapter menus are local to each chapter, while Previous/Next links continue across the boundary.

## Chapter 3: Memory

Six lessons cover growing user memory, page mappings, zeroed pages, shrinking memory, a contained child page fault, and checked kernel copies. Each includes a complete compiled experiment and the matching allocation, translation or trap-handling source. The invalid console pointer example teaches this pinned kernel's actual zero-byte result.

## Chapter 4: Files

Six lessons connect process-local descriptors to open-file offsets, shared file objects, inode lifetime, hard links and transaction-backed writes. Suggested edits include replacing dup with an independent open, retaining an unlinked name, observing link counts, and verifying a 13,000-byte file beyond the direct-block boundary.

## Chapter 5: Pipes

Six lessons teach pipe endpoints, EOF, inherited references, byte streams, blocking reads, and stdout redirection through dup and exec. Examples close unused ends and loop over short reads; the final example runs the existing echo executable through a real pipe.

## Chapter 6: Scheduling

The final six lessons cover timer sleep, runnable processes, the sleeping parent in wait, wakeup channels, killing a sleeper, and locks protecting shared kernel pipe state. The wait lesson displays a saved snapshot read from actual process records, including parent PIDs. The final example combines two writers, byte-stream reads, EOF and child collection while tracing the protected pipe counters.

The six foundation chapters contain **36 source-led lessons**. Nine further chapters cover the kernel mechanisms below; [the coverage matrix](docs/comprehensive-course.md) maps the complete course. The contents page links every lesson; the kernel explorer supplies 25 additional inspection experiments. Functional scope remains one emulated hart, bounded incremental C builds and disposable guest filesystems.

To regenerate the committed lesson pages after changing `site/workbench/lessons.js`, `site/workbench/chapter2.js` or `tools/workbench-page.html`, run `npm run build:lessons`. To regenerate the CodeMirror bundle after changing its source, run `npm run build:editor`. CI verifies both generated outputs. The existing guest build regenerates the matching workbench baseline ELF.

## Chapter 7: Boot and kernel organization

Six lessons now replace the actual kernel main function: change boot output, follow the initial stack calculation, read the real paging-mode register before/after installation, allocate/free a physical page, inspect the initialized process table, and find the first runnable user process. This completes the first kernel-internals chapter; the course continues with address translation below.

Native instruction helpers bridge RISC-V inline assembly that TCC cannot assemble. The baseline preserves function boundaries for incremental kernel edits; kernel globals use real ELF symbols and reserved GOT pointer cells. The C compiler binary remains unchanged.

## Chapter 8: Address translation

Eight lessons split virtual addresses, walk actual Sv39 entries, compare permission bits, inspect RAM/MMIO mappings, exercise a real guard-page fault, compare trampoline/trapframe mappings, and test checked copies across page boundaries. The next chapter follows these mappings through traps and system calls. Kernel lessons with a supplied user test program expose its exact source in an optional disclosure.

The original emulator ignored PTE_U. The lab now uses a source-built permission correction for U/S, SUM and MXR, with cache invalidation and five focused Rust tests. A supervisor interrupt correction also prevents timer acknowledgement from erasing a pending disk interrupt, with three focused Rust regressions. The full patched source, lockfile, dependency licenses and rebuild script are included. See [runtime provenance](site/vendor/NOTICE.md).

## Chapter 9: Traps and system-call machinery

Six lessons inspect saved registers, trace ecall causes, change the saved return-PC advance with bounded child cancellation, redirect the actual dispatch table lookup, alter decoded sleep arguments, and change the privilege chosen for return to workbench. The next chapter follows the interrupt and device paths. A deliberate kernel panic stops the VM cleanly; restoring the starter and rebuilding boots a fresh machine.

## Chapter 10: Interrupts and device drivers

Eight lessons connect timer delivery to logical ticks, read the supervisor interrupt-enable bit, observe actual PLIC claim/completion IDs, query UART registers, change bytes entering its transmit ring, exercise console line editing, inspect VirtIO descriptor directions, and inspect the disk-completion/cache-validity boundary.

The IRQ observer and its arming syscall hook are compiled together and share real kernel state. Console editing feeds the real callback directly and explicitly distinguishes that test from hardware IRQ delivery. Source excerpts select actual function definitions rather than earlier calls with the same name.

## Chapter 11: Context switching

Six lessons distinguish kernel contexts from trapframes, inspect the actual saved stack pointer, observe yield's state transition, trigger a guarded invalid switch, count real user timer preemptions, and follow sleep's acquire-before-release lock handoff. Restore the deliberate panic by restoring the source and building a fresh machine.

## Chapter 12: Locks and coordination

Seven source-led pages exercise atomic exchange, CPU ownership, nested interrupt restoration, protected publication, sleeping locks, channel/predicate coordination and lock order. Bounded child cleanup makes a mismatched wakeup observable, and recursive acquisition deliberately triggers the native guard. Memory-ordering explanations distinguish the implementation guarantee from what a one-hart run can demonstrate.

## Chapter 13: Filesystem structure

Eight pages follow the superblock, buffer identity and pins, lazy inode metadata, relative and absolute paths, bitmap allocation, direct/indirect block mapping and truncation. Probes use actual kernel objects; the supplied thirteen-block file exercises both mapping paths.

## Chapter 14: Logging and recovery

Six pages cover reservations, absorption, the last outstanding operation, the header commit point, actual boot replay and redo idempotence. Recovery uses an explicit prepared committed journal whose README home byte is O and logged replacement is R; the kernel performs the replay. Skipping installation leaves O, and two real replay passes still produce R.

## Chapter 15: Loading programs and integration

Eight pages load actual ELF headers and segments, change real BSS initialization, reconstruct argv, edit the complete exec function's entry stack pointer, preserve the old image on failure, compose shell redirection and trace a pipe-to-file-to-cat capstone. The native BSS fixture has a real NOBITS region; it is not a file-backed browser link-slot test.

All chapters are available. Every starter and suggested edit is compiled and executed against the real guest; the frontend is checked on desktop, tablet, phone and small-phone layouts.

## Kernel explorer

The [existing 25 kernel experiments](https://snowch.github.io/xv6-lab/explorer/) remain available as a separate exploration tool. They cover boot, process creation and identity, files, pipes, memory, traps, scheduling, locks, cache, indirect blocks and transaction reasoning. Their original guided prediction/inspection/check workflow is preserved there. Existing root lesson deep links and the old workbench links redirect to the appropriate destination.

## Inspect the real kernel in the explorer

- Pause/continue, instruction step, one-shot named breakpoints, registers and disassembly.
- A matching source excerpt for the current kernel instruction, plus an in-page full source reader.
- Process table: PID, name, state, virtual size, open descriptor count, saved user epc/a0/a7.
- Per-process Sv39 walker: actual indices, PTEs, permissions and translated physical address, or an unmapped result.
- Eight-byte virtual-memory reads in the current CPU context.

The observation task automatically shows the relevant CPU, process/trapframe or page-table snapshot at a kernel stop. The page-table lesson walks `0x0` for `lab` automatically. Full manual inspectors remain under Optional debugger, memory & reset. For manual reads, stop inside a kernel function (for example `sys_getpid`) first; Refresh selects `lab` when present. CPU registers and saved user registers are different contexts. Optimization can associate multiple instructions with one source line; stepping is at instruction level.

Reading text is at least 18px on desktop, tablet and phone. Tablets show the current task beside the console; phones stack the same two areas with a fixed-height task region so stepping through the lesson does not move the console. The curriculum is collapsed on smaller screens. Advanced tools remain in disclosures. A persistent step bar, keyboard focus, coarse-pointer touch targets and reduced-motion preferences support navigation. Task regions can be scrolled independently; notes, recent output and source are optional disclosures.

## Run and test

```sh
npm ci
npm test
npm run serve
# http://localhost:8000
```

Requires Node 24; local serving uses Python 3. The checked-in assets run without installing a host compiler, server backend, account, SharedArrayBuffer or special hosting headers. All runtime assets are served from the repository.

Tests compile and execute all 99 source-led examples and their taught edits. They also drive all 25 explorer experiments using the WebAssembly worker and guest images, checking guest output, breakpoints, source mapping, saved registers and page-table translations. Separate runtime and interface checks cover error recovery, drafts, progress, predictions, understanding checks, reset and asset hashes. GitHub Actions builds the guest from source before running these checks and deploying Pages.

## Build or modify the guest

`guest/` vendors xv6 at **d7c0a1b7a703f7366942092f9cf421b6cd111a36**, with the additions listed below. `guest/user/lab.c` contains the experiment programs. Edit them in Codespaces, the dev container, or Linux with the RISC-V cross toolchain:

```sh
# Debian/Ubuntu dependencies:
sudo apt-get install gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu make gcc perl python3
./tools/build-guest.sh
npm test
```

The build packages the ELF, disk image, DWARF source associations, complete source text, ELF symbol addresses, host-computed process-field offsets, and hashes. Run it after any guest change so inspectors stay consistent. Compiler versions can change binary bytes and source mappings; this is a rebuildable pinned source tree, not a claim of identical output from every toolchain.

Local guest changes: add a native NOBITS BSS probe; expose a read-only VirtIO descriptor pointer for compiler-compatible observation; add `user/lab.c`, `user/workbench.c`, their Makefile entries and reserved incremental-link slots; use explicit RV64GC/LP64D, O3 flags with inlining disabled and native instruction helpers; expose **16 MiB of guest RAM**. The upstream precompiled debugger’s memory bounds check compares a byte offset with a u64 element count. Restricting the guest’s managed RAM to 16 MiB keeps its allocations inside the debugger-readable range while retaining that separate debugger limitation in the rebuilt runtime. This also reduces boot work. Generated inspector metadata comes from this configured build, not guessed struct offsets.

## Functional scope

This is a single-hart functional lab. It does not claim hardware timing, real multicore contention or weak-memory coverage. Logging lessons execute actual commit and recovery code. Recovery runs boot a documented prepared committed journal; they do not claim a physical power-loss experiment. Normal runs use fresh baseline images. Explorer reset discards session disk changes rather than capturing a crash image. Source drafts and progress persist locally, as do explorer predictions, with a session-only fallback when storage is unavailable.

The source lessons supply bounded browser-side C compilation. C source-line stepping, persistent disk snapshots and multi-hart emulation are not supplied. Full guest builds use the included native toolchain setup. Functional and Chromium rendering checks are automated. Safari, Firefox, physical-device and assistive-technology verification remain unperformed.

## Provenance

[Runtime notice](site/vendor/NOTICE.md) · [Asset/build manifest](docs/assets.json) · [Design and learning review](docs/design-learning-review.md)

New code is MIT licensed. xv6 and riscv-rust retain their MIT licenses. The RISC-V assembly lab is a separate project.

## Design and browser UX checks

The [design and UX review](docs/design-ux-review.md) records the Frontend Design and Web Interface Guidelines skills used for this pass. The interface now uses self-hosted Source Sans 3 and IBM Plex Mono, clear lesson search, shareable lesson-step links and reset confirmation. The source-led chapter is the primary course flow; the guided workflow remains in the kernel explorer.

```sh
# Debian/Ubuntu: sudo apt-get install chromium
npm run test:browser
# Or: CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

The browser runner serves the site on an ephemeral local port, executes real guest interactions and saves previews under `.artifacts/`. CI repeats these checks at desktop, tablet and phone viewport sizes. Font licenses are in `site/fonts/`.

## Kernel explorer guided-flow state

An explorer task is shareable as `/explorer/?step=observe#pagetables` (also predict/explain/vary/check). In-page return visits remember each lesson’s task. Predictions and completion keep their existing local-storage keys; captured guest output stays available for this tab session. Moving between tasks preserves the guest worker, console DOM node and its files. Completion remains explicit.

A lesson change during boot cancels the queued command without recording a successful run. Automatic inspections that become stale when execution resumes are ignored; manual inspection errors still report their cause. Browser tests verify the five-step path, console identity/position, inline page-table inspection without opening advanced tools, and deep links.
