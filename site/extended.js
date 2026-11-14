// The remainder of the core curriculum, backed by guest/user/lab.c and stock xv6 programs.
const course = [
  {
    id: "identity",
    title: "Ask the kernel who you are",
    tag: "Processes · identity",
    command: "lab pid",
    breakpoint: "sys_getpid",
    source: "kernel/sysproc.c",
    goal: "Trace getpid from a user request to a kernel result.",
    concept:
      "The lab program calls the user getpid stub. Its ecall enters the trap path; the dispatcher chooses sys_getpid. The handler reads the current process’s PID. The result is placed in the saved a0 register before user execution resumes. A syscall is a request with a documented return value, not an ordinary call into kernel memory.",
    predict:
      "Where will the PID come from: the lab program, the shell, or the current kernel process record?",
    observe:
      "At the stop, refresh Processes & trapframes. Locate lab, inspect its saved a7, then Continue and compare the printed PID with the row.",
    expected:
      "user pid=<a positive number>; the PID varies as processes are created.",
    experiment:
      "Run lab pid twice. Explain why two invocations can print different PIDs even though their executable is identical.",
    question:
      "What identifies a process independently of the program it is running?",
    choices: [
      "Its PID.",
      "The executable filename alone.",
      "Its current PC address alone.",
    ],
    answer: 0,
    feedback:
      "The PID identifies the process; its program and current instruction can change during its lifetime.",
    wrong: [
      "",
      "Several processes can run the same executable.",
      "Different processes can execute the same virtual instruction address.",
    ],
    flow: [
      ["User stub", "ecall"],
      ["sys_getpid", "read current PID"],
      ["User a0", "receive result"],
    ],
    transfer:
      "Why can two copies of lab share a filename but have different PIDs?",
    transferAnswer:
      "Each launch creates a separate kernel process record, even when exec loads the same executable.",
  },
  {
    id: "exec",
    title: "Change the program, keep the process",
    tag: "Processes · exec",
    command: "lab exec",
    breakpoint: "sys_exec",
    source: "kernel/exec.c",
    goal: "Distinguish replacing an address space from creating a process.",
    concept:
      "exec builds a fresh user address space from an ELF executable, prepares an argument stack, and replaces the old program on success. PID and open descriptors survive. The first sys_exec stop may be the shell loading lab; lab then execs itself in pid mode. Compare the two printed PIDs after continuing.",
    predict:
      "Will the PID printed before exec match the PID printed by the replacement program?",
    observe:
      "Continue past the first exec stop. Compare before exec pid with user pid. Inspect the pinned exec source for the point where the old page table is freed.",
    expected: "before exec pid=N followed by user pid=N.",
    experiment:
      "Run an unknown command, then lab exec. Explain why a failed exec must leave the old program able to handle the error.",
    question: "What changes on a successful exec?",
    choices: [
      "The program and user address space.",
      "The process necessarily gets a new PID.",
      "Every descriptor is automatically closed.",
    ],
    answer: 0,
    feedback:
      "exec replaces the program inside an existing process. fork is the operation that creates another process.",
    wrong: [
      "",
      "Process creation and program replacement are separate operations.",
      "In xv6 open descriptors survive exec; this is how shell redirection works.",
    ],
    flow: [
      ["Old program", "calls exec"],
      ["Kernel", "loads ELF + stack"],
      ["Same PID", "new program"],
    ],
    transfer:
      "Why does successful exec not return to the instruction after the call?",
    transferAnswer:
      "That old instruction belongs to the replaced address space. The kernel resumes at the new executable’s entry point.",
  },
  {
    id: "wait",
    title: "Collect a child’s exit",
    tag: "Processes · exit & wait",
    command: "lab fork",
    breakpoint: "sys_wait",
    source: "kernel/proc.c",
    goal: "Explain exit status, zombie state, and reaping.",
    concept:
      "exit stops a process and releases many resources, but its process record retains the status until its parent calls wait. This zombie state preserves information the parent needs. The first wait breakpoint may belong to the shell waiting for lab. Within lab, a child changes its private variable and exits with status 23; its parent waits and reads that status.",
    predict: "Does changing value in the child change the parent’s copy?",
    observe:
      "Continue and compare child value, parent value and child status. At kernel stops, the process inspector shows actual states; transient zombies may disappear before the next snapshot.",
    expected: "child value=99; parent value=7 child status=23.",
    experiment:
      "Run zombie, then pause at a kernel function and inspect process states. This stock example leaves a child unreaped briefly; reset if you want a clean session.",
    question: "Why retain a zombie process record?",
    choices: [
      "So the parent can collect its exit information.",
      "So its user program keeps running.",
      "Because wait creates a second child.",
    ],
    answer: 0,
    feedback:
      "A zombie is no longer running user instructions. wait collects the status and allows the remaining record to be freed.",
    wrong: [
      "",
      "Zombie state means execution has ended, not that the child continues running.",
      "wait reaps an existing child; fork creates children.",
    ],
    flow: [
      ["Child", "exit(23)"],
      ["Kernel", "retain zombie status"],
      ["Parent", "wait reaps child"],
    ],
    transfer:
      "Why is “child exited” different from “all child resources have been reclaimed”?",
    transferAnswer:
      "Some state must remain to report the exit status. Reaping is the later cleanup performed by wait.",
  },
  {
    id: "descriptors",
    title: "Share a file offset",
    tag: "Files · dup",
    command: "lab fd",
    breakpoint: "sys_dup",
    source: "kernel/file.c",
    goal: "Distinguish a descriptor number from a shared open-file object.",
    concept:
      "A descriptor is an index in a process’s descriptor table. dup creates another descriptor referring to the same struct file, including its offset. The lab opens ABC, duplicates the read descriptor, then reads once through each. Opening the file twice instead would create independent open-file offsets.",
    predict: "Will the two reads produce A and A, or A and B?",
    observe:
      "At sys_dup, refresh the process inspector and note lab’s descriptor count. Continue and read the shared-offset output.",
    expected: "shared offset: A then B",
    experiment:
      "Compare the descriptor counts for init, sh and lab at the breakpoint. The count includes open handles, not unique inodes.",
    question: "What does dup share?",
    choices: [
      "The underlying open-file object and offset.",
      "Only the integer descriptor value.",
      "A private copy of all file contents.",
    ],
    answer: 0,
    feedback:
      "Two descriptor slots can point to one open-file object. Reading through either advances its shared offset.",
    wrong: [
      "",
      "The new descriptor is another integer slot referring to the same object.",
      "dup does not copy the file’s bytes.",
    ],
    flow: [
      ["fd A", "read A"],
      ["Shared file", "offset advances"],
      ["fd B", "read B"],
    ],
    transfer:
      "What would change if the program used open twice instead of dup?",
    transferAnswer:
      "It would get separate open-file objects, so the reads could each start at A.",
  },
  {
    id: "unlink",
    title: "Remove a name, keep an open file",
    tag: "Filesystem · lifetime",
    command: "lab unlink",
    breakpoint: "sys_unlink",
    source: "kernel/sysfile.c",
    goal: "Separate directory links from open references.",
    concept:
      "unlink removes a directory entry and reduces the inode’s link count. An already-open descriptor still holds a reference. File data can remain accessible through that descriptor until the last reference and link are gone. The lab opens held, unlinks its name, then reads through the still-open descriptor.",
    predict: "Can the open descriptor read after the name is removed?",
    observe:
      "Continue after sys_unlink and compare the read result with the absence of held in ls.",
    expected: "open descriptor still reads: alive",
    experiment:
      "After the experiment run cat held. Explain why a new open fails while the earlier open descriptor succeeded.",
    question: "What does unlink remove immediately?",
    choices: [
      "A directory name/link.",
      "Every open descriptor for the inode.",
      "The process that opened the file.",
    ],
    answer: 0,
    feedback:
      "A name and an open reference have different lifetimes. Removing one need not remove the other.",
    wrong: [
      "",
      "Existing descriptors remain valid references to the file.",
      "File operations do not terminate their callers.",
    ],
    flow: [
      ["Directory", "remove name"],
      ["Open descriptor", "keeps reference"],
      ["Last close", "permits reclamation"],
    ],
    transfer:
      "Why is pathname lookup not needed for every read on an open descriptor?",
    transferAnswer:
      "The descriptor already refers to an open-file object and inode. The kernel need not look the name up again.",
  },
  {
    id: "links",
    title: "Give one inode two names",
    tag: "Filesystem · hard links",
    command: "lab links",
    breakpoint: "sys_link",
    source: "kernel/sysfile.c",
    goal: "Explain how hard links refer to one inode.",
    concept:
      "A hard link adds a directory entry for an existing inode and increments its link count. It is not a copied file and not a symbolic pathname reference. The lab creates original, links alias to it, removes original, and reads the data through alias.",
    predict: "Will removing original make alias unreadable?",
    observe:
      "The first sys_link stop happens before the new link is installed. Continue and look for the bytes read through alias.",
    expected: "alias reads: linked",
    experiment:
      "Try echo text > first, ln first second, rm first, then cat second. Clean up with rm second.",
    question: "What does a hard link add?",
    choices: [
      "Another directory entry for the same inode.",
      "A second copy of every data block.",
      "A user-space pointer to the old filename.",
    ],
    answer: 0,
    feedback:
      "Both names identify the same inode. Its link count tracks directory links.",
    wrong: [
      "",
      "The blocks are shared because the inode is the same.",
      "Hard links refer to inode identity, not a string containing another path.",
    ],
    flow: [
      ["original", "one name"],
      ["Inode", "same data"],
      ["alias", "another name"],
    ],
    transfer: "Why can alias survive removing original?",
    transferAnswer:
      "The alias directory entry still links to the inode, so removing one other link does not discard the file.",
  },
  {
    id: "directories",
    title: "Resolve a pathname",
    tag: "Filesystem · directories",
    command: "mkdir labdir",
    breakpoint: "sys_mkdir",
    source: "kernel/fs.c",
    goal: "Explain pathname traversal and the current directory.",
    concept:
      "xv6 directories are special files containing name-to-inode entries. namei walks components from the root for absolute paths or from the process’s cwd for relative paths. mkdir creates the directory and its dot entries. The shell implements cd itself because changing only a child’s cwd would not change the shell’s cwd.",
    predict:
      "Why must cd be handled by the shell rather than an ordinary child command?",
    observe:
      "Continue after mkdir, run ls labdir, then cd labdir and ls. Use cd / to return.",
    expected: "ls labdir shows . and ..; the new directory is visible in ls.",
    experiment:
      "Create a file inside labdir, return to /, and read it by its relative path. Remove the file before removing labdir.",
    question: "What determines the starting point of a relative pathname?",
    choices: [
      "The process’s current working directory.",
      "The executable’s name.",
      "The UART address.",
    ],
    answer: 0,
    feedback:
      "cwd is process state; fork inherits it and chdir changes it for the calling process.",
    wrong: [
      "",
      "Executable identity does not determine cwd.",
      "Console hardware has no role in pathname traversal.",
    ],
    flow: [
      ["Path", "split components"],
      ["Directory", "lookup name"],
      ["Inode", "next component"],
    ],
    transfer:
      "Why would a separate child program implementing cd be insufficient?",
    transferAnswer:
      "It would change that child’s cwd. The parent shell would retain its original directory.",
  },
  {
    id: "heap",
    title: "Grow a user address space",
    tag: "Virtual memory · allocation",
    command: "lab vm",
    breakpoint: "sys_sbrk",
    source: "kernel/vm.c",
    goal: "Relate sbrk, process size, physical pages and mappings.",
    concept:
      "This pinned xv6 uses eager allocation: increasing the user break allocates physical pages and installs mappings. The lab queries the old break, grows it by 4096 bytes, stores 42, then shrinks it. Its first sbrk breakpoint is the query, so it occurs before the growth. Process size and page-table entries describe different aspects of the address space.",
    predict:
      "Does growing the break by one page require only changing a C pointer?",
    observe:
      "At the first sys_sbrk, refresh processes and note lab’s size. Continue and read the growth result. Inspect uvmalloc in the source.",
    expected: "heap grew=4096 bytes value=42",
    experiment:
      "Run the command again. Explain why a new process starts with its own initial heap rather than inheriting the prior lab invocation’s growth.",
    question: "In this eager-allocation xv6, what must growth install?",
    choices: [
      "Physical memory and valid user mappings.",
      "Only a new filename.",
      "A mapping shared with every process.",
    ],
    answer: 0,
    feedback:
      "The kernel allocates pages, maps them into this process, and updates its size; shrink frees mappings and pages.",
    wrong: [
      "",
      "Filesystem names are independent of the process break.",
      "User heaps are isolated address spaces.",
    ],
    flow: [
      ["sbrk", "request bytes"],
      ["Kernel", "allocate + map"],
      ["User", "store 42"],
    ],
    transfer: "Why is a process’s virtual size not itself a physical address?",
    transferAnswer:
      "Size bounds the virtual range. Page tables translate addresses in that range to separately allocated physical pages.",
  },
  {
    id: "pagetables",
    title: "Walk a real Sv39 page table",
    tag: "Virtual memory · translation",
    command: "lab pid",
    breakpoint: "sys_getpid",
    source: "kernel/vm.c",
    goal: "Decode a three-level page-table walk and user permissions.",
    concept:
      "Sv39 splits a virtual address into three 9-bit indices and a 12-bit page offset. Each index selects an eight-byte PTE. A non-leaf PTE points to the next level; a leaf supplies a physical page and permissions. xv6 adds a supervisor-only guard page below the user stack, so “mapped” and “user-accessible” are not identical.",
    predict:
      "Can virtual address 0 in two processes translate to different physical pages?",
    observe:
      "At sys_getpid, refresh processes, select lab, and walk 0x0. Read the three indices, PTE values and final physical address. Compare with sh.",
    expected:
      "The walker shows a valid user executable mapping at 0x0 for lab; physical addresses vary.",
    experiment:
      "Walk 0x40000000 for lab and compare its invalid PTE with 0x0. Do not confuse an unmapped address with a mapped page lacking U permission.",
    question:
      "Which part of a normal 4 KiB page address survives translation unchanged?",
    choices: [
      "The low 12-bit page offset.",
      "All three page-table indices.",
      "The process PID.",
    ],
    answer: 0,
    feedback:
      "Translation selects a physical page; the offset identifies the byte within that page.",
    wrong: [
      "",
      "The indices choose the translation entries rather than appearing unchanged in the physical address.",
      "PID is not part of the Sv39 virtual-address bit layout.",
    ],
    flow: [
      ["VPN[2:0]", "three indices"],
      ["PTEs", "follow levels"],
      ["Physical page", "add offset"],
    ],
    transfer: "Why does a valid PTE without U not grant user-mode access?",
    transferAnswer:
      "V says the mapping exists. U is a separate permission controlling whether user mode may access it.",
  },
  {
    id: "faults",
    title: "Contain a user memory fault",
    tag: "Virtual memory · faults",
    command: "lab fault",
    source: "kernel/trap.c",
    goal: "Explain how a user fault can end one process without ending the kernel.",
    concept:
      "A child deliberately stores to unmapped virtual address 0x40000000. The CPU traps rather than performing that store. usertrap identifies the unexpected exception and kills the child; the parent waits, reports the status, and survives. This xv6 does not implement demand paging or swapping for this access.",
    predict: "Will one invalid user store crash the entire machine?",
    observe:
      "Read the guest diagnostic, then find parent survived and the returning shell prompt. The diagnostic address is the attempted virtual access.",
    expected:
      "An unexpected user trap diagnostic, followed by parent survived child fault, status=-1.",
    experiment:
      "Run lab pid after the fault. Explain what the working shell and new process demonstrate about isolation.",
    question:
      "What prevents the invalid store from becoming an arbitrary physical write?",
    choices: [
      "Address translation and privilege checks trap the access.",
      "The shell rewrites every pointer.",
      "The C language silently ignores the store.",
    ],
    answer: 0,
    feedback:
      "The architectural trap redirects execution to kernel handling before an invalid user memory operation completes.",
    wrong: [
      "",
      "The shell does not inspect each memory operation of its children.",
      "C does not make invalid pointer writes safe; the machine and kernel enforce this boundary.",
    ],
    flow: [
      ["User store", "unmapped VA"],
      ["CPU trap", "enter kernel"],
      ["Kernel", "terminate child"],
    ],
    transfer: "How would demand paging change the response to some faults?",
    transferAnswer:
      "A kernel could allocate or restore a valid page and retry the instruction. That policy is not implemented for this access in this lab’s xv6.",
  },
  {
    id: "traps",
    title: "Find the saved user registers",
    tag: "Traps · trapframes",
    command: "lab pid",
    breakpoint: "sys_getpid",
    source: "kernel/trampoline.S",
    goal: "Separate saved user context from the kernel’s live CPU context.",
    concept:
      "The trampoline saves user registers into the current process’s trapframe before switching into the kernel’s execution environment. C kernel code then reuses CPU registers. At sys_getpid, inspect lab’s saved a7 and epc alongside the live registers. They describe different contexts. The dispatcher later stores the syscall return value in saved a0.",
    predict:
      "Must the live a0 in a kernel function still equal the original user a0?",
    observe:
      "Refresh processes and inspect lab’s trapframe epc, a0 and a7. Compare with live a0 and the current kernel PC.",
    expected:
      "The running lab row has a saved user PC and syscall number a7=11 (getpid).",
    experiment:
      "Compare a saved user epc with the current kernel PC. Use the source panel to locate sys_getpid and trampoline.S in Go deeper.",
    question:
      "Where should you look for original user syscall arguments during kernel execution?",
    choices: [
      "The saved user trapframe.",
      "Any live kernel register with a matching name.",
      "The shell’s command string.",
    ],
    answer: 0,
    feedback:
      "The trapframe preserves the user context while the kernel uses CPU registers for its own instructions.",
    wrong: [
      "",
      "The compiler and kernel may already have reused that register.",
      "The shell string is not the ABI representation of syscall arguments.",
    ],
    flow: [
      ["User context", "save registers"],
      ["Trapframe", "preserve values"],
      ["Kernel context", "reuse registers"],
    ],
    transfer:
      "Why must the return path restore user registers before returning to user mode?",
    transferAnswer:
      "The kernel has used its own registers and stack. Restoring the saved context lets the user program resume with the specified syscall result.",
  },
  {
    id: "scheduling",
    title: "Share one CPU between processes",
    tag: "Scheduling · context switches",
    command: "lab yield",
    breakpoint: "sched",
    source: "kernel/proc.c",
    goal: "Explain runnable, running and sleeping states on one hart.",
    concept:
      "Concurrency does not require multiple CPUs. A scheduler selects a runnable process, switches kernel contexts, and later regains control when it blocks, yields or is preempted. lab yield launches a child; both print turns and sleep. Output order is not fixed. A scheduler breakpoint can fire before lab starts, so the process table reflects that actual instant.",
    predict: "Can both parent and child make progress on a single hart?",
    observe:
      "At the sched stop, refresh the process table and compare states. Continue and observe turns from both parent and child.",
    expected: "Three parent turns and three child turns; order may vary.",
    experiment:
      "Run lab yield twice and compare order without interpreting elapsed browser time as a CPU measurement.",
    question: "What does a context switch preserve for later resumption?",
    choices: [
      "The suspended execution context.",
      "A second physical CPU.",
      "A copy of every file on disk.",
    ],
    answer: 0,
    feedback:
      "Saved registers and stack state let a process resume where its kernel execution left off.",
    wrong: [
      "",
      "A single hart can alternate between many process contexts.",
      "Scheduling does not copy disk files.",
    ],
    flow: [
      ["Runnable", "eligible to run"],
      ["Running", "owns the hart"],
      ["Sleeping", "waits for event"],
    ],
    transfer:
      "Why should a sleeping process not busy-loop in the runnable queue?",
    transferAnswer:
      "Sleeping records what it is waiting for and lets the CPU run other work until an event makes it runnable.",
  },
  {
    id: "sleeping",
    title: "Sleep until an event",
    tag: "Scheduling · wakeup",
    command: "lab sleep",
    breakpoint: "sys_sleep",
    source: "kernel/sysproc.c",
    goal: "Explain how timer interrupts, sleep channels and wakeups cooperate.",
    concept:
      "sys_sleep waits for ticks to advance. It checks a condition under tickslock, sleeps on a channel when the condition is false, and rechecks after waking. Timer interrupt handling increments ticks and wakes waiters. A wakeup is a chance to recheck a condition, not a guarantee that the condition remains true.",
    predict:
      "While lab sleeps, does the CPU have to run a loop inside that user process?",
    observe:
      "Continue after sys_sleep. Watch sleeping for 3 timer ticks followed by awake. For a deeper stop, choose sleep in Advanced and inspect sleeping channels.",
    expected: "sleeping for 3 timer ticks, then awake after timer wakeup.",
    experiment:
      "Run lab yield to see another process make progress while a peer sleeps.",
    question: "What should code do after a wakeup?",
    choices: [
      "Recheck the condition it was waiting for.",
      "Assume the condition must still be true.",
      "Disable interrupts forever.",
    ],
    answer: 0,
    feedback:
      "Other execution may change the condition. xv6 waits in a loop protected by the appropriate synchronization.",
    wrong: [
      "",
      "Wakeup does not reserve a resource or promise the condition will remain true.",
      "Permanent interrupt disabling prevents the events that many waiters need.",
    ],
    flow: [
      ["Condition false", "sleep on channel"],
      ["Event", "wakeup channel"],
      ["Runnable", "recheck condition"],
    ],
    transfer:
      "Why use a channel instead of waking every sleeping process for every event?",
    transferAnswer:
      "A channel groups waiters for a particular condition so unrelated sleepers need not be made runnable.",
  },
  {
    id: "blocking",
    title: "Watch a pipe reader wait",
    tag: "IPC · blocking & EOF",
    command: "lab pipe",
    breakpoint: "piperead",
    source: "kernel/pipe.c",
    goal: "Distinguish an empty pipe, a wakeup, and end of file.",
    concept:
      "The parent delays its write, so the child must wait if it reads first. piperead sleeps when the pipe is empty but a write end remains open. The writer adds hey and wakes readers, then closes its end. After buffered bytes are consumed, the next read returns zero because no writer remains.",
    predict: "Does an empty pipe necessarily mean end of file?",
    observe:
      "Continue after piperead and look for reader got 3 bytes and reader EOF=0. Inspect the source’s readopen/writeopen conditions.",
    expected: "reader got 3 bytes: hey; reader EOF=0.",
    experiment:
      "Compare lab pipe with echo hey | wc. Explain how closing unused pipe ends enables both readers to finish.",
    question: "When can read on a pipe return EOF?",
    choices: [
      "When the buffer is drained and all write ends are closed.",
      "Whenever the pipe is temporarily empty.",
      "Whenever a timer interrupt arrives.",
    ],
    answer: 0,
    feedback:
      "An empty pipe with a live writer is a waiting condition; no writers plus an empty buffer is end of file.",
    wrong: [
      "",
      "More bytes may still arrive while a writer exists.",
      "Timer interrupts do not define a stream’s end.",
    ],
    flow: [
      ["Empty + writer", "reader sleeps"],
      ["Write hey", "reader wakes"],
      ["No writers", "read returns 0"],
    ],
    transfer:
      "Why does a write end inherited across fork matter even if that process never writes?",
    transferAnswer:
      "It is still an open writer reference, so a reader cannot yet conclude that no future bytes can arrive.",
  },
  {
    id: "locks",
    title: "Protect a kernel invariant",
    tag: "Synchronization · locks",
    command: "lab pid",
    breakpoint: "acquire",
    source: "kernel/spinlock.c",
    goal: "Explain why spinlocks also control local interrupt delivery.",
    concept:
      "Even one hart can interleave kernel work with interrupt handlers. acquire disables local interrupts before attempting the atomic lock operation. If an interrupt handler tried to acquire a lock held by the interrupted code on the same hart, spinning would deadlock: the interrupted owner cannot resume to release it. Multi-hart mutual exclusion is a separate reason for the atomic operation.",
    predict: "Can one CPU still deadlock on a spinlock?",
    observe:
      "The acquire stop may belong to console or scheduler activity. Inspect its exact source location, then Continue. Read push_off/pop_off and nesting.",
    expected:
      "Execution pauses in acquire, then lab pid completes after Continue.",
    experiment:
      "Compare the use of spinlocks in pipe.c with sleep locks in sleeplock.c. Identify which operations may block.",
    question: "Why disable local interrupts while holding a spinlock?",
    choices: [
      "To prevent local interrupt re-entry from deadlocking on the same lock.",
      "To turn one hart into multiple harts.",
      "To make every operation on the machine permanently atomic.",
    ],
    answer: 0,
    feedback:
      "The interrupted owner cannot release the lock while its interrupt handler spins. Interrupt masking prevents that local cycle.",
    wrong: [
      "",
      "Interrupt masking does not add execution hardware.",
      "The protection has a bounded scope; it is not global atomicity for unrelated operations.",
    ],
    flow: [
      ["push_off", "mask local interrupts"],
      ["Atomic acquire", "protect invariant"],
      ["release + pop_off", "restore nesting"],
    ],
    transfer: "Why is a spinlock unsuitable for a long disk wait?",
    transferAnswer:
      "Spinning wastes execution and holding spinlocks constrains scheduling. xv6 uses sleeping synchronization where blocking is required.",
  },
  {
    id: "cache",
    title: "Find a block in the buffer cache",
    tag: "Storage · buffer cache",
    command: "cat README",
    breakpoint: "bread",
    source: "kernel/bio.c",
    goal: "Separate a cached block lookup from a device request.",
    concept:
      "bread obtains a buffer for a device/block pair. If its contents are already valid, it can return cached data; otherwise it reads from the disk and marks the buffer valid. Reference counts keep active buffers from being recycled. The buffer’s sleep lock protects its contents. File access can involve metadata buffers as well as file-data buffers.",
    predict: "Does every bread call necessarily issue a disk request?",
    observe:
      "At bread inspect the matching source, then Continue and read the guest README. The breakpoint alone does not prove a cache miss.",
    expected: "The bundled README is printed and the shell returns.",
    experiment:
      "Run cat README again. Use the source to explain why the same observable file contents do not imply identical device operations.",
    question: "When can bread avoid issuing a device read?",
    choices: [
      "When the requested buffer already has valid contents.",
      "Whenever the filename is short.",
      "Only when the process PID is one.",
    ],
    answer: 0,
    feedback:
      "The cache is keyed by device and block identity; validity determines whether bytes must be fetched.",
    wrong: [
      "",
      "Pathname length does not establish cache validity.",
      "PID does not determine whether a block is cached.",
    ],
    flow: [
      ["Block identity", "find buffer"],
      ["Valid?", "reuse or fetch"],
      ["Locked buffer", "read bytes"],
    ],
    transfer:
      "Why must an in-use buffer not be recycled for a different block?",
    transferAnswer:
      "A caller may still rely on that buffer’s identity and bytes. Reference counts prevent the cache from reassigning it prematurely.",
  },
  {
    id: "blocks",
    title: "Cross into indirect blocks",
    tag: "Storage · inode mapping",
    command: "lab file",
    breakpoint: "writei",
    source: "kernel/fs.c",
    goal: "Explain how a logical file block maps to a disk block.",
    concept:
      "An inode holds a fixed set of direct block addresses and one indirect-block address. In this xv6 there are 12 direct entries and 256 indirect entries per 1024-byte block. The lab writes 14 blocks, crossing the direct range. bmap locates an existing block or allocates one when writing; the writei breakpoint may be metadata or another write before lab’s writes.",
    predict:
      "Does the inode need a direct address field for every block in a file?",
    observe:
      "Continue and confirm the 14336-byte file result. Inspect NDIRECT, NINDIRECT and bmap in the matching source.",
    expected: "file size=14336 bytes across direct and indirect blocks",
    experiment:
      "Read the lab file mode source. Work out which logical block first requires an indirect entry (zero-based index 12).",
    question: "What does an indirect block contain?",
    choices: [
      "Disk block addresses for file data.",
      "An unrelated process’s registers.",
      "Only the filename text.",
    ],
    answer: 0,
    feedback:
      "Indirection extends the number of logical blocks that an inode can address without adding a direct field for each one.",
    wrong: [
      "",
      "Registers belong to execution context, not file block mapping.",
      "Names are directory entries, separate from an inode’s block addresses.",
    ],
    flow: [
      ["File offset", "logical block"],
      ["Inode + indirect", "resolve mapping"],
      ["Disk block", "data bytes"],
    ],
    transfer:
      "Why does increasing file size sometimes require allocating metadata as well as data?",
    transferAnswer:
      "Crossing into the indirect range requires a block to store the additional block addresses, as well as the file’s data blocks.",
  },
  {
    id: "transactions",
    title: "Follow a filesystem transaction",
    tag: "Storage · logging & recovery",
    command: "lab links",
    breakpoint: "begin_op",
    source: "kernel/log.c",
    goal: "Explain write-ahead logging and the commit record.",
    concept:
      "Filesystem operations call begin_op and end_op around logged changes. At commit, xv6 writes modified blocks into the log, writes a nonzero log header as the commit point, installs the blocks at their home locations, and clears the header. Recovery replays a committed log after boot. A transaction may encompass concurrent operations; it is not necessarily one syscall. This lab exposes code and execution, not a simulated power-loss result.",
    predict:
      "Why must the commit header be written after the logged block data?",
    observe:
      "Continue after begin_op and verify alias reads linked. Open the matching log.c source and follow write_log, write_head, install_trans and recover_from_log.",
    expected:
      "The link/unlink experiment completes. The source shows the log commit and replay ordering.",
    experiment:
      "Find end_op in sysfile.c and explain why the final outstanding operation can trigger commit. Reset starts from the original disk, so it is not a crash-recovery test.",
    question: "Which on-disk event says a log transaction is committed?",
    choices: [
      "Writing the nonzero log header after its data.",
      "Merely changing a buffer in RAM.",
      "Printing a success message in the browser.",
    ],
    answer: 0,
    feedback:
      "The committed header tells recovery which logged blocks to replay. RAM-only changes are not a durable commit.",
    wrong: [
      "",
      "RAM can be lost; log recovery relies on ordered disk state.",
      "Console output is not the filesystem’s commit record.",
    ],
    flow: [
      ["Log data", "write new blocks"],
      ["Log header", "commit point"],
      ["Install + clear", "replay is safe"],
    ],
    transfer:
      "Why can replaying the committed blocks again be safe after an interrupted installation?",
    transferAnswer:
      "Redo writes the same committed block contents to the same home locations. Repeating that installation produces the same filesystem state.",
  },
  {
    id: "capstone",
    title: "Explain a program from end to end",
    tag: "Capstone · connect the layers",
    command: "lab pipe",
    source: "user/lab.c",
    goal: "Explain a complete execution using process, memory, scheduling and filesystem concepts.",
    concept:
      "The shell resolves lab, forks a child, and exec loads its ELF into a new address space. lab creates a pipe and forks again. Its parent sleeps, writes bytes and closes descriptors; its child reads, waits when necessary, reaches EOF and exits. wait reaps children, and the shell prints its next prompt. No single layer explains the entire result.",
    predict:
      "List the kernel mechanisms needed before the reader can print hey and return EOF.",
    observe:
      "Run the program without a breakpoint. Then repeat using piperead or sys_wait from Advanced and use the inspectors to connect your explanation to actual state.",
    expected: "reader got 3 bytes: hey; reader EOF=0; then a shell prompt.",
    experiment:
      "Explain echo hello > note and echo hello | wc using the same layers. Include what survives exec and what wait reclaims.",
    question: "Which explanation accounts for both blocking and EOF?",
    choices: [
      "Scheduling handles waiting; descriptor lifetime determines when no writers remain.",
      "All reads are immediate because both processes run simultaneously.",
      "EOF is just a fixed timeout.",
    ],
    answer: 0,
    feedback:
      "A complete explanation connects execution state, synchronization and reference lifetimes rather than attributing everything to one mechanism.",
    wrong: [
      "",
      "The guest has one hart, and reads may sleep until data arrives.",
      "EOF is defined by stream state, not elapsed time.",
    ],
    flow: [
      ["Create + load", "fork / exec / VM"],
      ["Communicate", "pipe / sleep / write"],
      ["Finish", "close / exit / wait"],
    ],
    transfer:
      "Can you explain why the shell prompt returns even though several processes ran?",
    transferAnswer:
      "The shell waits for its command child. That child waits for its own reader. Closing the pipe permits EOF, exits complete, waits reap the children, and the original shell resumes.",
  },
];
course.forEach((c, i) => {
  const shift = i % 3;
  c.choices = [...c.choices.slice(shift), ...c.choices.slice(0, shift)];
  c.wrong = [...c.wrong.slice(shift), ...c.wrong.slice(0, shift)];
  c.answer = (3 - shift) % 3;
});
export const extendedLessons = course.map((c) => ({
  ...c,
  intro: c.goal,
  next: "Use the matching guest source and inspectors to support your explanation.",
}));
export const extendedLearning = Object.fromEntries(
  course.map((c) => [
    c.id,
    {
      goal: c.goal,
      needs:
        "Builds on the earlier foundations. All experiments use the same running xv6 machine.",
      observe: c.observe,
      hint:
        c.expected +
        " If paused, inspect the kernel state before pressing Continue. Breakpoints are global and may stop shell activity too.",
      takeaway: c.feedback,
      transfer: c.transfer,
      transferAnswer: c.transferAnswer,
      flow: c.flow,
      wrong: c.wrong,
      steps: [
        "Write a prediction, then use Run this experiment to prepare the machine and command.",
        c.observe,
        "Compare the result with your prediction, then try the variation below.",
      ],
    },
  ]),
);
