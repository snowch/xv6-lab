// Original xv6 Lab diagrams. Layout, wording and interactions are authored here;
// no illustrations or layouts are imported from textbooks or other courses.
const node = (key, title, text, zone = "") => ({ key, title, text, zone });
const frame = (title, text, active, changes = {}) => ({
  title,
  text,
  active,
  changes,
});
const model = (title, summary, nodes, source, extra = {}) => ({
  title,
  summary,
  nodes,
  source,
  layout: "flow",
  ...extra,
});

export const concepts = {
  program: model(
    "Source, executable and process are different things",
    "Build creates instructions; the kernel supplies the running instance’s memory and state.",
    [
      node("source", "C source", "The text you edit describes the program."),
      node(
        "binary",
        "RISC-V executable",
        "The build turns that source into machine instructions.",
      ),
      node(
        "process",
        "Running process",
        "xv6 runs the executable with process memory and a kernel record.",
      ),
    ],
    "user/sh.c · runcmd; kernel/proc.c · fork; kernel/exec.c · exec",
  ),
  bytes: model(
    "The count selects bytes, not a whole string",
    "The string hello followed by a newline occupies seven bytes including its C terminator.",
    [
      node("memory", "Bytes in memory", "h · e · l · l · o · newline · NUL"),
      node(
        "request",
        "write(1, message, 3)",
        "Copy the first three bytes to standard output.",
      ),
      node(
        "output",
        "Console output",
        "hel — neither the newline nor the NUL is included.",
      ),
    ],
    "kernel/sysfile.c · sys_write; kernel/file.c · filewrite",
  ),
  result: model(
    "A request delivers a C return value",
    "getpid lets the caller read its identifier from the kernel.",
    [
      node("caller", "User program", "Call getpid()."),
      node("handler", "Kernel handler", "Read the calling process’s PID."),
      node(
        "answer",
        "User program continues",
        "Receive that integer; printf can display it.",
      ),
    ],
    "user/user.h · getpid; kernel/sysproc.c · sys_getpid",
  ),
  currentproc: model(
    "Follow the current CPU’s process pointer",
    "While handling this process’s call, myproc follows c->proc to the caller’s kernel record.",
    [
      node(
        "cpu",
        "Current CPU record",
        "c = mycpu(); interrupts are temporarily disabled for this lookup.",
      ),
      node(
        "process",
        "Process record",
        "p = c->proc; this is the process running on that CPU.",
      ),
      node(
        "pid",
        "Stored identifier",
        "p->pid is a field in that process record.",
      ),
    ],
    "kernel/proc.c · myproc; kernel/proc.h · struct cpu · struct proc",
  ),
  changedanswer: model(
    "Computing an answer does not assign to the record",
    "For return p->pid + 1000, let the stored PID be n. These are two different destinations.",
    [
      node(
        "stored",
        "Kernel process record",
        "p->pid stays n; the expression never assigns to this field.",
      ),
      node(
        "returned",
        "Caller’s return value",
        "Saved a0 receives n + 1000; the user program can print that sum.",
      ),
    ],
    "kernel/sysproc.c · sys_getpid; kernel/syscall.c · syscall",
    { layout: "compare" },
  ),
  entry: model(
    "The stub requests a kernel service",
    "ecall requests kernel entry; a7 tells xv6 which service was requested.",
    [
      node(
        "stub",
        "getpid stub",
        "The C call reaches the stub, which sets a7 = SYS_getpid and executes ecall.",
        "User",
      ),
      node(
        "handler",
        "Trap and dispatch",
        "usertrap calls syscall; the call number selects sys_getpid.",
        "Kernel",
      ),
      node(
        "caller",
        "Return to the caller",
        "The stub’s ret resumes the C caller with the returned integer.",
        "User",
      ),
    ],
    "user/usys.S · kernel/trap.c · kernel/syscall.c · kernel/sysproc.c",
  ),
  syscall: model(
    "A request crosses a privilege boundary",
    "A getpid example: the stub supplies a service number; the kernel selects the handler and returns a result.",
    [
      node("stub", "User stub", "a7 = SYS_getpid; ecall", "User"),
      node(
        "trap",
        "uservec → usertrap",
        "Save user registers; advance epc past ecall.",
        "Kernel",
      ),
      node(
        "dispatch",
        "syscall → sys_getpid",
        "Select the handler; put its result in saved a0.",
        "Kernel",
      ),
      node(
        "return",
        "userret → caller",
        "Restore user registers; sret returns to user mode.",
        "User",
      ),
    ],
    "user/usys.S · kernel/trampoline.S · kernel/trap.c · kernel/syscall.c",
    {
      steps: [
        frame(
          "Request",
          "The user stub places the service number in a7. ecall requests kernel entry; it does not implement getpid.",
          ["stub"],
        ),
        frame(
          "Enter and dispatch",
          "The trampoline saves user registers. usertrap recognizes scause 8, advances epc by four and calls the dispatcher.",
          ["trap", "dispatch"],
        ),
        frame(
          "Return",
          "The handler result is stored in trapframe->a0. The return path restores that value as the user’s a0.",
          ["return"],
        ),
      ],
    },
  ),
  fork: model(
    "One fork creates two continuations",
    "On success, both processes continue after fork, with separate user memory and different return values.",
    [
      node(
        "call",
        "Parent calls fork",
        "One running process enters the kernel.",
      ),
      node(
        "parent",
        "Parent continuation",
        "fork returns the child’s PID; its memory remains its own.",
      ),
      node(
        "child",
        "Child continuation",
        "fork returns 0; copied user pages can now change independently.",
      ),
    ],
    "kernel/proc.c · fork · uvmcopy",
    { layout: "branch", edgeLabels: ["Parent result > 0", "Child result = 0"] },
  ),
  wait: model(
    "Exit and collection are different events",
    "The child stops executing before its parent collects the retained exit record.",
    [
      node("running", "Child runs", "The parent may block in wait."),
      node("zombie", "ZOMBIE", "exit records xstate and wakes its parent."),
      node(
        "collected",
        "Record collected",
        "wait copies xstate, frees the child record and returns its PID.",
      ),
    ],
    "kernel/proc.c · exit · wait",
  ),
  exec: model(
    "Prepare first; replace only on success",
    "An exec failure returns to the old program. Successful preparation commits a new image in the same process.",
    [
      node(
        "old",
        "Current process",
        "Old page table and memory remain available.",
      ),
      node(
        "candidate",
        "Candidate image",
        "Validate ELF; allocate pages; load segments; copy arguments.",
      ),
      node(
        "commit",
        "Commit",
        "Install the candidate page table, epc and sp; free the old image.",
      ),
    ],
    "kernel/exec.c · exec",
    {
      steps: [
        frame(
          "Keep the current image",
          "Before commit, the process still owns its old address space.",
          ["old"],
        ),
        frame(
          "Prepare a candidate",
          "The loader constructs a different page table. A preparation failure frees this candidate and returns -1 to the old program.",
          ["candidate"],
        ),
        frame(
          "Commit the replacement",
          "On success, the process keeps its identity and open descriptors while replacing its memory and entry state.",
          ["commit"],
        ),
      ],
    },
  ),
  pages: model(
    "Memory growth crosses page boundaries",
    "The logical size is measured in bytes; physical allocation and mappings use 4096-byte pages.",
    [
      node("size", "p->sz", "The requested byte limit can end inside a page."),
      node(
        "map",
        "Page mapping",
        "A leaf PTE connects a virtual page to a physical page.",
      ),
      node(
        "offset",
        "Byte within the page",
        "The low 12 address bits select the byte.",
      ),
    ],
    "kernel/proc.c · growproc; kernel/vm.c · uvmalloc",
    { layout: "compare" },
  ),
  address: model(
    "Split an Sv39 virtual address",
    "For xv6’s low user addresses, three 9-bit indices choose page-table entries; the 12-bit offset is unchanged.",
    [
      node(
        "l2",
        "VPN[2] · bits 38–30",
        "Select an entry in the root page table.",
      ),
      node("l1", "VPN[1] · bits 29–21", "Select an entry in the next table."),
      node("l0", "VPN[0] · bits 20–12", "Select the final entry."),
      node(
        "offset",
        "Offset · bits 11–0",
        "Select a byte in a 4096-byte page.",
      ),
    ],
    "kernel/riscv.h · PX · PXSHIFT · PGSIZE",
    { layout: "compare" },
  ),
  walk: model(
    "Follow a three-level page-table walk",
    "This example follows a normal 4 KiB mapping. Each intermediate PTE names another table.",
    [
      node("root", "Level 2 table", "pagetable[VPN[2]] → next table", "Table"),
      node("middle", "Level 1 table", "next[VPN[1]] → next table", "Table"),
      node("leaf", "Level 0 table", "next[VPN[0]] → leaf PTE", "Table"),
      node(
        "byte",
        "Physical byte",
        "Leaf physical-page base + unchanged offset",
        "Memory",
      ),
    ],
    "kernel/vm.c · walk · walkaddr",
    {
      steps: [
        frame(
          "Start at the root",
          "walk begins with the supplied page-table pointer and uses the level-2 index.",
          ["root"],
        ),
        frame(
          "Follow an intermediate PTE",
          "A valid non-leaf entry stores the physical page number of the next table.",
          ["middle"],
        ),
        frame(
          "Reach the leaf",
          "The level-0 entry supplies a page number and permission flags. walkaddr additionally checks valid and user-accessible bits.",
          ["leaf"],
        ),
        frame(
          "Keep the offset",
          "Combine the physical page base with the original low 12 bits to locate the byte.",
          ["byte"],
        ),
      ],
    },
  ),
  guard: model(
    "A mapped page can still deny user access",
    "The guard page has a mapping, but its user-access bit is cleared.",
    [
      node(
        "stack",
        "Usable stack page",
        "PTE_V = 1; PTE_U = 1",
        "User accessible",
      ),
      node(
        "guard",
        "Guard page below it",
        "PTE_V = 1; PTE_U = 0",
        "User access denied",
      ),
      node(
        "fault",
        "Crossing into the guard",
        "A user load or store faults; mapping existence is insufficient.",
      ),
    ],
    "kernel/exec.c · uvmclear; kernel/vm.c · uvmclear",
    { layout: "stack" },
  ),
  userfault: model(
    "A stale address does not retain its mapping",
    "The child releases a page, then reads through its old pointer. The parent is a separate process.",
    [
      node(
        "released",
        "Child releases a page",
        "sbrk(-4096) removes its mapping; the pointer variable still holds the old address.",
      ),
      node(
        "fault",
        "Child reads that address",
        "The CPU faults. usertrap marks the child killed; exit records status -1.",
      ),
      node(
        "parent",
        "Parent continues",
        "wait collects the child’s status. The parent’s mappings remain its own.",
      ),
    ],
    "kernel/vm.c · uvmdealloc; kernel/trap.c · usertrap; kernel/proc.c · exit · wait",
  ),
  permissions: model(
    "Read permissions before using an address",
    "These flags describe a PTE, not the size or ownership of a C object.",
    [
      node("valid", "V · valid", "Is this PTE present?"),
      node("user", "U · user", "May user mode access this page?"),
      node("access", "R / W / X", "Which hardware access types are permitted?"),
    ],
    "kernel/riscv.h · PTE flags; kernel/vm.c · walkaddr",
    { layout: "compare" },
  ),
  copy: model(
    "Checked copies cross one page at a time",
    "A user buffer may begin in one mapped page and extend into a different mapping.",
    [
      node(
        "first",
        "First user page",
        "Translate the current address; copy up to the page boundary.",
      ),
      node(
        "next",
        "Next user page",
        "Translate again; the next page may have different validity.",
      ),
      node(
        "result",
        "Progress or failure",
        "An earlier chunk can already be copied before a later translation fails.",
      ),
    ],
    "kernel/vm.c · copyin · copyout",
  ),
  descriptors: model(
    "A descriptor is an index, not the file itself",
    "An example of a regular-file descriptor: the slot refers to an open object, which refers to an inode.",
    [
      node(
        "slots",
        "Process descriptor slot",
        "ofile[3] holds a reference to an open-file object.",
      ),
      node(
        "open",
        "One struct file",
        "Contains access mode, current offset and an inode reference.",
      ),
      node(
        "inode",
        "File’s inode",
        "The inode identifies the stored file and its block map.",
      ),
    ],
    "kernel/proc.h · ofile; kernel/file.h · struct file; kernel/sysfile.c · sys_dup",
  ),
  names: model(
    "Two names can identify one inode",
    "Directory links and open references have different lifetimes.",
    [
      node(
        "inode",
        "One inode",
        "The inode records nlink; open-file references can outlive a removed name.",
      ),
      node(
        "first",
        "Directory entry: first",
        "A name stores the inode number.",
      ),
      node(
        "alias",
        "Directory entry: alias",
        "Another name stores the same inode number.",
      ),
    ],
    "kernel/fs.c · dirlink · iput; kernel/sysfile.c · sys_link · sys_unlink",
    {
      layout: "branch",
      edgeLabels: ["Name → inode", "Name → same inode"],
      relation: "references",
    },
  ),
  pipe: model(
    "A pipe connects writers to readers",
    "A pipe carries bytes through a kernel buffer; write boundaries are not message boundaries.",
    [
      node(
        "writer",
        "Write end",
        "write copies bytes into the shared pipe buffer.",
      ),
      node(
        "buffer",
        "Kernel pipe",
        "nwrite and nread track progress; a lock protects the buffer.",
      ),
      node(
        "reader",
        "Read end",
        "read copies available bytes into the reader’s user buffer.",
      ),
    ],
    "kernel/pipe.c · pipewrite · piperead",
  ),
  eof: model(
    "Empty does not always mean EOF",
    "A reader’s next action depends on both buffered data and whether any write endpoint remains open.",
    [
      node(
        "check",
        "Reader checks the pipe",
        "Inspect buffer state and writeopen under the pipe lock.",
      ),
      node(
        "wait",
        "Empty, writer still open",
        "Sleep; a writer may produce more bytes.",
      ),
      node(
        "eof",
        "Empty, all writers closed",
        "Return 0: no more bytes can arrive.",
      ),
    ],
    "kernel/pipe.c · piperead · pipeclose",
    {
      layout: "branch",
      edgeLabels: ["Writer remains open", "No writers remain"],
    },
  ),
  states: model(
    "Wakeup makes a process eligible to run",
    "This is one illustrative schedule on one hart. Being runnable is distinct from currently running.",
    [
      node("cpu", "CPU scheduler", "Chooses a RUNNABLE process."),
      node("a", "Process A", "RUNNING"),
      node("b", "Process B", "RUNNABLE"),
    ],
    "kernel/proc.c · scheduler · yield · sleep · wakeup",
    {
      layout: "compare",
      steps: [
        frame(
          "A runs",
          "Only one process executes on this hart. B is eligible but is not running.",
          ["a"],
          { a: "RUNNING", b: "RUNNABLE" },
        ),
        frame(
          "A waits",
          "A publishes its sleep channel and SLEEPING state before switching to the scheduler.",
          ["cpu"],
          { a: "SLEEPING", b: "RUNNABLE" },
        ),
        frame(
          "B runs",
          "The scheduler marks B RUNNING and switches into B’s saved kernel context.",
          ["b"],
          { a: "SLEEPING", b: "RUNNING" },
        ),
        frame(
          "A is woken",
          "wakeup changes A to RUNNABLE. It does not immediately replace B on the CPU.",
          ["a"],
          { a: "RUNNABLE", b: "RUNNING" },
        ),
        frame(
          "A resumes later",
          "After a scheduling handoff, A can become RUNNING again. This example order is not a fairness or timing guarantee.",
          ["a"],
          { a: "RUNNING", b: "RUNNABLE" },
        ),
      ],
    },
  ),
  boot: model(
    "Boot establishes dependencies before running users",
    "This is a shortened dependency path for this one-hart lab.",
    [
      node(
        "entry",
        "Entry and privilege setup",
        "Set a stack; configure machine-mode state; enter supervisor mode.",
      ),
      node(
        "memory",
        "Memory and kernel mappings",
        "Initialize physical allocation; install the kernel page table.",
      ),
      node(
        "services",
        "Kernel services",
        "Prepare traps, interrupt routing, processes and device drivers.",
      ),
      node(
        "user",
        "First runnable process",
        "userinit prepares initcode; scheduler selects it to run.",
      ),
    ],
    "kernel/entry.S · start.c · main.c · proc.c",
  ),
  trampoline: model(
    "The transition code is mapped on both sides",
    "The trampoline uses the same virtual address in the user and kernel page tables.",
    [
      node(
        "user",
        "User page table",
        "Trampoline mapped; trapframe mapped without PTE_U.",
      ),
      node(
        "bridge",
        "Trampoline code",
        "Save or restore registers while changing satp.",
      ),
      node(
        "kernel",
        "Kernel page table",
        "Trampoline mapped at the same virtual address.",
      ),
    ],
    "kernel/memlayout.h · trampoline.S · proc.c · vm.c",
  ),
  contexts: model(
    "Two saved contexts serve different boundaries",
    "struct proc points to a saved user trapframe and contains a separate saved kernel context.",
    [
      node(
        "trapframe",
        "Saved user state",
        "User registers, epc and kernel transition fields. Used for trap entry and return.",
        "trapframe",
      ),
      node(
        "context",
        "Saved kernel call",
        "ra, sp and s0–s11. Used to resume a suspended kernel call.",
        "context",
      ),
    ],
    "kernel/proc.h · struct trapframe · struct context; kernel/swtch.S",
    { layout: "compare" },
  ),
  switch: model(
    "Switch through the CPU scheduler",
    "swtch restores a kernel continuation; it does not directly perform a user trap return.",
    [
      node(
        "process",
        "Process’s kernel thread",
        "yield or sleep changes state and calls sched.",
      ),
      node(
        "scheduler",
        "CPU scheduler context",
        "swtch saves p->context and resumes the CPU’s context.",
      ),
      node(
        "resume",
        "Selected kernel thread",
        "The scheduler later restores a process context; its suspended call resumes.",
      ),
    ],
    "kernel/proc.c · sched · scheduler; kernel/swtch.S",
    {
      steps: [
        frame(
          "Publish a state",
          "The process holds p->lock and changes its state before calling sched.",
          ["process"],
        ),
        frame(
          "Switch to the scheduler",
          "swtch saves the process’s return address, stack pointer and callee-saved registers, then restores the CPU scheduler’s context.",
          ["scheduler"],
        ),
        frame(
          "Resume a selected process",
          "The scheduler marks a selected process RUNNING and restores its context. A trap-return path may eventually return it to user mode.",
          ["resume"],
        ),
      ],
    },
  ),
  handoff: model(
    "Sleep closes the gap with overlapping protection",
    "For a condition lock different from p->lock, sleep acquires the process lock before releasing the condition lock.",
    [
      node(
        "condition",
        "Check the condition",
        "Caller holds its condition lock.",
      ),
      node("overlap", "Acquire p->lock", "Both locks are held briefly."),
      node(
        "sleep",
        "Publish sleep; switch",
        "Release the condition lock; set chan and SLEEPING; call sched.",
      ),
    ],
    "kernel/proc.c · sleep · wakeup",
    {
      steps: [
        frame(
          "Check under the condition lock",
          "The protected condition is still false, so the caller prepares to sleep.",
          ["condition"],
        ),
        frame(
          "Overlap the locks",
          "sleep acquires p->lock while the caller’s condition lock is still held. wakeup must also acquire p->lock.",
          ["overlap"],
        ),
        frame(
          "Publish before wakeup can inspect",
          "sleep releases the condition lock and publishes chan/state while still holding p->lock. The scheduler completes the handoff.",
          ["sleep"],
        ),
        frame(
          "Return with the original protection",
          "After rescheduling, sleep clears chan and reacquires the original condition lock; the caller rechecks its condition.",
          ["condition"],
        ),
      ],
    },
  ),
  timer: model(
    "A machine timer event becomes a kernel tick",
    "This xv6 forwards a machine-mode timer interrupt through a supervisor software interrupt.",
    [
      node(
        "machine",
        "Machine timer interrupt",
        "timervec schedules the next timer and sets SSIP.",
        "Machine",
      ),
      node(
        "supervisor",
        "Supervisor software interrupt",
        "devintr identifies the forwarded event.",
        "Supervisor",
      ),
      node(
        "ticks",
        "clockintr",
        "Update ticks under tickslock; wake timed sleepers.",
        "Kernel",
      ),
    ],
    "kernel/start.c · kernel/kernelvec.S · kernel/trap.c",
  ),
  tickwait: model(
    "Waking up means recheck the tick condition",
    "An ordinary timed wait rechecks elapsed guest ticks after each wakeup. It can resume later than the requested minimum.",
    [
      node(
        "check",
        "Compare elapsed ticks",
        "sys_sleep checks ticks − ticks0 against the requested n.",
      ),
      node(
        "wait",
        "Elapsed < n",
        "Sleep on the ticks channel. A wakeup makes the process runnable; when scheduled, recheck the condition.",
      ),
      node("done", "Elapsed ≥ n", "Leave the loop and return 0 to the caller."),
    ],
    "kernel/sysproc.c · sys_sleep; kernel/trap.c · clockintr",
    { layout: "branch", edgeLabels: ["Keep waiting", "Minimum reached"] },
  ),
  interrupt: model(
    "Service the device and complete the claim",
    "Device acknowledgement and interrupt-controller completion are separate parts of handling an IRQ.",
    [
      node(
        "device",
        "Device requests attention",
        "UART or VirtIO raises an interrupt.",
      ),
      node(
        "claim",
        "PLIC claim",
        "Read the source ID; devintr selects its handler.",
      ),
      node(
        "service",
        "Device handler",
        "Read input or consume completed requests; acknowledge device state.",
      ),
      node(
        "complete",
        "PLIC completion",
        "Return the claimed source ID to the controller.",
      ),
    ],
    "kernel/trap.c · devintr; kernel/plic.c · plic_claim · plic_complete",
  ),
  ring: model(
    "A ring reuses a fixed set of slots",
    "Logical counters keep moving; modulo arithmetic selects a slot in the fixed-size array.",
    [
      node(
        "write",
        "Producer counter",
        "Choose the next slot using counter % capacity.",
      ),
      node(
        "slots",
        "Fixed buffer slots",
        "Slots are reused after the consumer advances.",
      ),
      node(
        "read",
        "Consumer counter",
        "Distinguish empty from full using the counters.",
      ),
    ],
    "kernel/uart.c · uart_tx_w · uart_tx_r; kernel/pipe.c · nwrite · nread",
  ),
  virtio: model(
    "A block request links three descriptors",
    "The WRITE flag describes whether the device may write a RAM buffer.",
    [
      node(
        "header",
        "Request header",
        "Operation type and disk sector; device reads it.",
      ),
      node(
        "data",
        "Data buffer",
        "Disk read: device writes RAM. Disk write: device reads RAM.",
      ),
      node(
        "status",
        "Status byte",
        "Device writes completion status, then publishes a used entry.",
      ),
    ],
    "kernel/virtio_disk.c · virtio_disk_rw · virtio_disk_intr",
  ),
  disk: model(
    "Filesystem blocks have different jobs",
    "Regions are listed in increasing block order; their sizes are schematic, not proportional.",
    [
      node(
        "start",
        "Boot + superblock",
        "The superblock describes region boundaries.",
      ),
      node(
        "log",
        "Journal region",
        "A header and logged block images support recovery.",
      ),
      node(
        "metadata",
        "Inodes + bitmap",
        "Inodes describe files; bitmap bits track block allocation.",
      ),
      node("data", "Data region", "Contains allocated and unallocated blocks."),
    ],
    "kernel/fs.h · struct superblock; mkfs/mkfs.c",
  ),
  cache: model(
    "Identity, references and content locking differ",
    "A cached block can remain valid after release; recycling requires its reference count to reach zero.",
    [
      node(
        "identity",
        "Buffer identity",
        "Device + block number identify one cached block.",
      ),
      node(
        "refs",
        "References and pins",
        "Prevent reuse while a caller or journal still needs the buffer.",
      ),
      node("lock", "Sleeping lock", "Protects access to the buffer contents."),
    ],
    "kernel/bio.c · bget · brelse · bpin · bunpin",
    { layout: "compare" },
  ),
  inode: model(
    "An inode reference can precede loaded metadata",
    "Object lifetime and metadata access use different protection.",
    [
      node(
        "reference",
        "iget / namei",
        "Retain an inode identity; a fresh entry can have valid = 0.",
      ),
      node(
        "locked",
        "ilock",
        "Acquire the sleeping lock; load on-disk metadata if needed.",
      ),
      node(
        "release",
        "iunlockput",
        "Release the metadata lock and drop the retained reference.",
      ),
    ],
    "kernel/fs.c · iget · ilock · iput",
  ),
  indirect: model(
    "Direct pointers and an indirect table",
    "Logical indices 0–11 use inode entries directly. Index 12 starts at entry 0 in the indirect table.",
    [
      node(
        "inode",
        "Inode block map",
        "addrs[0..11] name data blocks; addrs[12] names an indirect table.",
      ),
      node("direct", "Logical block 11", "addrs[11] → data block."),
      node(
        "indirect",
        "Logical block 12",
        "addrs[12] → table[0] → data block.",
      ),
    ],
    "kernel/fs.h · NDIRECT · NINDIRECT; kernel/fs.c · bmap",
    { layout: "branch", edgeLabels: ["Direct path", "Indirect path"] },
  ),
  locks: model(
    "The lock guards a protocol, not just a word",
    "Acquisition and release combine ownership, interrupt nesting and memory ordering.",
    [
      node(
        "enter",
        "Enter",
        "push_off; atomically claim the word; order later accesses.",
      ),
      node(
        "critical",
        "Critical section",
        "This CPU owns the lock while using protected state.",
      ),
      node(
        "leave",
        "Leave",
        "Order prior accesses; clear ownership; unlock; pop_off.",
      ),
    ],
    "kernel/spinlock.c · acquire · release",
  ),
  atomic: model(
    "Each exchange returns the value it replaced",
    "In the starter, both atomic exchanges store 1. The second sees the value left by the first.",
    [
      node("initial", "Initial word", "Stored value = 0."),
      node(
        "first",
        "First exchange",
        "Store 1; return old value 0. The word is now 1.",
      ),
      node(
        "second",
        "Second exchange",
        "Store 1; return old value 1. The word remains 1.",
      ),
    ],
    "kernel/spinlock.c · acquire · __sync_lock_test_and_set",
  ),
  sleeplock: model(
    "A sleeping lock has two kinds of ownership",
    "The internal spinlock protects the ownership record; it is released while the logical sleeping lock remains held.",
    [
      node("internal", "Internal spinlock", "Briefly protects locked and pid."),
      node(
        "owner",
        "Sleeping-lock owner",
        "A process can retain ownership while blocking for I/O.",
      ),
      node(
        "waiter",
        "Contending process",
        "Sleeps, then rechecks locked after wakeup.",
      ),
    ],
    "kernel/sleeplock.c · acquiresleep · releasesleep",
    { layout: "compare" },
  ),
  commit: model(
    "Publish the commit record between data and installation",
    "A nonzero journal header tells recovery that the logged images are committed.",
    [
      node(
        "data",
        "1 · Write log data",
        "Copy final cached block images into the log.",
      ),
      node(
        "header",
        "2 · Write header",
        "Publish n and home-block numbers: the commit point.",
      ),
      node(
        "home",
        "3 · Install home blocks",
        "Copy committed images to their normal locations.",
      ),
      node(
        "clear",
        "4 · Clear header",
        "Mark the completed transaction empty.",
      ),
    ],
    "kernel/log.c · commit · write_log · write_head · install_trans",
    {
      steps: [
        frame(
          "Write ahead",
          "The header has not yet announced this transaction. Log-data bytes alone do not make it committed.",
          ["data"],
        ),
        frame(
          "Commit",
          "After log data is written, write_head publishes a nonzero count. Recovery can now identify the committed images.",
          ["header"],
        ),
        frame(
          "Install",
          "Committed images reach their home blocks. If interrupted here, replay can repeat these copies.",
          ["home"],
        ),
        frame(
          "Finish",
          "Clear the header only after installation, so the next boot sees no transaction to replay.",
          ["clear"],
        ),
      ],
    },
  ),
  recovery: model(
    "Replay the committed image into its home block",
    "The lesson’s prepared example begins with O at home and R in a committed journal entry.",
    [
      node("log", "Journal payload", "R", "Journal data"),
      node("home", "README home block", "O", "Home data"),
      node("header", "Journal header", "n = 1", "Commit marker"),
    ],
    "kernel/log.c · recover_from_log · install_trans",
    {
      steps: [
        frame(
          "Read the committed header",
          "read_head discovers the committed entry naming README’s home block.",
          ["log", "header"],
        ),
        frame(
          "Install its final image",
          "install_trans copies the logged block. README’s home byte is now R.",
          ["home"],
          { home: "R" },
        ),
        frame(
          "Repeat safely",
          "Copying the identical image again leaves R unchanged. This is redo idempotence, not a second increment.",
          ["log", "home"],
          { home: "R" },
        ),
        frame(
          "Clear after installation",
          "Recovery clears n only after installing the image. The home byte remains R.",
          ["header"],
          { home: "R", header: "n = 0" },
        ),
      ],
    },
  ),
  elf: model(
    "Construct a memory image from ELF segments",
    "A loadable segment supplies filesz file bytes and requires memsz bytes of memory.",
    [
      node(
        "file",
        "File-backed prefix",
        "Copy filesz bytes from the segment’s file offset.",
      ),
      node(
        "tail",
        "Zero-filled tail",
        "The remaining memsz − filesz bytes have no stored file payload.",
      ),
      node(
        "stack",
        "User stack and arguments",
        "Allocate a guarded stack area; copy strings and argv pointers.",
      ),
    ],
    "kernel/exec.c · exec · loadseg; kernel/vm.c · uvmalloc",
    { layout: "stack" },
  ),
  argv: model(
    "Rebuild argv in the new address space",
    "The old program’s pointers cannot simply become the new program’s argv.",
    [
      node(
        "old",
        "Old user arguments",
        "Pointers refer to strings in the current image.",
      ),
      node(
        "strings",
        "New stack: copied strings",
        "copyout writes each string through the candidate page table.",
      ),
      node(
        "vector",
        "New stack: argv array",
        "User addresses of the copies, followed by a null pointer.",
      ),
      node(
        "entry",
        "Entry registers",
        "a0 = argc; a1 = argv; sp satisfies the entry alignment.",
      ),
    ],
    "kernel/sysfile.c · sys_exec; kernel/exec.c · exec",
  ),
  dup: model(
    "Dup adds a slot, not another offset",
    "Both descriptor slots in this example refer to the same open-file object.",
    [
      node(
        "file",
        "Shared struct file",
        "One offset advances when either descriptor reads.",
      ),
      node("fd3", "Descriptor 3", "ofile[3] → shared object."),
      node("fd4", "Descriptor 4", "ofile[4] → same shared object."),
    ],
    "kernel/sysfile.c · sys_dup; kernel/file.c · filedup · fileread",
    {
      layout: "branch",
      relation: "references",
      edgeLabels: ["Original reference", "Added by dup"],
    },
  ),
  paths: model(
    "The starting inode changes path resolution",
    "The same final component can identify different files from different starting directories.",
    [
      node(
        "lookup",
        "Resolve item",
        "namex chooses a starting inode, then walks directory entries.",
      ),
      node(
        "root",
        "Absolute: /item",
        "Start at the root inode; look up item there.",
      ),
      node(
        "cwd",
        "Relative: item",
        "Start at the current directory; look up item there.",
      ),
    ],
    "kernel/fs.c · namex · dirlookup; kernel/sysfile.c · sys_chdir",
    { layout: "branch", edgeLabels: ["Leading /", "No leading /"] },
  ),
  kernelmap: model(
    "Kernel mappings include memory and devices",
    "Kernel virtual addresses provide access to RAM and memory-mapped device registers.",
    [
      node(
        "table",
        "Kernel page table",
        "kvminit builds the mappings; kvminithart installs satp.",
      ),
      node(
        "ram",
        "RAM mappings",
        "Kernel text, data and managed RAM use appropriate kernel mappings.",
      ),
      node(
        "mmio",
        "MMIO mappings",
        "UART, VirtIO and PLIC register addresses route access to devices.",
      ),
    ],
    "kernel/vm.c · kvminit · kvminithart; kernel/memlayout.h",
    { layout: "branch", edgeLabels: ["Memory access", "Device access"] },
  ),
  ordering: model(
    "Opposite lock orders can form a wait cycle",
    "Consistently acquiring left before right prevents the circular wait illustrated here.",
    [
      node("a", "Path A", "Holds left; waits for right."),
      node("b", "Path B", "Holds right; waits for left."),
    ],
    "kernel/spinlock.c · acquire; kernel/proc.c · wait",
    { layout: "cycle" },
  ),
  redirect: model(
    "The child changes where stdout leads",
    "Descriptor tables belong to processes. The child arranges its descriptor 1 before exec.",
    [
      node(
        "fork",
        "After fork",
        "Parent and child have separate descriptor tables.",
      ),
      node(
        "parent",
        "Parent stdout",
        "Descriptor 1 still leads to the console.",
      ),
      node(
        "child",
        "Child stdout",
        "close(1); open the file into slot 1; exec echo keeps that reference.",
      ),
    ],
    "user/sh.c · runcmd; kernel/sysfile.c · sys_open; kernel/exec.c",
    { layout: "branch", edgeLabels: ["Parent continues", "Child redirects"] },
  ),
  integration: model(
    "Follow the capstone’s bytes",
    "The parent writes bytes received through a pipe, then execs cat to read the stored file.",
    [
      node("child", "Child producer", "write to the pipe’s write end."),
      node(
        "parent",
        "Parent collector",
        "read the pipe; write the bytes to a file.",
      ),
      node(
        "storage",
        "Filesystem + journal + device",
        "Map blocks, commit the update and complete disk requests.",
      ),
      node(
        "cat",
        "Replacement program: cat",
        "exec loads cat; read copies file bytes back to user space.",
      ),
    ],
    "kernel/pipe.c · file.c · fs.c · log.c · virtio_disk.c · exec.c",
  ),
};

