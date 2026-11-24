# Shared course controls and xv6 runner adapter

Copyright © 2026 Christopher Snow.

Follow the [course design guide](https://github.com/snowch/cuda-python-lab/blob/main/docs/course-design-guide.md), [verified offline/update contract](https://github.com/snowch/cuda-cpp-lab/blob/main/docs/offline-update-design.md) and [shared runner design](https://github.com/snowch/cuda-python-lab/blob/main/docs/code-runner-design.md). This document describes xv6-specific adaptations and limits.

## Two learning surfaces, one set of controls

The course has 99 source-led lessons and a separate 25-experiment kernel explorer. Keep both: the source editor and Build & run remain the primary source-lesson interface; the explorer keeps its prediction, command, breakpoint, step and inspector workflow. Existing lesson paths, old redirects, source-draft and explorer-note/completion keys remain intact. Preparing tools executes no learner code.

The common header exposes Code runner, App status and Theme. Course lessons opens an inline grouped outline with progress and breadcrumbs. In the explorer the same row opens its searchable experiment outline, rather than keeping a second fixed sidebar. Source lessons have a locally packaged official Material References row scoped to their matching source/context, followed by an explicit reversible completion mark and previous/next cards. Running code and marking completion are separate actions. Source excerpts, concept diagrams and real kernel inspectors retain their distinct roles and layouts.

Normal desktop homepages keep the existing concept image beside the introduction; narrow layouts stack it after the first action. Header labels remain visible when wrapped. Use native dimmed modal dialogs for settings and essential recovery. Optional resources stay outside the main prediction/action/evidence progression. A theme change must not change source, notes or machine state.

## Prepared tools and disposable source runs

A release-scoped SharedWorker keeps pristine kernel/disk/user bytes, matching source/layout data, compiler/emulator binaries and compiled WebAssembly modules prepared. Without SharedWorker the same host protocol runs per window. A lightweight status connection downloads no WASM. Each source build and execution still uses disposable workers and fresh tool/guest instances; no registers, process state, modified disk or allocator state leaks into a later experiment.

WebAssembly modules are not posted across SharedWorker agent-cluster boundaries. The host sends ordinary bytes and a release cache key. An optional IndexedDB derived-module cache lets execution workers reuse compiled modules; a missing/unsupported cache falls back to those exact prepared bytes. Cache keys include the immutable release URL. Unversioned development builds skip that persistent derived cache. Free memory drops workers and prepared memory; it does not remove the verified offline course or browser-managed code caches.

The first implicit startup opens an immediate persistent native modal before fetching WASM. Escape cancels startup. Explicit header Start acknowledges the resource explanation, so a following Build & run does not repeat it. Defaults are 30 minutes without a run, with persisted 5/15/30/60-minute choices. Never interpret a busy or paused machine as idle. Show preparation/build/running/paused states honestly; do not invent CPU percentages or total-browser memory measurements.

Only one reading window owns the shared execution tools at a time. Another gets an actionable busy response. Source-run completion, Stop and navigation release ownership. Explicit Free memory can stop attached execution workers; when a machine is active or paused, confirmation names the loss of explorer files and CPU/kernel state across open xv6 windows. Idle release never interrupts an owner. This explicit global stop also provides recovery if a closed or suspended window left ownership behind.

## The explorer is a live machine

The explorer keeps its actual worker and machine through guided steps and hash-route changes. Pause, breakpoints, registers, process snapshots and page-table inspection continue to use real guest state. Ownership stays held while the machine is paused or at its shell, preventing idle shutdown. The header reports Paused when that machine is paused. Cancelling Free memory preserves the same breakpoint and machine.

Explorer RAM, processes, descriptors, kernel allocations and guest-created files are session state. They are not represented as restorable browser files. Unlike the Linux guest adapter used by the C systems labs, this adapter has no /root-/tmp-file archive and makes no file-restoration promise. Stop/reset/free actions explicitly disclose the loss; saved predictions, answers, lesson marks and recorded evidence stay. Leaving an explorer document ends its worker, as before.

## Offline course and release identity

The publication build starts from a clean staging directory, includes every authored lesson, source/context data, concept diagram, font, icon/licence, kernel/disk image, compiler and emulator file, and publishes an exact-byte/SHA-256 manifest plus immutable releases/<id>/ copies. Static lesson pages use a document base: the builder resolves asset paths against that base while keeping worker scope rooted at the actual Pages project URL. Root and project-prefix hosting must both work.

Normal top-level online visits request live HTML. Open documents retain pinned dependencies. Automatic version checks are small metadata requests; installation never downloads the complete course. Save offline copy is explicit. Update offline copy stages a complete verified release, then offers Restart to update. Repair reuses verified existing files. Only a whole-manifest scan permits Downloaded and ready to use offline. An interrupted update keeps the preceding complete saved copy usable.

Publication retains older immutable releases and raw aliases for earlier open pages. Retention failure blocks deployment. An immutable file may use a live alias only after its original length and hash match; never mix kernels, layouts, source or compiler versions. Required runtime assets are self-hosted under this lab. Optional GitHub source and companion-book links need a connection and are labelled accordingly.

## Restart, recovery and learner work

A two-phase PREPARE_RESTART / ABORT_RESTART / COMMIT_RESTART transaction asks every affected reading window to save and verify its own snapshot. Busy compilation, preparation, live/paused explorer state, input composition, unavailable source or failed storage veto the restart. A source-loading failure may save its existing durable draft and reload online to recover; it does not erase that draft. Lock editing/navigation briefly while preparing and change the selected release only after all acknowledgements.

Source snapshots preserve the complete editor source, Undo restore, genuine output and captured PID/process evidence, completion, open disclosures, route and scroll. Explorer snapshots preserve predictions, answers, completion and recorded evidence when no live machine remains. Saved output is labelled as an earlier result. A reload never executes code. Compiled executables are not restored into a different release: rebuild the restored source against the current matching kernel/layout before another run.

Missing or incompatible runner files are infrastructure failures, separate from incorrect learner C or a deliberately explored kernel panic. Keep the last genuine result and show a persistent native recovery alert with Reload lesson and Stay on lesson, a dimmed backdrop and focus return. Do not stack over another modal or dismiss on a timer. Save and verify the reading snapshot before reload; storage failure blocks navigation. Compiler diagnostics remain beside the editor. Removing an offline course copy never clears drafts, notes, marks, reading snapshots or another app's storage.

## Verification gates

Run npm test for the existing source/compiler/kernel checks, actual starter/taught-edit execution and guided guest tests. The two DOM suites isolate the header transport with a small fixture; their real Node guest execution remains intact. tests/runner-host.test.js separately uses a minimal empty WASM module to check ownership/paused-idle safety, not learner output.

Run npm run test:browser for every existing source lesson, source edits, diagrams, links, controls and explorer journeys at desktop/tablet/phone widths. The outline assertions now target the inline Course lessons row, preserving their chapter identity, search, navigation and no-overflow checks.

Run npm run test:shared against the published staging build. Its small-release fixture exercises actual worker/snapshot updates, two-window busy/storage veto, exact-release commit and offline reopening. Its real-guest journey saves the complete course before any guest preparation, closes the browser, stops the HTTP server, reopens the same profile offline, compiles and runs user and kernel lessons, checks edited output and restored source/evidence/completion, opens an unvisited page and pauses the actual explorer at sys_write. Cancelling Free memory must preserve that pause; accepting it stops the machine. Check four widths and both themes without altering the model.

Keep local interruptions and failures in the verification record. A timed-out shared host run is not a passing check; require an isolated exact-head CI result before merging. Functional checks do not establish learning effectiveness, physical Android performance or permanent browser-storage retention.

Recovery snapshot identity excludes the operational download and gpu-release query parameters, while keeping lesson hashes, search and step parameters. Recovery may remove those operational parameters before reloading; the same per-window snapshot must still restore. The small-release browser fixture verifies this path.
