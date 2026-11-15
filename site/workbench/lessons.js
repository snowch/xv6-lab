import { chapter14Lessons } from "./chapter14.js?v=chapter14";
import { chapter13Lessons } from "./chapter13.js?v=chapter13";
import { chapter12Lessons } from "./chapter12.js?v=chapter12";
import { chapter11Lessons } from "./chapter11.js?v=chapter11";
// Each lesson has one idea, a matching xv6 source excerpt and one experiment.
import { chapter10Lessons } from "./chapter10.js?v=chapter10";
import { chapter9Lessons } from "./chapter9.js?v=chapter9";
import { chapter8Lessons } from "./chapter8.js?v=chapter8";
import { chapter7Lessons } from "./chapter7.js?v=chapter7";
import { chapter6Lessons } from "./chapter6.js?v=chapter6";
import { chapter5Lessons } from "./chapter5.js?v=chapter5";
import { chapter4Lessons } from "./chapter4.js?v=chapter4";
import { chapter3Lessons } from "./chapter3.js?v=chapter3";
import { chapter2Lessons } from "./chapter2.js?v=chapter2";
const userProgram = (body) =>
  '#include "kernel/types.h"\n#include "user/user.h"\n\nint\nmain(void)\n{\n' +
  body +
  "\n  exit(0);\n}\n";
const pidProgram = userProgram(
  '  printf("Hello from my xv6 program!\\n");\n  printf("reported pid=%d\\n", getpid());',
);
const kernelStarter = (files) =>
  files["kernel/sysproc.c"].match(
    /uint64\nsys_getpid\(void\)\n\{[\s\S]*?\n\}/,
  )[0] + "\n";