export const lessonConcepts = {};
const place = (concept, ids) =>
  ids
    .split(/\s+/)
    .filter(Boolean)
    .forEach((id) => {
      if (lessonConcepts[id]) throw new Error("Two concept diagrams for " + id);
      lessonConcepts[id] = concept;
    });
place(
  "syscall",
  "a-trapframe-saves-user-registers a-trap-cause-selects-the-path ecall-must-advance-the-return-pc dispatch-chooses-a-kernel-handler arguments-come-from-saved-registers returning-to-user-mode",
);
place("entry", "entering-the-kernel");
place("program", "running-a-program");
place("bytes", "writing-bytes");
place("result", "a-system-call-result");
place("currentproc", "the-current-process");
place("changedanswer", "changing-the-answer");
place("fork", "fork-creates-a-child fork-copies-memory");
place("wait", "waiting-for-a-child a-childs-exit-status");
place(
  "exec",
  "exec-replaces-the-program when-exec-fails failed-exec-preserves-the-old-image",
);
place(
  "pages",
  "growing-user-memory memory-is-mapped-in-pages shrinking-user-memory",
);
place("address", "splitting-a-virtual-address");
place("walk", "walking-three-page-table-levels");
place("guard", "a-guard-page-denies-user-access");
place("userfault", "a-user-fault-is-contained");
place("permissions", "reading-page-permissions");
place("kernelmap", "kernel-mappings-include-devices");
place(
  "copy",
  "the-kernel-checks-user-pointers checked-copies-translate-user-addresses copies-check-each-page",
);
place("descriptors", "opening-and-closing-files reads-advance-the-file-offset");
place("dup", "dup-shares-the-open-file");
place("names", "unlink-keeps-open-files-alive two-names-one-inode");
place(
  "pipe",
  "a-pipe-connects-two-descriptors fork-inherits-pipe-ends pipes-are-byte-streams redirecting-output-through-a-pipe",
);
place("eof", "eof-needs-closed-writers a-pipe-reader-can-block");
place(
  "states",
  "runnable-processes-take-turns waiting-is-a-process-state wakeup-makes-a-process-runnable killing-a-sleeping-process timer-preemption-enters-the-scheduler",
);
place(
  "boot",
  "editing-the-kernel-boot initialization-is-not-execution boot-creates-the-first-user-process",
);
place("trampoline", "trampoline-mappings-cross-address-spaces");
place(
  "contexts",
  "kernel-contexts-save-a-call-boundary a-saved-stack-belongs-to-the-kernel",
);
place(
  "switch",
  "yield-hands-a-process-to-the-scheduler sched-enforces-switching-invariants",
);
place(
  "handoff",
  "sleep-transfers-lock-protection a-wakeup-needs-the-right-condition-and-channel",
);
place("timer", "timer-interrupts-advance-kernel-ticks");
place("tickwait", "sleep-counts-guest-ticks");
place("interrupt", "claiming-and-completing-device-interrupts");
place("ring", "uart-output-passes-through-a-ring");
place(
  "virtio",
  "virtio-descriptors-name-device-buffers disk-completion-precedes-cache-validity",
);
place("disk", "the-superblock-describes-disk-regions");
place(
  "cache",
  "the-buffer-cache-reuses-block-identity references-keep-cache-buffers-resident",
);
place("inode", "inode-references-and-loaded-metadata-differ");
place("paths", "paths-start-at-root-or-the-current-directory");
place(
  "indirect",
  "direct-and-indirect-blocks-map-file-offsets truncation-releases-a-files-block-map",
);
place(
  "locks",
  "locks-protect-shared-kernel-state a-lock-records-its-owner nested-critical-sections-restore-interrupts locks-order-protected-publication",
);
place("atomic", "an-atomic-swap-returns-the-old-value");
place("ordering", "lock-order-prevents-circular-wait");
place("sleeplock", "a-sleeping-lock-does-not-spin-through-io");
place(
  "commit",
  "writes-pass-through-the-log filesystem-operations-reserve-log-space the-log-absorbs-repeated-block-updates the-last-operation-triggers-commit the-header-is-the-commit-point",
);
place("recovery", "boot-replays-a-committed-journal redo-replay-is-idempotent");
place(
  "elf",
  "elf-headers-identify-an-executable segments-separate-file-bytes-from-memory-size the-loader-zeroes-real-bss-memory",
);
place(
  "argv",
  "exec-builds-a-new-argument-vector exec-establishes-the-entry-stack",
);
place("redirect", "the-shell-composes-kernel-interfaces");
place("integration", "capstone-follow-a-byte-from-process-to-disk");

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function renderConcept(id) {
  const key = lessonConcepts[id],
    spec = concepts[key];
  if (!spec) return "";
  const first = spec.steps?.[0];
  const card = (n, i, tag = "li") =>
    "<" +
    tag +
    ' class="concept-node" data-node="' +
    escape(n.key) +
    '"' +
    (first?.active.includes(n.key) ? ' data-active="true"' : "") +
    ">" +
    (spec.edgeLabels && i > 0
      ? '<span class="concept-edge-label">' +
        escape(spec.edgeLabels[i - 1]) +
        "</span>"
      : "") +
    (n.zone ? '<span class="concept-zone">' + escape(n.zone) + "</span>" : "") +
    "<strong>" +
    escape(n.title) +
    '</strong><span class="concept-value">' +
    escape(first?.changes[n.key] ?? n.text) +
    "</span></" +
    tag +
    ">";
  const cards =
    spec.layout === "branch"
      ? '<li class="concept-parent">' +
        card(spec.nodes[0], 0, "div") +
        '<ol class="concept-branches">' +
        spec.nodes
          .slice(1)
          .map((n, i) => card(n, i + 1))
          .join("") +
        "</ol></li>"
      : spec.nodes.map((n, i) => card(n, i)).join("");
  const stepExplanation = first
    ? '<div class="concept-frame" id="concept-frame-' +
      key +
      '" aria-live="polite" aria-atomic="true"><strong class="concept-frame-title">' +
      escape(first.title) +
      '</strong><p class="concept-frame-text">' +
      escape(first.text) +
      "</p></div>"
    : "";
  const controls = first
    ? '<div class="concept-controls" hidden><button type="button" data-concept-prev aria-controls="concept-map-' +
      key +
      '" disabled>← Previous step</button><span class="concept-position">Step 1 of ' +
      spec.steps.length +
      '</span><button type="button" data-concept-next aria-controls="concept-map-' +
      key +
      '">Next step →</button></div>' +
      stepExplanation +
      '<details class="concept-transcript"><summary>Read all ' +
      spec.steps.length +
      " steps</summary><ol>" +
      spec.steps
        .map(
          (s) =>
            "<li><strong>" +
            escape(s.title) +
            ".</strong> " +
            escape(s.text) +
            "</li>",
        )
        .join("") +
      "</ol></details>"
    : "";
  return (
    '<figure class="concept-diagram" data-concept="' +
    key +
    '" aria-labelledby="concept-title-' +
    key +
    '"><figcaption><span class="concept-eyebrow">See the mechanism</span><strong id="concept-title-' +
    key +
    '">' +
    escape(spec.title) +
    '</strong></figcaption><p class="concept-summary">' +
    escape(spec.summary) +
    '</p><ol class="concept-map concept-' +
    spec.layout +
    " concept-count-" +
    spec.nodes.length +
    (spec.relation ? " concept-" + spec.relation : "") +
    '" id="concept-map-' +
    key +
    '">' +
    cards +
    "</ol>" +
    controls +
    '<p class="concept-source"><strong>Source anchors</strong> ' +
    escape(spec.source) +
    '</p><p class="concept-model-note">Conceptual model · illustrative state, separate from your live machine.</p></figure>'
  );
}

