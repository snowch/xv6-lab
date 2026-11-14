# Design and learning review

## Guidance and scope

The Sites skill’s design guidance informed the visual hierarchy, subject-specific presentation, progressive interaction and responsive layout. Hosting remains the explicitly requested GitHub Pages setup. No dedicated instructional-design skill was available in the session; the learning review directly applies clear outcomes, prediction, guided practice, feedback and retrieval. No claim is made that an external learning skill or learner study validated the course.

## Problems addressed

- The initial large hero and three-column layout competed with the lesson. A compact introduction, quiet course sidebar, focused reading column and adjacent machine now establish a clearer hierarchy.
- A beginner had to coordinate boot, shell readiness, pause, breakpoint selection, resumption and command entry. The guided action prepares these steps, while leaving manual controls available.
- Advanced registers appeared before the learner needed them. CPU and memory panels start collapsed; a pause opens the CPU panel in context.
- Predictions were rhetorical. Learners can now save a prediction and revisit it alongside the explanation.
- Wrong answers received generic feedback. Each distractor now has an explanation that addresses its specific misconception.
- Lessons did not state what a learner should be able to explain. Each now has an outcome, prerequisites, an observation prompt, a takeaway and a transfer question.
- A command could be submitted before the guest shell was ready. The command field now waits for a prompt and disables while paused or executing a command. Fatal worker errors offer a fresh boot instead of leaving controls in a misleading state.

## Learning flow

1. **Predict:** write an optional short explanation before seeing expected output.
2. **Experiment:** run the real guest, use the observation prompt and compare with optional expected observations.
3. **Explain:** connect behaviour to a labelled concept map and a concise mechanism; vary one condition.
4. **Retrieve:** answer a multiple-choice question with specific feedback, then explain a transfer question before revealing an explanation.

All six lessons remain independently accessible. Predictions and completion are saved locally, with session-only fallback when storage fails. Quiz answers and a successful command do not mark a learner as having mastered a concept. Static concept maps are explicitly distinguished from live machine state.

## Accessibility and interaction

Keyboard focus, a skip link, semantic headings, named console/regions, text feedback in addition to colour, explicit selected-answer state, responsive navigation, coarse-pointer touch targets, and reduced-motion-aware scrolling are included. The terminal is not an automatically announcing live region, avoiding a stream of screen-reader interruptions. Status and error messages have dedicated live feedback.

## Verification and limits

Automated DOM tests exercise navigation, predictions, grading, explicit completion, machine controls, memory commands, reset and lesson/machine jumps. An integrated DOM harness connects the actual application to the shipped Wasm worker and runs all six guided experiments, including initial boot, shell readiness, breakpoints, stepping and file output. Existing independent guest/runtime and asset-integrity tests remain in place.

No desktop browser-control tool was available, so rendered screenshots, physical-device layout checks and assistive-technology testing were not performed. These checks do not establish learning efficacy; observation with beginner learners is still needed. Runtime provenance and the existing limits on source builds and advanced inspectors are unchanged.

## Completed core course and readability revision

The course now has 25 experiments covering the core xv6 mechanisms through an end-to-end capstone. The screenshot supplied by the learner showed that the prior compact typography and persistent tablet sidebar were unsuitable. Reading text is now 18px (17px on phones), with larger supporting text and controls. At tablet widths the sidebar becomes a collapsed course menu and the workspace uses explicit full-width Lesson/Live machine views. Wide desktops retain adjacent panels.

The guest is now rebuilt from pinned, vendored xv6 source with a dedicated experiment program. Live process/trapframe and page-table readers, matching instruction/source excerpts and a full in-page source reader replace the earlier deferred inspector work. The integrated test now drives all 25 lessons, verifies their outputs and inspects actual guest records/PTEs. Byte offsets come from the same source build. The original six-lesson assessment above records the initial review; these changes supersede that scope. Rendered browser, real-device and beginner-learning studies remain unperformed; no learning-efficacy claim is made.
