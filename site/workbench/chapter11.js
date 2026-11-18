import {
  lesson,
  program,
  kernelFunction,
} from "./lesson-helpers.js?v=chapter7";
const hook = (body) =>
  "uint64\nsys_getpid(void)\n{\n" + body + "\n  return myproc()->pid;\n}\n";
const base = { target: "sys_getpid", file: "kernel/sysproc.c", offset: 20 };
const k = (build, details) =>
  lesson({
    mode: "kernel",
    file: build.file,
    offset: build.offset,
    build,
    editorHeight: 550,
    contextTitle: "Follow the kernel thread",
    contextFiles: [
      "kernel/proc.c",
      "kernel/proc.h",
      "kernel/swtch.S",
      "kernel/kernelvec.S",
      "kernel/trap.c",
    ],
   ...details,
  });
const trap = {
  target: ["usertrap", "sys_getpid"],
  file: "kernel/trap.c",
  offset: 36,
  headers: ["kernel/syscall.h"],
  constants: ["SSTATUS_SPP"],
  functions: ["panic", "exit", "syscall", "yield", "usertrapret", "strncmp"],
  bridges: ["r_sstatus", "r_sepc", "r_scause", "r_stval", "intr_on"],
  globals: "void kernelvec(void);\nint devintr(void);\nvoid w_stvec(uint64);",
  probe: program(
    '  getpid();\n  for (volatile int spin = 0; spin < 300000; spin++) ;\n  int n = getpid();\n  printf("user timer preemptions observed=%d\\n", n > 0);',
  ),
};
export const chapter11Lessons = {
  "kernel-contexts-save-a-call-boundary": k(base, {
    title: "A kernel context saves a call boundary",
    goal: "Distinguish the small swtch context from a saved user trapframe.",
    starter: () =>
      hook(
        '  printf("saved words=%d\\n", (int)(sizeof(struct context) / sizeof(uint64)));',
      ),
    reading:
      "<p>Each process can be suspended while running kernel C code. Its <strong>kernel context</strong> records enough state to resume the call to swtch: the return address, stack pointer and twelve callee-saved registers. These are the registers an ordinary RISC-V function must preserve for its caller.</p><p>Caller-saved registers need no separate entries here. The compiler already saves any live caller-saved values around a function call, often on the kernel stack. swtch returns through that ordinary call boundary. The saved ra supplies the continuation; there is no separate pc field.</p><p>A user trap has no such C calling convention boundary. The trampoline therefore saves a much larger trapframe, including user argument and temporary registers. The trapframe’s 36 words include five fields used to enter the kernel.</p>",
    excerpt: { file: "kernel/swtch.S", anchor: "sd ra, 0(a0)", after: 15 },
    sourceNote:
      "swtch stores through old in a0 and restores through new in a1. Its final ret uses the newly restored ra, returning into the other kernel thread.",
    assignment:
      "Change sizeof(struct context) to sizeof(struct trapframe). Choose Build & run again. Compare saved words (14 and 36). Why does the register record saved for a trap need more fields than the record at a C call boundary?",
    expected: "saved words=14",
    takeaway:
      "A kernel switch resumes a C call; a trap return restores a user execution context.",
    reflection:
      "Why can swtch omit a0–a7 even though the trampoline must save them?",
  }),
  "a-saved-stack-belongs-to-the-kernel": k(
    {...base, constants: ["PGSIZE"], functions: ["yield"] },
    {
      title: "A suspended kernel thread has its own stack",
      goal: "Locate the real saved kernel stack pointer after a scheduling round.",
      starter: () =>
        hook(
          '  struct proc *p = myproc();\n  yield();\n  uint64 saved = p->context.sp;\n  printf("saved pointer inside kernel stack=%d\\n", saved >= p->kstack && saved < p->kstack + PGSIZE);',
        ),
      reading:
        "<p>A process has a user stack and a separate kernel stack. Traps switch to the kernel stack before entering kernel C. A process blocked inside read or wait retains its kernel call frames while another process runs.</p><p>The probe calls the actual yield routine. Its path through sched and swtch saves p->context.sp. When this process is scheduled again, those kernel frames resume and the probe checks the saved address against its own kernel-stack page.</p><p> Selecting the trapframe’s sp instead reads the saved <em>user</em> stack pointer, which is outside this kernel-stack mapping. Neither saved field is a claim to read the CPU’s current live sp at this line.</p>",
      excerpt: {
        file: "kernel/proc.c",
        within: "sched(void)",
        anchor: "swtch(&p->context",
        before: 1,
        after: 2,
      },
      sourceNote:
        "The process and CPU scheduler have different context records. The kernel stack contains the suspended function calls; switching sp makes that call chain available again.",
      assignment:
        "Replace saved = p->context.sp with saved = p->trapframe->sp. Choose Build & run again. Compare saved pointer inside kernel stack. Why do the two saved stack pointers give different results for that range?",
      expected: "saved pointer inside kernel stack=1",
      takeaway:
        "Switching a kernel context restores a stack of unfinished kernel calls.",
      reflection:
        "Where does a blocked read keep its local variables while another process runs?",
    },
  ),
  "yield-hands-a-process-to-the-scheduler": k(
    {
      target: ["yield", "sys_getpid"],
      file: "kernel/proc.c",
      offset: 518,
      functions: ["acquire", "sched", "release", "strncmp"],
      probe: program('  getpid();\n  printf("process resumed\\n");'),
    },
    {
      title: "Yield changes state before switching away",
      goal: "Observe the runnable-to-running transition around a real context switch.",
      editorHeight: 620,
      starter: (files) =>
        kernelFunction(files, "kernel/proc.c", "yield").replace(
          "  sched();",
          '  if (strncmp(p->name, "workbench", 9) == 0)\n    printf("runnable at observation=%d\\n", p->state == RUNNABLE);\n  sched();',
        ) + hook("  yield();"),
      reading:
        "<p>yield does not choose the next process. It acquires the current process’s lock, marks that process RUNNABLE, and calls sched to switch to the CPU scheduler’s context. The scheduler searches for a runnable process, marks the chosen one RUNNING, and switches into its saved context.</p><p>The editable yield is the actual routine. A supplied getpid lab hook calls yield explicitly, so the observation does not depend on timer timing. The observation is restricted to workbench and runs just before sched, when its state is RUNNABLE.</p><p>The call to sched returns only once this process has been scheduled again. At that point the scheduler has marked it RUNNING, so the same test reports 0. Scheduling is not a direct jump from one user program into another: it passes through the per-CPU scheduler.</p>",
      excerpt: {
        file: "kernel/proc.c",
        within: "scheduler(void)",
        anchor: "p->state = RUNNING;",
        after: 8,
      },
      sourceNote:
        "p->lock remains held across swtch. The resumed process releases it in yield or, on its very first run, forkret. This protects state and stack ownership during the handoff.",
      assignment:
        "Move the two-line if/printf observation from before sched() to immediately after it. Choose Build & run again. Runnable at observation should become 0.",
      expected: "runnable at observation=1",
      takeaway:
        "The process publishes its state before switching, and the scheduler changes it before resuming that context.",
      reflection:
        "Why would setting RUNNABLE only after sched returns be too late?",
    },
  ),
  "sched-enforces-switching-invariants": k(
    {...base, functions: ["yield", "sched"] },
    {
      title: "Sched checks the handoff contract",
      goal: "Trigger a real guard against switching without the process lock.",
      teachesKernelPanic: "panic: sched p->lock",
      starter: () =>
        hook('  yield();\n  printf("safe scheduling round returned\\n");'),
      reading:
        "<p>Kernel context switching needs a strict contract. sched requires the current process’s lock, exactly one push_off nesting level, a state other than RUNNING, and interrupts disabled. The source below checks all four before switching stacks.</p><p>yield establishes that contract for a runnable process. sleep and exit establish their own state transitions before calling sched. These checks prevent a scheduler from observing an inconsistent state or letting two execution paths use the same kernel stack.</p><p>A direct call from this syscall handler does not hold the process lock. That violates the first check and stops the kernel.</p>",
      excerpt: {
        file: "kernel/proc.c",
        within: "sched(void)",
        anchor: "if(!holding(&p->lock))",
        after: 8,
      },
      sourceNote:
        "Passing one check is insufficient. Disabling interrupts alone, for example, does not acquire p->lock or change the process state.",
      assignment:
        "Replace yield() with sched(). Choose Build & run again and find panic: sched p->lock. What condition did yield set up before calling sched? Choose Restore starter and then Build & run to confirm safe scheduling round returned.",
      expected: "safe scheduling round returned",
      takeaway:
        "A context switch is safe only when state, lock ownership and interrupt state satisfy the scheduler’s contract.",
      reflection: "Why is intr_off alone insufficient preparation for sched?",
    },
  ),
  "timer-preemption-enters-the-scheduler": k(trap, {
    title: "The timer can preempt user computation",
    goal: "Connect a real user timer interrupt to yield without a cooperative syscall.",
    editorHeight: 980,
    starter: (files) =>
      "static int watching;\nstatic int preemptions;\n#define PREEMPT 1\n" +
      kernelFunction(files, "kernel/trap.c", "usertrap").replace(
        "  if(which_dev == 2)\n    yield();",
        '  if (which_dev == 2 && (PREEMPT || strncmp(p->name, "workbench", 9) != 0)) {\n    if (watching && strncmp(p->name, "workbench", 9) == 0) preemptions++;\n    yield();\n  }',
      ) +
      "\nuint64 sys_getpid(void)\n{\n  if (watching) { watching = 0; return preemptions; }\n  preemptions = 0;\n  watching = 1;\n  return 0;\n}\n",
    reading:
      "<p>A CPU-bound user program need not volunteer to yield. A timer interrupt traps into the kernel, devintr identifies it as a timer event, and usertrap calls yield. The kernel can therefore regain scheduling control during a long computation.</p><p>This compiled unit replaces the actual usertrap and supplies a temporary getpid lab hook. The first hook call arms a counter; the supplied program then executes a bounded busy loop in user space. The second hook call returns the number of observed timer-driven yields. It intentionally changes getpid’s meaning in this isolated experiment.</p><p>The probe prints 1 if it observed one or more such yields. Timer ticks still advance, and kerneltrap has its own preemption path; this edit does not disable all interrupts or all kernel preemption. The count is functional evidence, not a timing benchmark.</p><p>Interrupts during kernel execution enter kernelvec, which saves kernel registers on the current kernel stack. kerneltrap saves sepc and sstatus, handles the device, and may yield on a timer while a process is RUNNING. It restores those saved trap registers before kernelvec returns. This kernel-interrupt path does not restore the user trapframe.</p>",
    excerpt: {
      file: "kernel/trap.c",
      within: "usertrap(void)",
      anchor: "if(which_dev == 2)",
      before: 1,
      after: 4,
    },
    sourceNote:
      "The trapframe retains user state while yield switches the kernel context. usertrap later resumes, finishes its checks, and returns through usertrapret.",
    assignment:
      "Change PREEMPT from 1 to 0. Choose Build & run again. User timer preemptions observed should change from 1 to 0 for the same bounded user computation.",
    expected: "user timer preemptions observed=1",
    takeaway:
      "A timer trap and a kernel context switch preserve different parts of the preempted process.",
    reflection:
      "Why are both the trapframe and the kernel context needed during this path?",
  }),
  "sleep-transfers-lock-protection": k(
    {
      target: "sleep",
      file: "kernel/proc.c",
      offset: 557,
      functions: ["acquire", "release", "sched", "holding", "strncmp"],
      globals: "extern struct spinlock tickslock;",
      probe: program('  sleep(1);\n  printf("sleep returned\\n");'),
    },
    {
      title: "Sleep transfers protection before releasing a condition lock",
      goal: "Observe the overlap that prevents a lost wakeup.",
      editorHeight: 820,
      starter: (files) =>
        kernelFunction(files, "kernel/proc.c", "sleep").replace(
          "    release(lk);",
          '    if (lk == &tickslock && strncmp(p->name, "workbench", 9) == 0)\n      printf("handoff condition lock=%d\\n", holding(lk));\n    release(lk);',
        ),
      reading:
        "<p>A timed sleeper checks ticks while holding tickslock. To block, sleep must release that condition lock so the timer can update ticks. Simply releasing it and then announcing sleep would leave a gap: a wakeup could occur before the process becomes visible as sleeping.</p><p>For a different condition lock, sleep first acquires p-&gt;lock and only then releases the caller’s lock. wakeup must acquire that same process lock before examining its state. The overlap closes the gap between the condition check and publication of the sleeping state.</p><p>The editable sleep observes the condition lock just before releasing it; the process lock is already held.  The observation reports whether the condition lock is held at its location. After rescheduling, sleep clears the channel, releases p-&gt;lock and reacquires the original condition lock before returning to the caller’s condition loop.</p>",
      excerpt: {
        file: "kernel/proc.c",
        within: "sleep(void *chan",
        anchor: "if(lk != &p->lock)",
        after: 10,
      },
      sourceNote:
        "The special case lk == &p->lock already holds the needed process lock. For other locks, the acquire-before-release order supplies the atomic handoff relative to wakeup.",
      assignment:
        "Move the two-line if/printf block to immediately after release(lk). Choose Build & run again. Handoff condition lock should change from 1 to 0 while sleep still returns normally.",
      expected: "handoff condition lock=1",
      takeaway:
        "Blocking requires a lock handoff, not an unprotected gap between testing a condition and sleeping.",
      reflection:
        "Which lock prevents wakeup from examining this process during the handoff?",
    },
  ),
};