export function enhanceConcepts(root) {
  for (const figure of root.querySelectorAll("[data-concept]")) {
    const spec = concepts[figure.dataset.concept];
    if (!spec?.steps || figure.dataset.enhanced) continue;
    figure.dataset.enhanced = "true";
    const prev = figure.querySelector("[data-concept-prev]"),
      next = figure.querySelector("[data-concept-next]");
    let index = 0;
    const show = () => {
      const state = spec.steps[index];
      for (const n of spec.nodes) {
        const el = figure.querySelector('[data-node="' + n.key + '"]');
        el.toggleAttribute("data-current", state.active.includes(n.key));
        el.dataset.active = String(state.active.includes(n.key));
        el.querySelector(".concept-value").textContent =
          state.changes[n.key] ?? n.text;
      }
      figure.querySelector(".concept-frame-title").textContent = state.title;
      figure.querySelector(".concept-frame-text").textContent = state.text;
      figure.querySelector(".concept-position").textContent =
        "Step " + (index + 1) + " of " + spec.steps.length;
      prev.disabled = index === 0;
      next.disabled = index === spec.steps.length - 1;
    };
    prev.addEventListener("click", () => {
      if (index > 0) {
        index--;
        show();
      }
    });
    next.addEventListener("click", () => {
      if (index < spec.steps.length - 1) {
        index++;
        show();
      }
    });
    figure.querySelector(".concept-controls").hidden = false;
    show();
  }
}
