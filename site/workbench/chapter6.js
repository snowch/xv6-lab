import { program, lesson, forkCheck } from "./lesson-helpers.js?v=chapter3";
import { pipeCheck } from "./chapter5.js?v=chapter5";
const schedulingLesson = (details) => lesson({ editorHeight: 680, ...details });
export const chapter6Lessons = {
  "sleep-counts-guest-ticks": schedulingLesson({
    title: "Sleep waits for guest timer ticks",
    goal: "Observe a timed sleep without treating it as a browser performance measurement.",
    starter: () =>
      program(
        '  int requested = 3;\n  int before = uptime();\n  int result = sleep(requested);\n  int elapsed = uptime() - before;\n  printf("requested=%d at_least=%d sleep_result=%d\\n", requested, elapsed >= requested, result);',
      ),
    reading: `<p>xv6’s <button class="code-link" data-focus="sleep">sleep(n)</button> waits for guest timer ticks. While the process sleeps, the CPU can run another process. <code>uptime()</code> reads the kernel’s count of those ticks.</p><p>The example records a starting count, requests three ticks, then checks that at least that many elapsed. More ticks may pass before the process runs again. There is no promise of an exact browser duration.</p><p>In the kernel, the sleep syscall remembers <code>ticks0</code> and repeatedly checks the condition. Kernel <code>sleep</code> blocks on the ticks channel between checks; timer handling advances the count and wakes sleepers.</p>`,
    excerpt: {
      file: "kernel/sysproc.c",
      within: "sys_sleep(void)",
      anchor: "while(ticks - ticks0 < n)",
      after: 7,
    },
    sourceNote:
      "The loop rechecks elapsed ticks after each wakeup. Kernel sleep takes a channel and lock; the user sleep syscall wraps that mechanism with a timer condition.",
    assignment:
      "Change requested from 3 to 5. Choose Build & run again. Requested should become 5, while at_least remains 1 and sleep_result remains 0.",
    takeaway:
      "Timed sleep blocks on a kernel condition; resuming can happen later than the requested minimum.",
    reflection:
      "Why does an elapsed-tick check use greater-than-or-equal rather than exact equality?",
    contextTitle: "Read timer sleep and interrupts",
    contextFiles: ["kernel/sysproc.c", "kernel/proc.c", "kernel/trap.c"],
    expected: "requested=3 at_least=1 sleep_result=0",
  }),
  "runnable-processes-take-turns": schedulingLesson({
    title: "Runnable processes take turns",
    goal: "Observe progress by two child processes without assuming an exact output order.",
    editorHeight: 760,
    starter: () =>
      program(
        "  enum { N = 3 };\n  for (int worker = 0; worker < 2; worker++) {\n    int child = fork();\n    if (child < 0) exit(1);\n    if (child == 0) {\n      char label = 'A' + worker;\n      for (int step = 0; step < N; step++) {\n        write(1, &label, 1);\n        sleep(1);\n      }\n      exit(0);\n    }\n  }\n  int collected = 0;\n  for (int i = 0; i < 2; i++)\n    if (wait(0) > 0) collected++;\n  printf(\"\\nworkers collected=%d\\n\", collected);",
      ),
    reading: `<p>A <strong>runnable</strong> process is eligible to use the CPU. A <strong>running</strong> process is the one currently using it. xv6’s scheduler searches its process table for runnable work, switches to a saved kernel context, and regains control when the process blocks or yields.</p><p>Two children each write a single-byte label three times, sleeping between writes. Their progress shares one emulated CPU. The output can contain different arrangements of A and B; the interface promises neither an exact alternation nor a fixed scheduling delay.</p><p>The parent collects both children. Each child’s ordinary variables are private, while the scheduler manages their separate saved contexts and states.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "scheduler(void)",
      anchor: "if(p->state == RUNNABLE)",
      after: 6,
    },
    sourceNote:
      "The scheduler changes a selected process to RUNNING, records it in c->proc and switches contexts. Blocking or yielding changes its state before switching back.",
    assignment:
      "Change N from 3 to 5. Choose Build & run again. Each label should appear five times, with both children collected, regardless of their interleaving.",
    takeaway:
      "Scheduling chooses among runnable processes; a particular output interleaving is not the API contract.",
    reflection:
      "Why would a sleeping process be skipped even though its program has not finished?",
    contextTitle: "Read scheduling and context switching",
    contextFiles: ["kernel/proc.c", "kernel/swtch.S", "kernel/trap.c"],
    expected: "workers collected=2",
  }),
  "waiting-is-a-process-state": schedulingLesson({
    title: "Waiting is a process state",
    goal: "Inspect the parent sleeping in wait while its child runs.",
    observePid: true,
    observeProcesses: true,
    starter: () =>
      program(
        forkCheck +
          '  if (child == 0) {\n    sleep(3);\n    printf("reported pid=%d\\n", getpid());\n    exit(0);\n  }\n  int status = -1;\n  wait(&status);\n  printf("parent collected child; status=%d\\n", status);',
      ),
    reading: `<p>When a parent waits for a running child, xv6 does not keep executing a user loop in that parent. It marks the process <strong>SLEEPING</strong> and switches away, so another runnable process can use the CPU.</p><p>The child sleeps briefly to let the parent reach wait, then calls getpid. At that call the workbench captures actual kernel process records and resumes execution. The table is a <em>snapshot</em>, retained after the program finishes.</p><p>Use the reported child PID to find its running row. The parent column identifies its parent; that workbench row should be sleeping. The parent later resumes when the child exits and wait can collect its result.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "sleep(void *chan",
      anchor: "p->chan = chan;",
      after: 3,
    },
    sourceNote:
      "The kernel records what the process is waiting on, changes its state to SLEEPING, and calls sched. The saved state lets the scheduler run another process while this one waits.",
    starterEvidence: "Find child pid= in the xv6 console. Match it to the running row in Kernel process snapshot, then use that row’s Parent column to find the sleeping process.",
    assignment:
      "In the child branch, change exit(0) to exit(7). Choose Build & run again. Find the running child and its sleeping parent in Kernel process snapshot. Compare parent collected child; status= in the console. Which evidence identifies the parent’s state, and which reports the child’s result?",
    takeaway:
      "A blocked process retains its memory and saved execution state while another process runs.",
    reflection:
      "Why is the sleeping row not evidence that the parent has exited?",
    contextTitle: "Read sleep, wait and process states",
    contextFiles: ["kernel/proc.c", "kernel/proc.h"],
    expected: "parent collected child; status=0",
  }),
  "wakeup-makes-a-process-runnable": schedulingLesson({
    title: "Wakeup makes a process runnable",
    goal: "Connect a pipe condition change with the scheduler’s runnable state.",
    editorHeight: 720,
    starter: () =>
      program(
        pipeCheck +
          forkCheck +
          '  if (child == 0) {\n    close(p[1]);\n    char ch = 0;\n    read(p[0], &ch, 1);\n    printf("woken reader=%c\\n", ch);\n    close(p[0]);\n    exit(0);\n  }\n  close(p[0]);\n  sleep(3);\n  write(p[1], "K", 1);\n  close(p[1]);\n  wait(0);',
      ),
    reading: `<p>A sleeping process has a <strong>channel</strong> identifying the condition it is waiting for. In the pipe example, readers wait on an address associated with the read counter.</p><p>After a producer changes the pipe, it calls wakeup on that channel. The kernel marks matching sleeping processes <strong>RUNNABLE</strong>. This makes them eligible for scheduling; it does not immediately transfer the CPU to every awakened process.</p><p>The reader checks its pipe condition again when it runs. A condition loop remains necessary because a wakeup signals possible progress, and another reader could consume data first.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "wakeup(void *chan)",
      anchor: "if(p->state == SLEEPING && p->chan == chan)",
      after: 2,
    },
    sourceNote:
      "wakeup matches both the sleeping state and the channel before assigning RUNNABLE. The scheduler, rather than wakeup itself, later changes the chosen process to RUNNING.",
    assignment:
      "Change K to Z in the producer’s write. Choose Build & run again. The awakened reader should obtain Z through the same wait/wakeup path.",
    takeaway:
      "Wakeup changes eligibility; the waiting operation must still recheck its condition.",
    reflection:
      "Why should waking a pipe reader not also wake every unrelated sleeping process?",
    contextTitle: "Follow channels from pipes to the scheduler",
    contextFiles: ["kernel/pipe.c", "kernel/proc.c"],
    expected: "woken reader=K",
  }),
  "killing-a-sleeping-process": schedulingLesson({
    title: "A killed sleeper must run to exit",
    goal: "Follow cancellation from the killed flag through runnable state to exit.",
    starter: () =>
      program(
        forkCheck +
          '  if (child == 0) {\n    sleep(8);\n    printf("child completed sleep\\n");\n    exit(0);\n  }\n  sleep(1);\n  int result = kill(child);\n  int status = 0;\n  wait(&status);\n  printf("kill result=%d child status=%d\\n", result, status);',
      ),
    reading: `<p>xv6’s <button class="code-link" data-focus="kill(child)">kill</button> marks the selected process as killed. If it is sleeping, the kernel makes it runnable so it can notice the flag and finish the exit path.</p><p>The example gives the child a longer sleep and has the parent request cancellation after one tick. The child should not reach its completion message. The parent collects its exit status <code>-1</code>.</p><p>This mechanism is a flag and kernel checks, not immediate deletion of a process record by the caller. If no process has the requested PID, kill returns <code>-1</code> and changes no target.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "kill(int pid)",
      anchor: "p->killed = 1;",
      after: 5,
    },
    sourceNote:
      "kill wakes a sleeping target by assigning RUNNABLE. Trap handling checks killed before returning to user execution, and exit then leaves a record for the parent’s wait.",
    assignment:
      "Replace kill(child) with kill(99999), a PID absent from this fresh machine. Choose Build & run again. Kill should return -1, the child should complete its sleep, and its collected status should be 0.",
    takeaway:
      "Cancellation must interact with sleeping, scheduling and the ordinary exit/wait lifecycle.",
    reflection:
      "Why would merely setting killed without waking a sleeper risk leaving it blocked?",
    contextTitle: "Read kill and trap exit checks",
    contextFiles: ["kernel/proc.c", "kernel/trap.c", "kernel/sysproc.c"],
    expected: "kill result=0 child status=-1",
  }),
  "locks-protect-shared-kernel-state": schedulingLesson({
    title: "Locks protect shared kernel state",
    goal: "Connect correct pipe byte accounting with a protected kernel critical section.",
    editorHeight: 820,
    starter: () =>
      program(
        pipeCheck +
          "  enum { N = 20 };\n  for (int worker = 0; worker < 2; worker++) {\n    int child = fork();\n    if (child < 0) exit(1);\n    if (child == 0) {\n      close(p[0]);\n      char label = 'A' + worker;\n      for (int i = 0; i < N; i++)\n        if (write(p[1], &label, 1) != 1) exit(1);\n      close(p[1]);\n      exit(0);\n    }\n  }\n  close(p[1]);\n  char buf[32];\n  int total = 0, a = 0, b = 0, n;\n  while ((n = read(p[0], buf, sizeof(buf))) > 0) {\n    for (int i = 0; i < n; i++) {\n      if (buf[i] == 'A') a++;\n      if (buf[i] == 'B') b++;\n    }\n    total += n;\n  }\n  close(p[0]);\n  int collected = 0;\n  while (wait(0) > 0) collected++;\n  printf(\"bytes=%d A=%d B=%d collected=%d\\n\", total, a, b, collected);",
      ),
    reading: `<p>The children have separate user variables, but their inherited descriptors refer to one shared kernel pipe. Both writers update the pipe’s buffer and write counter; the reader updates its read counter.</p><p>A <strong>lock</strong> protects a <strong>critical section</strong>: operations on shared state that must be coordinated. pipewrite acquires the pipe lock before its loop, updates the buffer and counter while holding it, and releases it afterwards. A full-buffer wait releases the lock while sleeping so a reader can make space.</p><p>The example uses two writers and a reader, closes unused ends, reads until EOF and collects both children. Count the actual bytes rather than assuming a particular writer order. This connects process lifetime, descriptors, streams and scheduling with the shared kernel data behind them.</p>`,
    excerpt: {
      file: "kernel/pipe.c",
      within: "pipewrite(struct pipe *pi",
      anchor: "pi->data[pi->nwrite++ % PIPESIZE] = ch;",
      before: 3,
      after: 7,
    },
    sourceNote:
      "This update occurs inside the pipe’s locked region; release is shown below it. spinlock.c implements acquisition with an atomic operation and disables local interrupts while held. The example checks functional outcomes under these rules, not hardware contention speed.",
    assignment:
      "Change N from 20 to 30. Choose Build & run again. The reader should count 60 bytes: 30 A bytes and 30 B bytes, with both children collected.",
    takeaway:
      "Process-private user memory can still access shared kernel objects, whose invariants need synchronization.",
    reflection:
      "How do the process table, pipe references, EOF condition and lock each contribute to this program finishing correctly?",
    contextTitle: "Read shared state and lock implementation",
    contextFiles: ["kernel/pipe.c", "kernel/spinlock.c", "kernel/proc.c"],
    expected: "bytes=40 A=20 B=20 collected=2",
  }),
};
