# Source-led lesson pages

The primary course now follows the useful structure of [assembly-lab](https://github.com/snowch/assembly-lab): contents, a small lesson at its own address, explanation with an embedded interactive example, and Previous/Next navigation. The first two chapters each have six pages. Later chapters are explicitly planned, not represented as completed material.

## Chapter 1: Programs and system calls

| Page | New idea | Small experiment | Matching source |
| --- | --- | --- | --- |
| 1 | Program versus process | Change a greeting and run a program that exits | `user/user.h`: exit declaration |
| 2 | write follows a byte count | Write three bytes from `hello\n` | `kernel/sysfile.c`: sys_write |
| 3 | System calls return values | Compare getpid's result with actual kernel state | `user/user.h`: getpid declaration |
| 4 | ecall enters the kernel | Call getpid twice from the same process | `user/usys.S`: real getpid stub |
| 5 | The current process has a kernel record | Print myproc()->pid inside the handler | `kernel/proc.c`: myproc |
| 6 | A returned answer differs from stored state | Add 1000 to the result and compare process snapshots | `kernel/syscall.c`: saved a0 assignment |

Each page states one objective, explains the required vocabulary before the experiment, shows a short excerpt loaded from the matching xv6 build, gives one change to try, then states the takeaway. Surrounding source and a reflection question are optional details. There is no required predict/run/explain wizard, quiz gate or automatic claim of mastery.

The first two pages show console evidence without introducing PID comparisons early. Later pages add the real process-entry/exit observations when identity becomes the subject. Kernel editing starts only after the user interface, return value and kernel-entry mechanism have been introduced. The final page separates reading a process field, computing a returned value and assigning to state.

## Chapter 2: Processes

| Page | New idea | Small experiment | Matching source |
| --- | --- | --- | --- |
| 1 | fork continues in parent and child with different results | Change the child message; compare zero and positive returns | `kernel/proc.c`: child saved a0 |
| 2 | wait collects an exited child | Wait a second time after collecting the only child | `kernel/proc.c`: wait cleanup and returned PID |
| 3 | Exit status is separate from the PID | Change exit(7) to exit(23) | `kernel/proc.c`: xstate and ZOMBIE assignment |
| 4 | fork gives a child its own user-memory copy | Change only the child's local variable | `kernel/proc.c`: uvmcopy in fork |
| 5 | exec replaces a program without making a process | Change echo's argument and compare entry/exit PIDs | `kernel/exec.c`: committing the image |
| 6 | Failed exec returns to its caller | Replace an absent path with echo and observe which lines disappear | `kernel/exec.c`: failed path lookup |

The fork example needs wait so that it finishes with all its output before the shell returns. That line is supplied and explained on the first page, then demonstrated and practised on the next. It is a deliberate bridge, rather than an unexplained prerequisite. Ordinary memory copying is introduced only after fork's two branches, wait and status collection; page-table mechanics remain a later chapter.

Each example handles fork failure before interpreting the child branch. Waiting makes the child's exit precede the parent's final report without claiming a general scheduling order. ZOMBIE means the user program has finished and a retained record awaits collection. xv6 copies its integer exit status into the parent's supplied address; it does not return that status as wait's PID result.

The successful exec example uses the existing echo executable, keeping the C example small. The workbench reads the real PID at getpid entry, then at sys_exit after echo has replaced the original program. The source excerpt shows the new page table, entry PC and stack pointer being installed. The failure example keeps the old program and its local variable alive; changing the target to echo removes those post-exec reports. Both error paths use a nonzero program exit status if exec returns.

The source excerpt selector accepts a function boundary, so repeated text such as freeproc cannot accidentally display fork cleanup while teaching wait. The build remains the same selected user-program compilation; no native baseline or compiler changes are required for this chapter.

## Layout and navigation

The root is the single course contents page. Each lesson has a static page at `lessons/<concept>/`, a chapter position, a chapter menu and Previous/Next links. The lesson's prose is visible as a readable article; the editable C and actual guest console sit together below its experiment instructions. On phones they stack with a persistent result anchor. A last-visited link resumes a lesson without treating a visit as completion.

The existing 25 experiments live at `/explorer/` and retain their original functionality and saved progress. Root `#<old-lesson>` links retain query parameters while redirecting there. `/workbench/#user` and `/workbench/#kernel` redirect to their corresponding source lessons and migrate the old drafts without deleting them.

The visual direction retains readable 18–19px prose, 16px editable C, Source Sans 3, IBM Plex Mono, quiet blue paper and teal source explanations. Decisions follow the previously applied [Frontend Design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) and [Web Interface Guidelines skill](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md). Required explanations remain visible; supplemental source and reflection can be expanded.

## Build and state boundaries

All compilation and guest execution happen locally. This is an incremental selected-unit build, not a full browser make build. An unchanged WebAssembly TCC binary emits RV64 objects; the JavaScript ELF linker resolves them against matching native xv6 images and installs code into reserved executable slots. Kernel globals use a separate writable region. Compiler licenses, complete corresponding source and limits remain in the [runtime notice](../site/workbench/NOTICE.md).

Each lesson saves its own draft; new pages start with focused examples rather than silently inheriting the previous page's changes. Download and restore/undo work independently of compilation. Failed builds preserve the last valid image and output. Builds are tied to source snapshots, so an edit during compilation cannot automatically run an outdated image as though it matched. Build cancellation and stop controls preserve source. Leaving a lesson cancels background work and leaves controls usable when returning through browser history.

The evidence panel reads the actual process table at the first sys_getpid entry and process exit, and parses real UART output. It does not infer results from source text. Removing the probe or changing process control flow can leave partial or different evidence. Each run boots a fresh disposable guest.

## Verification and review

Native xv6 sources and compiler binaries are unchanged by this flow change. Tests compile and execute all twelve lesson examples and the taught byte-count, repeated-call, kernel-print, fork/wait/status, memory-copy and exec edits in the actual RISC-V emulator. Existing tests cover kernel-return changes, writable kernel data, real diagnostics and all 25 explorer experiments.

Chromium walks every new lesson through Next, returns through Previous and browser history, checks the contents/resume links and tests desktop, tablet, phone and small-phone widths. The existing source build/error/recovery flows run on desktop/tablet/phone. Screenshots are inspected for readable prose, source placement, navigation and overflow, and retained as CI artifacts. CI regenerates the static pages and editor bundle to catch stale committed output.

The teaching review checks that processes are introduced before PIDs, return values before the handler, and the system-call boundary before kernel editing. Source terms such as noreturn, register, trap, dispatcher and trapframe are explained at first use. CPU interrupt bracketing is identified as a later topic so it does not become an unannounced prerequisite for reading myproc.

Chapter 2 verification also compares the observed process PID at syscall entry and at exit after exec, checks that successful exec never reaches old-program reports, and exercises both absent and valid executable paths. Mobile browser cases edit exit status and exec arguments, compile them, and inspect actual output. Cache versions cover the changed lesson catalogue, new chapter module and generated page entry scripts.

Screenshot review found that a 330px editor hid the parent branch of the longer fork examples. Those lessons now provide a taller editor, with a smaller height for the shorter exec examples. The height is fixed for each starter rather than changing while learners type, so edits do not continually shift the surrounding page.
