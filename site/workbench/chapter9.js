import {
  lesson,
  program,
  forkCheck,
  kernelFunction,
} from "./lesson-helpers.js?v=chapter7";
const getpidContext = {
  target: "sys_getpid",
  file: "kernel/sysproc.c",
  offset: 20,
  headers: ["kernel/syscall.h"],
};
const trapContext = {
  target: "usertrap",
  file: "kernel/trap.c",
  offset: 36,
  headers: ["kernel/syscall.h"],
  constants: ["SSTATUS_SPP"],
  functions: ["panic", "exit", "syscall", "yield", "usertrapret", "strncmp"],
  globals: "void kernelvec(void);\nint devintr(void);\nvoid w_stvec(uint64);",
  bridges: ["r_sstatus", "r_sepc", "r_scause", "intr_on"],
};
const dispatchContext = {
  target: "syscall",
  file: "kernel/syscall.c",
  offset: 132,
  headers: ["kernel/syscall.h"],
  globals:
    "extern uint64 (*syscalls[SYS_close + 1])(void);\n#define NELEM(x) (sizeof(x)/sizeof((x)[0]))",
};
const returnContext = {
  target: "usertrapret",
  file: "kernel/trap.c",
  offset: 89,
  headers: ["kernel/memlayout.h"],
  constants: ["SSTATUS_SPP", "SSTATUS_SPIE", "PGSIZE", "MAKE_SATP", "MAXVA"],
  functions: ["strncmp"],
  bridges: ["intr_off", "r_satp", "r_sstatus"],
  globals:
    "extern char trampoline[], uservec[], userret[];\nvoid usertrap(void);\nvoid w_stvec(uint64);\nvoid w_sstatus(uint64);\nvoid w_sepc(uint64);\nuint64 r_tp(void);",
};
const kernelLesson = (build, details) =>
  lesson({
    mode: "kernel",
    file: build.file,
    offset: build.offset,
    build,
    editorHeight: 820,
    contextTitle: "Follow the trap and syscall path",
    contextFiles: [
      "kernel/trampoline.S",
      "kernel/trap.c",
      "kernel/syscall.c",
      "kernel/proc.h",
    ],
   ...details,
  });
