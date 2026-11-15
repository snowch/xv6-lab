# Source workbench preview

The course needs a different centre of gravity when learners can edit xv6. A fixed prediction/observation/check wizard hides the source while the learner needs to compare explanation, code and behaviour. This preview starts a new interface at `/workbench/` rather than replacing the existing 25 lessons before the model is proven.

## Design and teaching decisions

The desktop workspace has three stable regions: a short source explanation and assignment, the editable C file with its build messages, and the actual running machine with observed state. The code remains mounted during builds and runs. There is no required sequence of prediction forms, tabs or completion gates. Learners can read, edit, compile, inspect and repeat as needed.

The first exercise changes `user/workbench.c`, then runs that compiled program on xv6. It introduces the user/kernel boundary through `getpid()` and links to matching syscall declarations, assembly and handler source. The second edits the actual `sys_getpid` function from `kernel/sysproc.c`. Adding 1000 to its return expression changes an interface result while leaving the stored process identity alone. The explanation distinguishes returning a field from assigning to it; the evidence panel makes the distinction observable. Reflection is optional and anchored in the experiment, without imposing a separate workflow.

Supporting source is explicitly labelled **baseline source (read-only)**. It is useful context, not a claim that the whole source tree is editable. The kernel editor says **function only**, uses original source line numbers, and exposes matching types and kernel declarations through the bounded build context.

The visual direction extends the engineering workbook palette: pale blue paper, white code surfaces, blue actions, teal explanations, Source Sans 3 prose and IBM Plex Mono code. Prose stays at 18px, editable C at 16px. Horizontal panes collapse into explanation above an editor/console pair on tablets, then a full-width stack on phones. Main actions remain fixed and a result anchor becomes available when a run starts. No automatic page jump is required. Native controls, keyboard shortcuts, visible focus, a skip link, accessible editor labels, live build/status messages, reduced-motion support and safe-area spacing support keyboard and touch use.

These decisions apply the previously used [Frontend Design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) and [Web Interface Guidelines skill](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md): deliberate visual hierarchy, readable text, stable navigation, explicit feedback and testing the actual responsive interface.

## State and recovery

- Each exercise has its own browser-saved draft. A storage failure leaves the draft in the tab and explains how to download it.
- Restore starter offers an immediate undo. The current source can be downloaded independently of build success.
- Builds run in a disposable worker with separate download and compilation timeouts. Cancel build keeps the draft and last valid image. Compilation diagnostics use edited file names and line numbers.
- A successful build is tied to a source snapshot. Editing during compilation cannot automatically run an outdated build as though it matched the draft.
- Compiler errors preserve the last valid build and existing console. Stop run interrupts a loop or waiting program and preserves source and output.
- Each run starts from a fresh disposable guest. A completed guest is retired to avoid consuming CPU while the learner reads. The console remains visible and identifies its source exercise.

## Implementation boundary

This is a working two-exercise preview, not a port of the full curriculum. The browser compiles freestanding C with an unchanged WebAssembly build of Tiny C Compiler targeting RV64. A small ELF linker relocates the edited object against the matching native baseline and redirects the original function entry to a reserved executable slot. Kernel globals have a separate writable slot. User programs replace the existing guest file in a disposable xv6 filesystem image.

It is an incremental selected-unit build, not a full browser `make` rebuild. Source/object limits, unsupported relocations and unresolved symbols produce explicit errors. The compiler, LGPL license, complete corresponding source archive and revision are included with the static site; see [the runtime notice](../site/workbench/NOTICE.md). Asset hashes cover the compiler, archive and matching baseline as well as the existing guest/runtime.

The evidence panel reads the real process table at syscall entry and process exit. It compares those observations with the probe's actual UART output, rather than manufacturing results from the edited source. Removing the probe, changing process control flow or faulting can leave partial or different observations; the panel explains missing comparisons.

## Verification

Node tests compile and execute edited user code and kernel code in the actual RISC-V WebAssembly emulator, exercise writable kernel globals, and reject genuine compiler/linker errors. The existing course tests still exercise all 25 lessons and real guest kernel inspection.

Chromium tests cover wide desktop, tablet and phone workbenches: source editing, compilation, actual output and process evidence, error recovery, restore/undo, runtime errors and horizontal overflow. Existing course viewport and inline inspection checks run in the same suite. CI rebuilds xv6 from pinned sources and checks the committed CodeMirror bundle against its source; screenshots are uploaded as the `browser-previews` artifact.