const chapter1Lessons = {
  "running-a-program": {
    title: "A running program is a process",
    goal: "Distinguish a program’s source from a running process.",
    mode: "user",
    observePid: false,
    file: "user/workbench.c",
    offset: 1,
    starter: () => userProgram('  printf("Hello from my xv6 program!\\n");'),
    reading: `<p>A <strong>program</strong> is a set of instructions. A <strong>process</strong> is a running instance of a program, with its own memory and state. The operating system creates and manages processes.</p><p>The source below is a small C program for xv6. Execution starts in <button class="code-link" data-focus="main">main</button>. It prints a message, then calls <button class="code-link" data-focus="exit">exit(0)</button> to end the process. The zero is an exit status conventionally used for success.</p><p>Choose <strong>Build & run</strong>. The browser compiles your C to RISC-V instructions and boots a fresh xv6 machine. The xv6 <strong>shell</strong> is a program that reads commands and starts other programs. Here it starts your program as a process. After it exits, the shell prints its <code>$</code> prompt again.</p>`,
    excerpt: {
      file: "user/user.h",
      anchor: "int exec(",
      before: 0,
      after: 0,
      declaration: "int exit(",
    },
    sourceNote:
      "xv6 declares exit in its user interface. Calling it ends this process; it does not stop the operating system or the shell. The noreturn annotation tells the compiler that this call never comes back.",
    assignment:
      "Change only the greeting string in printf. Build and run again, and find your new message between the shell command and the next $ prompt.",
    takeaway:
      "Changing C source changes the next executable you build. A process is what runs that executable.",
    reflection: "Why does the shell survive after your program calls exit?",
    contextTitle: "Read the user interface",
    contextFiles: ["user/user.h"],
    expected: "Hello from my xv6 program!",
  },
  "writing-bytes": {
    title: "The kernel writes your bytes",
    goal: "See that write sends a specified number of bytes to an output.",
    mode: "user",
    observePid: false,
    file: "user/workbench.c",
    offset: 1,
    starter: () => userProgram('  write(1, "hello\\n", 6);'),
    reading: `<p>The previous program used <code>printf</code> to format a message. Here we call <button class="code-link" data-focus="write">write</button> directly. It asks the kernel to copy bytes to an open output.</p><p>In <code>write(1, "hello\\n", 6)</code>, <code>1</code> names this process’s standard output, the string supplies the bytes, and <code>6</code> is their count. The newline <code>\\n</code> is one byte, so the six bytes are <code>h e l l o</code> and a newline.</p><p>The kernel’s <code>sys_write</code> handler obtains these arguments, then passes them to <code>filewrite</code>. For this run, standard output leads to the xv6 console.</p>`,
    excerpt: {
      file: "kernel/sysfile.c",
      anchor: "sys_write(void)",
      before: 1,
      until: "\n}",
    },
    sourceNote:
      "argfd reads the output argument, argaddr reads the address of the bytes, and argint reads their count. filewrite performs the write.",
    assignment:
      "Change the count from 6 to 3. Build and run. You should see hel, with the next shell prompt immediately after it because you did not write the newline.",
    takeaway:
      "The kernel follows the byte count you pass. A C string’s terminator does not decide how many bytes write sends.",
    reflection:
      "Which byte count would include hello but leave out the newline?",
    contextTitle: "Read the write path",
    contextFiles: ["kernel/sysfile.c", "kernel/file.c", "user/user.h"],
    expected: "hello\n",
  },
  "a-system-call-result": {
    title: "A system call returns a result",
    goal: "Read the process identifier returned by getpid.",
    mode: "user",
    observePid: true,
    file: "user/workbench.c",
    offset: 1,
    starter: () => pidProgram,
    reading: `<p>A process sometimes needs information held by the kernel. A <strong>system call</strong> is a request from a user program to the kernel. <button class="code-link" data-focus="getpid">getpid()</button> is a small example: it returns the identifier of the process making the call.</p><p>The program passes that returned integer to <code>printf</code>. The <code>%d</code> placeholder prints it as a decimal number. The kernel’s process record also stores a PID; the evidence beside the console reads that real record during this run.</p><p>Build the unchanged program. Compare its <code>reported pid</code> with the observed kernel PID. They should agree. You need not know the number in advance.</p>`,
    excerpt: { file: "user/user.h", declaration: "int getpid(" },
    sourceNote:
      "This is the user-facing declaration. It tells C code that getpid takes no arguments and returns an int. The implementation reaches the kernel; it is not an ordinary user-memory lookup.",
    assignment:
      "Change the greeting, build, and run. The text changes, while the unchanged getpid call still reports the process’s kernel PID.",
    takeaway:
      "A system call can return information to its caller as a C function result.",
    reflection:
      "Does changing what printf displays change the PID stored in the kernel?",
    contextTitle: "Read the getpid interface",
    contextFiles: ["user/user.h", "kernel/sysproc.c"],
    expected: "reported pid=",
  },
  "entering-the-kernel": {
    title: "ecall crosses into the kernel",
    goal: "Follow getpid from its C call through the RISC-V ecall instruction.",
    mode: "user",
    observePid: true,
    file: "user/workbench.c",
    offset: 1,
    starter: () => pidProgram,
    reading: `<p>The C declaration does not explain how a user program reaches protected kernel code. xv6 supplies a small assembly <strong>stub</strong>: a short function that arranges a system-call request.</p><p>The real <code>getpid</code> stub below loads <code>SYS_getpid</code>, the call’s number, into <code>a7</code>, a CPU register: a small storage location used here to hold the call number. The RISC-V instruction <code>ecall</code> then causes the CPU to enter xv6’s trap handling code. A <strong>trap</strong> transfers control so the kernel can handle an event; here the event is a user system call.</p><p>xv6’s <code>usertrap</code> recognises this event and calls <code>syscall</code>. That dispatcher uses the number to select <code>sys_getpid</code>, the kernel function that implements this request. After the kernel returns to user mode, the stub’s <code>ret</code> returns to the C caller.</p><p class="call-path">getpid → ecall → usertrap → syscall → sys_getpid</p>`,
    excerpt: { file: "user/usys.S", anchor: "getpid:", after: 3 },
    sourceNote:
      "This assembly comes from the matching xv6 build. You do not need to write assembly here: notice which instruction requests kernel entry, and which register identifies the service.",
    assignment:
      'Call getpid twice by adding a second printf("reported pid=%d\\n", getpid()); line. Build and run. Both requests come from the same process and should return the same PID.',
    takeaway:
      "A C system-call name hides a real transition into the kernel. ecall initiates that transition; it does not itself choose or implement getpid.",
    reflection:
      "What tells the kernel which service the program requested: ecall alone, or the call number in a7?",
    contextTitle: "Follow the actual call path",
    contextFiles: ["user/usys.S", "kernel/trap.c", "kernel/syscall.c"],
    expected: "reported pid=",
  },
  "the-current-process": {
    title: "The kernel finds the current process",
    goal: "Connect myproc() with the process record belonging to the caller.",
    mode: "kernel",
    observePid: true,
    file: "kernel/sysproc.c",
    offset: 20,
    starter: kernelStarter,
    reading: `<p>We have reached <code>sys_getpid</code>, the kernel handler. The editor now contains that actual function from <code>kernel/sysproc.c</code>. Your changes will compile into the kernel; a fixed user program will call it.</p><p><button class="code-link" data-focus="myproc">myproc()</button> returns a pointer to the current process’s <code>struct proc</code> record. The expression <button class="code-link" data-focus="pid">myproc()->pid</button> reads the <code>pid</code> field in that record.</p><p>Inside <code>myproc</code>, <code>c</code> is the current CPU’s record, and <code>c->proc</code> points to the process it is running. The surrounding <code>push_off</code>/<code>pop_off</code> calls keep this CPU lookup stable by temporarily disabling interrupts. We will study that mechanism later; here follow the pointer returned as <code>p</code>.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      anchor: "myproc(void)",
      before: 1,
      until: "\n}",
    },
    sourceNote:
      "The kernel tracks which process is running on each CPU. myproc returns that process record, rather than searching for a process by a printed name or number.",
    assignment:
      'Before the return statement, add printf("kernel sees pid=%d\\n", myproc()->pid);. Build and run. Compare the kernel’s message with the user program’s reported PID.',
    takeaway:
      "The handler runs for a particular calling process. myproc gives kernel code access to that process’s record.",
    reflection:
      "Why must the kernel find the calling process, rather than return one fixed PID for everybody?",
    contextTitle: "Read the process record",
    contextFiles: ["kernel/proc.c", "kernel/proc.h", "kernel/sysproc.c"],
    expected: "reported pid=",
  },
  "changing-the-answer": {
    title: "A returned value is not the stored value",
    goal: "Change the system-call answer while leaving the process record unchanged.",
    mode: "kernel",
    observePid: true,
    file: "kernel/sysproc.c",
    offset: 20,
    starter: kernelStarter,
    reading: `<p>The handler currently returns the value stored in <code>myproc()->pid</code>. A <button class="code-link" data-focus="return">return</button> expression computes an answer for the caller. It does not automatically assign that answer back into the process record.</p><p>Change it to <code>return myproc()->pid + 1000;</code>. When compiled, this kernel will read the PID, add 1000, and return the sum. The user program prints that sum. The evidence panel independently reads the process record at system-call entry and at process exit.</p><p>The dispatcher puts the handler’s returned value in the saved user <code>a0</code> register, as shown below. The kernel keeps the user registers in a saved record called a trapframe while it handles the call. Setting its <code>a0</code> field delivers the answer as the calling C function’s result.</p>`,
    excerpt: {
      file: "kernel/syscall.c",
      anchor: "p->trapframe->a0 = syscalls[num]();",
      after: 0,
    },
    sourceNote:
      "syscalls[num]() invokes the chosen handler. Assigning its result to the saved a0 register delivers it to the user program when execution returns there.",
    assignment:
      "Add + 1000 to the return expression. Build and run. Compare the reported PID with both kernel snapshots. Then restore the starter and repeat to recover the original answer.",
    takeaway:
      "Changing an interface’s answer and changing the underlying state are different operations. return pid + 1000 changes the answer; assigning to pid would change state.",
    reflection:
      "If you changed the stored pid itself, would you still expect the kernel PID at process exit to match the value at syscall entry?",
    contextTitle: "Read the handler and dispatcher",
    contextFiles: [
      "kernel/sysproc.c",
      "kernel/syscall.c",
      "kernel/proc.h",
      "user/workbench.c",
    ],
    expected: "reported pid=",
  },
};
export const chapters = [
  {
    number: 1,
    id: "chapter-one",
    title: "Programs and system calls",
    intro:
      "Start with a running user program. Follow its request into the kernel, then change the answer the kernel returns.",
    lessonIds: Object.keys(chapter1Lessons),
  },
  {
    number: 2,
    id: "chapter-two",
    title: "Processes",
    intro:
      "Create a child, collect its result, and follow one process as it replaces the program it runs.",
    lessonIds: Object.keys(chapter2Lessons),
  },
];
chapters.push({
  number: 3,
  id: "chapter-three",
  title: "Memory",
  intro:
    "Grow and map user memory, then follow the boundary between valid access, checked copies and process faults.",
  lessonIds: Object.keys(chapter3Lessons),
});
chapters.push({
  number: 4,
  id: "chapter-four",
  title: "Files",
  intro:
    "Follow descriptors through open files and inodes, then verify bytes through the filesystem write path.",
  lessonIds: Object.keys(chapter4Lessons),
});
chapters.push({
  number: 5,
  id: "chapter-five",
  title: "Pipes",
  intro:
    "Connect processes with byte streams, close their ends correctly, and build a small redirected pipeline.",
  lessonIds: Object.keys(chapter5Lessons),
});
chapters.push({
  number: 6,
  id: "chapter-six",
  title: "Scheduling",
  intro:
    "Observe timer waits, process states, wakeups, cancellation and the locks protecting shared kernel objects.",
  lessonIds: Object.keys(chapter6Lessons),
});
chapters.push({
  number: 7,
  id: "chapter-seven",
  title: "Boot and kernel organization",
  intro:
    "Go inside the kernel: change its real boot function, then follow stacks, privilege, paging, allocation and the first user process.",
  lessonIds: Object.keys(chapter7Lessons),
});
chapters.push({
  number: 8,
  id: "chapter-eight",
  title: "Address translation",
  intro:
    "Walk real Sv39 entries, read permissions, compare address spaces, and connect guard faults with checked memory copies.",
  lessonIds: Object.keys(chapter8Lessons),
});
chapters.push({
  number: 9,
  id: "chapter-nine",
  title: "Traps and system-call machinery",
  intro:
    "Change the real trap, dispatcher and argument-decoding functions, then follow the return to protected user execution.",
  lessonIds: Object.keys(chapter9Lessons),
});
chapters.push({
  number: 10,
  id: "chapter-ten",
  title: "Interrupts and device drivers",
  intro:
    "Follow timer and device interrupts through controller acknowledgements, real UART registers, console buffering and disk completion.",
  lessonIds: Object.keys(chapter10Lessons),
});
chapters.push({
  number: 11,
  id: "chapter-eleven",
  title: "Context switching",
  intro:
    "Follow saved kernel contexts, stack ownership, scheduler contracts, timer preemption and the sleep lock handoff.",
  lessonIds: Object.keys(chapter11Lessons),
});
chapters.push({
  number: 12,
  id: "chapter-twelve",
  title: "Locks and coordination",
  intro:
    "Follow atomic claims, ownership, interrupt nesting, publication, sleeping locks and the protocols that prevent lost wakeups and deadlock.",
  lessonIds: Object.keys(chapter12Lessons),
});
chapters.push({
  number: 13,
  id: "chapter-thirteen",
  title: "Filesystem structure",
  intro:
    "Follow disk regions, buffer and inode caches, directory traversal, allocation, block mapping and reclamation.",
  lessonIds: Object.keys(chapter13Lessons),
});
chapters.push({
  number: 14,
  id: "chapter-fourteen",
  title: "Logging and recovery",
  intro:
    "Reserve journal capacity, absorb block updates, find the commit point and run actual boot replay.",
  lessonIds: Object.keys(chapter14Lessons),
});
export const plannedChapters = [
  {
    number: 8,
    title: "Address translation — Sv39 walks, mappings and permissions",
  },
  {
    number: 9,
    title: "Traps — saved registers, dispatch and return to user mode",
  },
  {
    number: 10,
    title: "Interrupts and drivers — timers, UART, PLIC and VirtIO",
  },
  {
    number: 11,
    title: "Context switching — kernel stacks and scheduler invariants",
  },
  {
    number: 12,
    title: "Locks and coordination — atomic operations and sleep handoff",
  },
  {
    number: 13,
    title: "Filesystem structure — cache, inodes, paths and allocation",
  },
  {
    number: 14,
    title: "Logging and recovery — commits, replay and interrupted writes",
  },
  { number: 15, title: "Loading programs — ELF, stacks, exec and integration" },
].filter(
  (planned) => !chapters.some((chapter) => chapter.number === planned.number),
);
export const lessons = {
  ...chapter1Lessons,
  ...chapter2Lessons,
  ...chapter3Lessons,
  ...chapter4Lessons,
  ...chapter5Lessons,
  ...chapter6Lessons,
  ...chapter7Lessons,
  ...chapter8Lessons,
  ...chapter9Lessons,
  ...chapter10Lessons,
  ...chapter11Lessons,
  ...chapter12Lessons,
  ...chapter13Lessons,
  ...chapter14Lessons,
};
for (const chapter of chapters)
  for (const id of chapter.lessonIds) lessons[id].chapter = chapter.number;
export const lessonIds = chapters.flatMap((chapter) => chapter.lessonIds);
export const lessonHref = (id) => "lessons/" + id + "/";
export function sourceExcerpt(files, lesson) {
  const spec = lesson.excerpt,
    lines = files[spec.file].split("\n");
  const within = spec.within
    ? lines.findIndex((line) => line.startsWith(spec.within))
    : 0;
  if (within < 0)
    throw new Error("Matching source function was not found: " + spec.within);
  const limit = spec.within
    ? lines.findIndex((line, index) => index > within && line === "}") + 1
    : lines.length;
  if (limit <= within)
    throw new Error("Source function boundary was not found.");
  let first = lines.findIndex(
    (line, index) =>
      index >= within &&
      index < limit &&
      line.includes(spec.declaration || spec.anchor),
  );
  if (first < 0)
    throw new Error("Matching source excerpt was not found: " + spec.file);
  first = Math.max(0, first - (spec.before || 0));
  let end = Math.min(limit, first + (spec.after ?? 0) + 1);
  if (spec.until) {
    end = lines.findIndex((line, index) => index > first && line === "}") + 1;
    if (!end) throw new Error("Source function boundary was not found.");
  }
  return {
    file: spec.file,
    first: first + 1,
    text: lines.slice(first, end).join("\n"),
  };
}
