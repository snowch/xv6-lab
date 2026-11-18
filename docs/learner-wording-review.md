# xv6 Lab wording and interface review

The source course assumes readers can follow small C programs. The Explorer starts with the xv6 shell and builds up to kernel inspection. The review covered the course contents, 99 source lessons in 15 chapters, their 49 concept diagrams, the legacy workbench redirects and all five steps of the 25 Explorer experiments. The source workbench pages are generated from their lesson data and shared template.

## Source lessons

- Each page identifies the editable file, explains what the first visit prepares and says how to run the starter. It identifies a console result or kernel field to inspect before the edit. The separate reference excerpt is read-only.
- The edit directions name **Build & run** and the source expression to change. For example, the first PID exercise compares the program’s reported PID with the kernel PID at system-call entry before and after changing the greeting. The capstone changes the text read by `cat` while keeping the count at 21 bytes.
- The console reports the actual xv6 run. The boot, address, lock and journal examples distinguish inspected state, instrumented probes, illustrative diagrams and emulator limits. The recovery fixture starts from a prepared committed journal. A single emulated processor can demonstrate the inspected protocol and functional outcome.
- The primary action stays visible. Stop appears during build or execution. Separate build controls, source download and compiler details are available together near the editor. Starter evidence, explanations and understanding questions remain visible.
- Build errors name the editable path where available. When a build fails after a run, the previous console and kernel evidence are labelled as earlier evidence. A contained guest fault and a kernel panic have specific status messages. A lesson that successfully observes an `exec` error still completes its run.
- Existing draft and last-lesson keys and old two-exercise keys are retained. Restoring a starter preserves the previous draft under **Undo restore**, including after reload where storage works. If permanent storage fails, a tab-session copy is attempted. If that also fails, download remains available while the page is open.

## Kernel explorer

The stages identify which shell command or breakpoint the lab prepares, what to inspect, and how to continue. Observation guidance and starter evidence are visible. Each variation has a matching action. A shell variation loads a specific command. A debugger variation repeats the required stop. A source-only variation links to the exact editable lesson. For example, **Compare two addresses** walks both the mapped `0x0` and unmapped `0x40000000` for the same paused `lab` process without opening the manual debugger.

The quiz checks an explanation. The completion checkbox records the learner’s choice. Existing predictions, progress and shareable step links retain their storage and route formats.

## Functional verification

The browser route sweep covered 404 course, lesson and redirect visits and 500 Explorer task views at 320, 390, 820 and 1440 pixels with light and dark system preferences. The site uses a light page palette and dark console in both preferences. The sweep found no horizontal page overflow or JavaScript errors. Keyboard runs checked the introductory PID comparison, a failed compile with earlier evidence intact, the capstone, the two-address walk and draft recovery. The guard-page walkthrough reproduced an original contained fault and a successful edited child read.

The 16 shell variations and five debugger variations were replayed through the Explorer. The directory variation uses `/cat item` after changing directories, because this xv6 shell resolves the executable from the current directory when the command omits an absolute path.

The automated corpus uses the browser C compiler and actual xv6 guest execution to check 99 starters, their 99 taught edits and the 25 Explorer experiments. Hosted checks rebuild xv6 from the pinned source before running the corpus and browser suite. These checks establish functional behavior. Learner understanding, physical-board performance and assistive-technology usability were not measured.