export const chapter9Lessons = {
  "a-trapframe-saves-user-registers": kernelLesson(getpidContext, {
    title: "A trapframe preserves user registers",
    goal: "Read saved user state without confusing it with the kernel’s live registers.",
    editorHeight: 420,
    starter: () =>
      'uint64\nsys_getpid(void)\n{\n  struct proc *p = myproc();\n  uint64 selected = p->trapframe->a7;\n  printf("selected equals syscall number=%d\\n", selected == SYS_getpid);\n  return p->pid;\n}\n',
    reading: `<p>When user code enters the kernel, the CPU does not automatically save every general register. The trampoline’s uservec assembly saves them into the process’s <strong>trapframe</strong> before using registers for kernel work.</p><p>The saved a7 contains the user’s system-call number. The kernel’s live a7 can already mean something else while C functions execute. The observation reads p->trapframe->a7 inside getpid, and compares it with SYS_getpid from the matching header. A printed 1 means the values match.</p><p>The saved epc is a user instruction address, not a syscall number. usertrap records it from sepc and advances it past ecall before calling the handler. Selecting epc instead should therefore make this comparison false; it does not change the process’s real PID.</p>`,
    excerpt: {
      file: "kernel/trampoline.S",
      anchor: "sd a7, 168(a0)",
      before: 4,
      after: 5,
    },
    sourceNote:
      "The stores put user register values at the offsets defined by struct trapframe. a0 temporarily holds the trapframe address; its original user value is recovered from sscratch and saved separately.",
    assignment:
      "Replace selected = p->trapframe->a7 with selected = p->trapframe->epc. Choose Build & run again. Read selected equals syscall number in both runs. What does the changed field tell you about the two saved registers?",
    takeaway:
      "Saved user registers and live kernel registers are different execution contexts.",
    reflection:
      "Why would reading the kernel’s current a7 be unreliable when you want the user’s syscall number?",
    expected: "selected equals syscall number=1",
  }),
  "a-trap-cause-selects-the-path": kernelLesson(trapContext, {
    title: "The trap cause selects a handling path",
    goal: "Observe a user ecall’s cause before enabling nested kernel interrupts.",
    starter: (files) =>
      kernelFunction(files, "kernel/trap.c", "usertrap").replace(
        "  if(r_scause() == 8){",
        '  if (r_scause() == 8 && p->trapframe->a7 == SYS_getpid &&\n      strncmp(p->name, "workbench", 9) == 0)\n    printf("observed syscall=%d cause=%d\\n", (int)p->trapframe->a7, (int)r_scause());\n\n  if(r_scause() == 8){',
      ),
    reading: `<p>A <strong>trap</strong> can be a synchronous exception or an interrupt. A user ecall is a deliberate synchronous request, identified by scause value 8. usertrap distinguishes that path from device interrupts and unexpected user faults.</p><p>The editable function is now the actual usertrap. Its observation runs after saving the user PC but before intr_on. That position matters: a later interrupt can overwrite trap-related CPU registers, so a handler must preserve the state it needs first.</p><p>Both getpid and write enter with cause 8. Their saved a7 values identify which operation was requested. User printf can issue many write calls, so several observations are expected.</p>`,
    excerpt: {
      file: "kernel/trap.c",
      within: "usertrap(void)",
      anchor: "if(r_scause() == 8)",
      after: 17,
    },
    sourceNote:
      "The ecall branch saves the return position before enabling interrupts and dispatching the syscall. Other causes go through devintr or the unexpected-fault path.",
    assignment:
      "In the added observation condition, replace SYS_getpid with SYS_write. Choose Build & run again. The trace should show observed syscall=16 cause=8. The new filter changes what you observe, while normal dispatch remains intact.",
    takeaway:
      "A trap cause explains why control entered the kernel; the syscall number identifies which service a user ecall requests.",
    reflection:
      "Why should trap code save sepc before allowing another interrupt to occur?",
    expected: "observed syscall=11 cause=8",
  }),
  "ecall-must-advance-the-return-pc": kernelLesson(
    {
     ...trapContext,
      probe: program(
        forkCheck +
          '  if (child == 0) {\n    getpid();\n    printf("child syscall returned\\n");\n    exit(0);\n  }\n  sleep(4);\n  kill(child);\n  int status = 0;\n  wait(&status);\n  printf("return pc child status=%d\\n", status);',
      ),
    },
    {
      title: "Returning must skip the ecall instruction",
      goal: "See why a syscall return must resume after ecall rather than repeat it.",
      starter: (files) =>
        "#define LAB_GETPID_ADVANCE 4\n" +
        kernelFunction(files, "kernel/trap.c", "usertrap").replace(
          "p->trapframe->epc += 4;",
          "p->trapframe->epc += p->trapframe->a7 == SYS_getpid ? LAB_GETPID_ADVANCE : 4;",
        ),
      reading: `<p>For a user ecall, sepc points at the ecall instruction itself. Returning to that same address would execute it again. usertrap therefore adds four to the saved PC: ecall is a four-byte instruction, even on a system that also supports compressed instructions.</p><p>The lab setting changes this advance only for getpid. All other system calls keep their normal four-byte advance, so boot, I/O and cancellation still work. The supplied program forks a child that calls getpid. The parent later cancels a child that has not finished and collects its status.</p><p>With advance 4, the call returns and the child exits with status 0. With advance 0, the child repeats the same ecall and never reaches its message. Timer scheduling lets the parent run and kill it; the collected status becomes -1. This bounds the experiment without requiring an endless browser run.</p>`,
      excerpt: {
        file: "kernel/trap.c",
        within: "usertrap(void)",
        anchor: "p->trapframe->epc += 4;",
        before: 2,
        after: 5,
      },
      sourceNote:
        "The saved PC is the instruction address later restored for return to user mode. Changing this value changes actual execution flow, not just a printed result.",
      assignment:
        "Change LAB_GETPID_ADVANCE from 4 to 0. Choose Build & run again. The child should not print child syscall returned, and the parent should report return pc child status=-1 after cancelling it.",
      takeaway:
        "The return PC is part of syscall correctness: resuming at the trapping instruction repeats the request.",
      reflection:
        "Why must this experiment preserve normal PC advancement for the parent’s kill and wait calls?",
      expected: "return pc child status=0",
    },
  ),
  "dispatch-chooses-a-kernel-handler": kernelLesson(
    {
     ...dispatchContext,
      probe: program(
        '  int first = getpid();\n  sleep(2);\n  int second = getpid();\n  printf("same result=%d changed=%d\\n", first == second, second > first);',
      ),
    },
    {
      title: "Dispatch selects a kernel function",
      goal: "Follow the syscall number through the real function-pointer table.",
      editorHeight: 550,
      starter: (files) =>
        kernelFunction(files, "kernel/syscall.c", "syscall").replace(
          "syscalls[num]();",
          "syscalls[num == SYS_getpid ? SYS_getpid : num]();",
        ),
      reading: `<p>The user stub puts a small number in a7; it does not pass a kernel function address. syscall checks that number’s bounds, checks for a populated table entry, then calls the selected kernel handler. This gives the kernel control over which services are callable.</p><p>The table holds function pointers, indexed by the SYS_ constants. The editable function is the actual dispatcher. Its initial selection preserves the normal getpid entry. The supplied user program calls getpid twice with a sleep between them; both results should be the same PID.</p><p>The variation routes getpid requests to sys_uptime. The user stub still sends the same number, but the changed kernel dispatcher runs a different handler. The returned tick counts increase across the sleep. This demonstrates dispatch rather than a change to the stored PID.</p>`,
      excerpt: {
        file: "kernel/syscall.c",
        within: "syscall(void)",
        anchor: "num = p->trapframe->a7;",
        after: 9,
      },
      sourceNote:
        "Bounds and null-entry checks precede the indirect call. The return value is stored in saved a0 for the eventual return to the user caller.",
      assignment:
        "In the conditional table index, change the first result SYS_getpid to SYS_uptime, keeping the condition and fallback as they are. Choose Build & run again. Find same result=0 changed=1. How did changing the selected handler affect the value returned to the same caller?",
      takeaway:
        "The syscall interface is a checked dispatch table, not permission for user code to jump to arbitrary kernel addresses.",
      reflection:
        "Why must the dispatcher validate the index before reading and calling a table entry?",
      expected: "same result=1 changed=0",
    },
  ),
  "arguments-come-from-saved-registers": kernelLesson(
    {
      target: "argint",
      file: "kernel/syscall.c",
      offset: 57,
      headers: ["kernel/syscall.h"],
      globals: "uint64 argraw(int);",
      probe: program(
        '  int before = uptime();\n  sleep(2);\n  printf("elapsed ticks=%d\\n", uptime() - before);',
      ),
    },
    {
      title: "Argument helpers decode saved registers",
      goal: "Change a decoded integer argument while leaving the user request unchanged.",
      editorHeight: 510,
      starter: (files) =>
        kernelFunction(files, "kernel/syscall.c", "argint").replace(
          "  *ip = argraw(n);",
          '  *ip = argraw(n);\n  if (n == 0 && myproc()->trapframe->a7 == SYS_sleep) {\n    int extra = 0;\n    *ip += extra;\n    printf("decoded sleep ticks=%d\\n", *ip);\n  }',
        ),
      reading: `<p>The syscall’s C handler has no ordinary C parameters for the user’s arguments. Helpers retrieve them from the saved user argument registers. argraw selects a0 through a5; argint converts the selected value to an int and writes it through a kernel pointer.</p><p>argint’s returned 0 is its own success result. The decoded argument is the separate value written through ip. sys_sleep uses that output as its requested tick count.</p><p>The supplied user program always requests sleep(2). The added code adjusts only argument 0 of that syscall. The probe prints both the decoded request and the elapsed count. The elapsed guest ticks should be at least five; scheduling can make them larger, so do not expect an exact duration.</p>`,
      excerpt: {
        file: "kernel/syscall.c",
        within: "argraw(int n)",
        anchor: "switch (n)",
        after: 13,
      },
      sourceNote:
        "argraw reads the process’s trapframe rather than the kernel’s live argument registers. argaddr uses the same raw values as addresses; checked-copy routines validate accesses later.",
      assignment:
        "Change extra from 0 to 3. Choose Build & run again. Expect decoded sleep ticks=5 and an elapsed count of at least 5, even though the supplied user program still calls sleep(2).",
      takeaway:
        "Decoding arguments is an explicit kernel step; a helper’s return value and its output argument have different meanings.",
      reflection:
        "Why is copying an address value out of a saved register different from validating the memory it refers to?",
      expected: "decoded sleep ticks=2",
    },
  ),
  "returning-to-user-mode": kernelLesson(returnContext, {
    title: "Returning to user mode restores a protected context",
    goal: "Connect the return-mode bits to actual execution, and distinguish a kernel panic from a contained user fault.",
    editorHeight: 850,
    teachesKernelPanic: "panic: usertrap: not from user mode",
    starter: (files) =>
      kernelFunction(files, "kernel/trap.c", "usertrapret").replace(
        "  w_sstatus(x);",
        '  int lab_mode = 0;\n  if (strncmp(p->name, "workbench", 9) == 0) {\n    x |= lab_mode;\n    static int shown;\n    if (!shown) {\n      printf("prepared user mode=%d\\n", (x & SSTATUS_SPP) == 0);\n      shown = 1;\n    }\n  }\n  w_sstatus(x);',
      ),
    reading: `<p>usertrapret prepares another boundary crossing. It disables interrupts during setup, selects the trampoline entry for the next user trap, records kernel state in the trapframe, sets the saved return PC, and jumps to the trampoline’s userret code.</p><p>The SPP bit chooses the privilege used by sret: clearing it requests user mode. The code also prepares SPIE, the saved interrupt-enable bit. The trampoline switches page tables, restores user registers and executes sret. This is more than an ordinary C return.</p><p>The lab setting applies only when returning to workbench. The starter selects user mode. Setting SPP instead requests supervisor execution at user code. The user-page execution restriction causes a trap, and usertrap rejects that unexpected supervisor origin with a kernel panic.</p><p>A kernel panic affects the whole machine. The lab stops that virtual machine after showing its complete panic line, while keeping your source and build.</p>`,
    excerpt: {
      file: "kernel/trap.c",
      within: "usertrapret(void)",
      anchor: "unsigned long x = r_sstatus();",
      after: 9,
    },
    sourceNote:
      "The mode bits, saved PC, page table and restored registers must agree. A bad kernel return path can stop the whole OS, unlike the child-only user faults in the earlier chapter.",
    assignment:
      "Change lab_mode from 0 to SSTATUS_SPP. Choose Build & run again. Find prepared user mode=0 and panic: usertrap: not from user mode. The edited kernel stops here. Choose Restore starter and then Build & run to see the user program and shell complete again.",
    takeaway:
      "A trap return explicitly restores privilege and execution state; a kernel mistake at this boundary can affect every process.",
    reflection:
      "Why can the kernel contain a user fault but fail to recover from a broken kernel return path?",
    expected: "prepared user mode=1",
  }),
};
