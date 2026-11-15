# One investigation, one workspace

The learner’s feedback was that the lab required too much jumping between reading, console, debugger and source. This revision changes the interaction model rather than adding more shortcuts between those areas.

Each lesson presents one task: Predict, Run & inspect, Explain, Try a change, Check. All existing explanations, variations, quizzes and source remain available. The persistent step bar advances the investigation; step markers also allow deliberate revisits. Predictions and answers stay in place while tasks change.

Run experiment boots/queues the real command. At a breakpoint the task explains the actual stop and includes a focused live snapshot. Continue execution resumes the guest; when the shell returns, the same control becomes Explain this result. Process lessons read actual process/trapframe records automatically. The page-table lesson automatically walks lab’s VA 0. Full debugger and source controls are optional rather than prerequisites for the basic path.

The worker and console node are never replaced by a task change. A fixed-height, scrollable task region keeps the machine in the same position on phones; on tablets and desktops it stays beside the task. The primary controls remain at the bottom of the viewport. This trades some document-style reading for bounded task scrolling, while retaining readable type and keyboard scrolling. Long source and complete register lists remain disclosures.

Step state is encoded in the URL and remembered for return visits within the page. Existing prediction/completion storage is preserved. Output is captured per experiment for this tab session, without implying persistence of the guest disk. A successful command does not mark a lesson complete.

Regression coverage drives all 25 experiments through the step bar, verifies only one task is active, checks that changing tasks preserves console output and worker identity, and reads inline snapshots. Browser checks at 1680, 1024, 390 and 320 pixels assert the machine’s position is unchanged across tasks and exercise the whole sequence. They also run the real automatic page-table inspection with advanced tools closed. Worker checks cover automatic requests that arrive after resume; a separate flow check covers cancelling a queued command by changing lessons during boot.

The earlier design/UX reviews describe the previous layout. This revision supersedes their Lesson/Live machine switching recommendation.
