import { lesson, kernelFunction } from "./lesson-helpers.js?v=chapter7";

const bootContext = {
  target: "main",
  file: "kernel/main.c",
  offset: 10,
  constants: ["PGSIZE"],
  functions: [
    "cpuid",
    "consoleinit",
    "printfinit",
    "kinit",
    "kvminit",
    "kvminithart",
    "procinit",
    "trapinit",
    "trapinithart",
    "plicinit",
    "plicinithart",
    "binit",
    "iinit",
    "fileinit",
    "virtio_disk_init",
    "userinit",
    "scheduler",
    "kalloc",
    "kfree",
    "panic",
  ],
  globals:
    "extern volatile int started;\nextern char stack0[];\nextern struct proc proc[];",
  bridges: ["__sync_synchronize", "r_satp"],
};
const bootLesson = (details) =>
  lesson({
    mode: "kernel",
    file: "kernel/main.c",
    offset: 10,
    editorHeight: 820,
    build: bootContext,
    contextTitle: "Follow the boot path",
    contextFiles: [
      "kernel/entry.S",
      "kernel/start.c",
      "kernel/main.c",
      "kernel/proc.c",
    ],
    ...details,
  });
const after = (files, anchor, code) => {
  const lines = kernelFunction(files, "kernel/main.c", "main")
    .trimEnd()
    .split("\n");
  const at = lines.findIndex((line) => line.includes(anchor));
  if (at < 0) throw new Error("Missing boot stage: " + anchor);
  lines.splice(at + 1, 0, ...code.split("\n").map((line) => "    " + line));
  return lines.join("\n") + "\n";
};
export const chapter7Lessons = {
  "editing-the-kernel-boot": bootLesson({
    title: "The kernel boots before user programs",
    goal: "Change the real kernel boot function and distinguish boot output from program output.",
    starter: (files) => kernelFunction(files, "kernel/main.c", "main"),
    reading: `<p>The first six chapters followed operating-system behaviour from user programs. We now revisit it inside the kernel. Start with <strong>boot</strong>: preparing the machine and kernel data before any user program runs.</p><p>The RISC-V kernel image names <code>_entry</code> as its entry point. Assembly in entry.S prepares a stack and calls start. That C function arranges supervisor-mode execution and transfers control to <code>main</code>. This kernel main is different from the main in a user program.</p><p>The editor contains the actual main from this build. Its calls form an ordered initialization sequence: console, memory, processes, traps, devices, filesystem caches, then the first user process. Finally scheduler takes control. The lab runs one hart, a RISC-V hardware thread; the other-hart branch remains in the source but is not exercised here.</p><p>Build the starter. Find <code>xv6 kernel is booting</code> before <code>init: starting sh</code> and the workbench program’s greeting. Your edit replaces kernel main itself. It does not change the user program.</p>`,
    excerpt: {
      file: "kernel/main.c",
      within: "main()",
      anchor: "consoleinit();",
      after: 10,
    },
    sourceNote:
      "Console and printf initialization precede the boot message. The allocator must be ready before later calls allocate memory; creating the first process comes after its dependencies.",
    assignment:
      'Change only "xv6 kernel is booting" to "Hello from my kernel". Build and run. The new line should appear during boot, while the user program’s greeting stays the same.',
    takeaway:
      "A kernel is executable code with its own entry and initialization path; user programs start only after that path has prepared the system.",
    reflection:
      "Why would a printf added before console initialization be a poor first boot experiment?",
    expected: "xv6 kernel is booting",
  }),
  "boot-needs-a-stack": bootLesson({
    title: "C needs a stack before it can run",
    goal: "Follow the initial per-hart stack calculation in the entry assembly.",
    starter: (files) =>
      after(
        files,
        "printfinit();",
        'uint64 top = (uint64)stack0 + (cpuid() + 1) * PGSIZE;\nprintf("boot stack top offset=%d\\n", (int)(top - (uint64)stack0));',
      ),
    reading: `<p>Ordinary C calls need a <strong>stack</strong> for saved registers and local values. Before calling start, entry.S loads the address of <code>stack0</code>, computes a per-hart slice and installs its top in the stack-pointer register <code>sp</code>.</p><p>Each slice has 4096 bytes. The calculation uses <code>hartid + 1</code> because a stack grows down from the top of its slice. For hart 0, the top is stack0 + 4096 and the bottom is stack0.</p><p>The supplied C observation repeats that source calculation using the real stack0 address and current hart ID. Its result is an offset from the array’s base, <em>not a measurement of the live sp register</em>. Build and find an offset of 4096. Later process kernel stacks are separate allocations; they do not reuse this initial boot stack.</p>`,
    excerpt: { file: "kernel/entry.S", anchor: "la sp, stack0", after: 7 },
    sourceNote:
      "la loads the array address, csrr reads the hart ID, mul computes the slice size, and add selects its top. Only after this setup does entry.S call C.",
    assignment:
      "In the printf argument, replace top - (uint64)stack0 with top - (uint64)stack0 - PGSIZE. The reported offset should become 0: the bottom of hart 0’s slice. This changes the observation, not the assembly’s installed stack pointer.",
    takeaway:
      "Startup assembly establishes the execution environment that ordinary C function calls assume.",
    reflection:
      "What would go wrong if two simultaneously running harts used the same stack slice?",
    expected: "boot stack top offset=4096",
  }),
  "boot-turns-on-paging": bootLesson({
    title: "Paging is enabled during boot",
    goal: "Observe the translation mode before and after the kernel installs its page table.",
    starter: (files) =>
      after(
        files,
        "kinit();",
        'printf("boot paging mode=%d\\n", (int)(r_satp() >> 60));',
      ),
    reading: `<p>RISC-V distinguishes machine, supervisor and user privilege. start prepares a return into supervisor mode, where the kernel runs. It also writes zero to <code>satp</code>, the register controlling supervisor address translation: paging initially starts disabled.</p><p>main first builds the kernel page table with kvminit, then installs it with kvminithart. The top four bits of satp encode its translation mode: 0 means Bare, and 8 means Sv39. The next chapter follows the page-table structure behind that mode.</p><p>The observation runs just after kinit, before the page table is installed. Build and expect mode 0. The browser C compiler uses a small native helper implementing the exact r_satp instruction from riscv.h; the returned value comes from this running CPU.</p>`,
    excerpt: {
      file: "kernel/start.c",
      within: "start()",
      anchor: "w_mstatus(x);",
      after: 9,
    },
    sourceNote:
      "mstatus selects the privilege used by mret, while satp independently controls translation. A translation-mode value does not by itself identify the current privilege level.",
    assignment:
      "Move the entire observation printf line to immediately after kvminithart(). Build and run. The same CPU register should now report mode 8, because the kernel has installed Sv39 translation.",
    takeaway:
      "Privilege and address translation are different mechanisms, configured at different steps of the boot path.",
    reflection:
      "Why must the kernel construct a valid page table before asking the CPU to use it?",
    expected: "boot paging mode=0",
    contextFiles: [
      "kernel/start.c",
      "kernel/main.c",
      "kernel/riscv.h",
      "kernel/workbench.c",
    ],
  }),
  "boot-prepares-physical-pages": bootLesson({
    title: "The allocator supplies physical pages",
    goal: "Allocate, use and release a real kernel page after allocator initialization.",
    starter: (files) =>
      after(
        files,
        "kinit();",
        'char *page = kalloc();\nif (page == 0) panic("boot allocation failed");\npage[0] = \'A\';\nprintf("allocated byte=%d\\n", (int)page[0]);\nkfree(page);',
      ),
    reading: `<p>User sbrk eventually depends on the kernel’s <strong>physical page allocator</strong>. kinit places available RAM pages, from the end of the kernel image to PHYSTOP, on a free list. Each free page stores the link to the next free page in its own bytes.</p><p>kalloc removes one page from that list and returns its kernel address. It can return zero when no page is available. kfree puts a page back; it does not preserve its previous contents for the caller.</p><p>The added boot code allocates one page after kinit, writes a byte, reads it back and releases the page before normal boot continues. Build and find 65, the character code for A. This is kernel allocation, unlike sbrk’s user-address-space growth; both ultimately use the same physical memory supply.</p>`,
    excerpt: {
      file: "kernel/kalloc.c",
      within: "kalloc(void)",
      anchor: "acquire(&kmem.lock);",
      after: 10,
    },
    sourceNote:
      "The allocator takes the first free-list node while holding its lock, advances the head, fills an allocated page with a debug pattern, and returns it. The lock becomes a later chapter’s focus.",
    assignment:
      "Change page[0] = 'A' to page[0] = 'Z'. Build and run. The readback should become 90. Keep the failure check and kfree; do not access page after releasing it.",
    takeaway:
      "Physical allocation transfers ownership of a page; freeing it ends that ownership even if a pointer still holds the address.",
    reflection:
      "Why is reading page[0] after kfree a different experiment from reading it before kfree?",
    contextFiles: ["kernel/main.c", "kernel/kalloc.c", "kernel/memlayout.h"],
    expected: "allocated byte=65",
  }),
  "initialization-is-not-execution": bootLesson({
    title: "Initialized records are not running processes",
    goal: "Distinguish preparing the process table from allocating and scheduling a process.",
    starter: (files) =>
      after(
        files,
        "procinit();",
        'int count = 0;\nfor (int i = 0; i < NPROC; i++)\n  if (proc[i].state == UNUSED) count++;\nprintf("boot matching slots=%d\\n", count);',
      ),
    reading: `<p>The kernel reserves a fixed array of process records. Zero-initialized records start in UNUSED, whose enum value is zero. procinit initializes each record’s lock and kernel-stack address; it does not start NPROC programs.</p><p>The inserted loop reads the table immediately after procinit, before userinit creates the first process. On this single-hart boot path, no scheduler is running another process concurrently. Build and find 64 UNUSED slots, the value of NPROC in this build.</p><p>Later allocproc claims an unused record, and userinit makes the first prepared process RUNNABLE. Still later the scheduler selects a runnable record and changes it to RUNNING. Initialization, allocation, eligibility and execution are four different events.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "procinit(void)",
      anchor: 'initlock(&pid_lock, "nextpid");',
      after: 5,
    },
    sourceNote:
      "procinit prepares locks and stack addresses for the records. The state enum and the actual initial table distinguish available slots from processes ready to execute.",
    assignment:
      "Change the loop’s test from UNUSED to RUNNABLE. Build and run. The matching count should be 0 at this stage; userinit has not yet created the first runnable process.",
    takeaway:
      "A data structure can be initialized and available without representing any active execution yet.",
    reflection:
      "Why is a count of 64 process-table slots not evidence that the machine is running 64 processes?",
    expected: "boot matching slots=64",
  }),
  "boot-creates-the-first-user-process": bootLesson({
    title: "Boot prepares the first user process",
    goal: "Find the first runnable process before the scheduler starts executing it.",
    starter: (files) =>
      after(
        files,
        "userinit();",
        'int count = 0;\nfor (int i = 0; i < NPROC; i++)\n  if (proc[i].state == RUNNABLE) count++;\nprintf("initial runnable=%d\\n", count);',
      ),
    reading: `<p>userinit creates the first process rather than loading every user program at boot. It allocates a process record and user page table, copies a tiny initcode program into user memory, and prepares a saved user PC of 0 and an initial stack pointer.</p><p>After recording its name and root directory, userinit marks the record RUNNABLE. It has prepared execution; the CPU is still in kernel main. The observation runs at exactly that boundary, before main calls scheduler. Build and expect one runnable process.</p><p>When selected, the process reaches the first return-to-user path. initcode requests exec of /init; init opens the console and starts the shell. The shell later starts workbench. Those are successive processes and program replacements, not extra tasks magically provided by the browser.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "userinit(void)",
      anchor: "p->trapframe->epc = 0;",
      after: 9,
    },
    sourceNote:
      "The saved entry PC and stack pointer define where user execution will begin. RUNNABLE means ready for selection, not already executing user instructions.",
    assignment:
      "Change the loop’s test from RUNNABLE to UNUSED. Build and run. The result should be 63: one record is now allocated to the first user process, and the remaining slots are unused.",
    takeaway:
      "The kernel explicitly constructs the first user execution state; ordinary user-level process creation builds on that starting point.",
    reflection:
      "Why can userinit return to kernel main even though the new user process has not run yet?",
    expected: "initial runnable=1",
  }),
};
