import { chapter15Lessons } from "./chapter15.js?v=learner-flow15";
import { chapter14Lessons } from "./chapter14.js?v=learner-flow14";
import { chapter13Lessons } from "./chapter13.js?v=learner-flow13";
import { chapter12Lessons } from "./chapter12.js?v=learner-flow12";
import { chapter11Lessons } from "./chapter11.js?v=learner-flow15";
// Each lesson has one idea, a matching xv6 source excerpt and one experiment.
import { chapter10Lessons } from "./chapter10.js?v=learner-flow10";
import { chapter9Lessons } from "./chapter9.js?v=learner-flow9";
import { chapter8Lessons } from "./chapter8.js?v=learner-flow8";
import { chapter7Lessons } from "./chapter7.js?v=learner-flow7";
import { chapter6Lessons } from "./chapter6.js?v=learner-flow6";
import { chapter5Lessons } from "./chapter5.js?v=learner-flow5";
import { chapter4Lessons } from "./chapter4.js?v=learner-flow4";
import { chapter3Lessons } from "./chapter3.js?v=learner-flow3";
import { chapter2Lessons } from "./chapter2.js?v=learner-flow2";
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
    goal: "What starts your program, and which program stays running when it exits?",
    mode: "user",
    observePid: false,
    file: "user/workbench.c",
    offset: 1,
    starter: () => userProgram('  printf("Hello from my xv6 program!\\n");'),
    reading: `<p>A <strong>process</strong> is a running instance of a program, with its own memory and state. The operating system manages processes. Its <strong>kernel</strong> is the part that controls access to memory and devices and decides which process runs.</p><p>The browser compiles C to RISC-V instructions and runs them on a virtual machine that emulates a RISC-V processor. After xv6 boots, its <strong>shell</strong> reads the supplied <code>workbench</code> command and starts your program at <button class="code-link" data-focus="main">main</button>. The program prints a message, then calls <button class="code-link" data-focus="exit">exit(0)</button> to end its process. An exit status of zero usually means success.</p>`,
    excerpt: {
      file: "user/user.h",
      anchor: "int exec(",
      before: 0,
      after: 0,
      declaration: "int exit(",
    },
    sourceNote:
      "This is the kernel interface the program calls. The noreturn annotation tells the compiler that control never returns to the line after exit.",
    starterEvidence: "Find Hello from my xv6 program! between $ workbench and the next $ prompt in the xv6 console.",
    assignment:
      "In printf, replace Hello from my xv6 program! with Hello from my edited program! and keep the newline. Choose Build & run again. Which text changes between $ workbench and the next $ prompt?",
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
    starterEvidence: "Find hello on its own line between $ workbench and the next $ prompt in the xv6 console.",
    assignment:
      "Change the final argument of write from 6 to 3. Choose Build & run again. Compare hello on its own line with hel next to the next $ prompt. Where did the newline go?",
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
    goal: "Does the number returned by getpid match the PID stored in the kernel?",
    mode: "user",
    observePid: true,
    file: "user/workbench.c",
    offset: 1,
    starter: () => pidProgram,
    reading: `<p>A <strong>system call</strong> is a request from a user program to the kernel. <button class="code-link" data-focus="getpid">getpid()</button> returns the process identifier, or <strong>PID</strong>, of the caller.</p><p>The program passes that integer to <code>printf</code>. The <code>%d</code> placeholder prints it as a decimal number. The lab also reads the stored PID from the kernel’s process record while this code runs.</p>`,
    excerpt: { file: "user/user.h", declaration: "int getpid(" },
    sourceNote:
      "This is the user-facing declaration. It tells C code that getpid takes no arguments and returns an int. The implementation reaches the kernel; it is not an ordinary user-memory lookup.",
    starterEvidence:
      "Under Evidence from this run, compare PID reported by the program with Kernel PID at syscall entry. The values should match. You do not need to predict their number.",
    assignment:
      "Replace Hello from my xv6 program! with Hello from my edited program! in the first printf, and keep the newline and getpid call. Choose Build & run again. Find the new greeting in the console. Do those two PID fields still match each other?",
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
    reading: `<p>The C declaration does not explain how a user program reaches protected kernel code. xv6 supplies a small assembly <strong>stub</strong>: a short function that arranges a system-call request.</p><p>The real <code>getpid</code> stub below loads <code>SYS_getpid</code>, the call’s number, into <code>a7</code>, a CPU register: a small storage location used here to hold the call number. The RISC-V instruction <code>ecall</code> then causes the CPU to enter xv6’s trap handling code. A <strong>trap</strong> transfers control so the kernel can handle an event; here the event is a user system call.</p><p>xv6’s <code>usertrap</code> recognises this event and calls <code>syscall</code>. That dispatcher uses the number to select <code>sys_getpid</code>, the kernel function that implements this request. After the kernel returns to user mode, the stub’s <code>ret</code> returns to the C caller.</p>`,
    excerpt: { file: "user/usys.S", anchor: "getpid:", after: 3 },
    sourceNote:
      "This assembly comes from the matching xv6 build. You do not need to write assembly here: notice which instruction requests kernel entry, and which register identifies the service.",
    assignment:
      'Duplicate the line printf("reported pid=%d\\n", getpid()); immediately before exit(0). Choose Build & run again. Compare the two reported pid= lines in the xv6 console. Do the requests come from the same process?',
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
    reading: `<p><code>sys_getpid</code> is the kernel function called for the <code>getpid</code> request. It calls <button class="code-link" data-focus="myproc">myproc()</button>, which returns a pointer to the current process’s record, a <code>struct proc</code>. A <strong>pointer</strong> refers to an object in memory. The <code>-></code> operator accesses a member of a record through a pointer, so <button class="code-link" data-focus="pid">myproc()->pid</button> reads that record’s PID field.</p><p>In the reference excerpt, <code>c</code> points to the current CPU’s record. Its <code>proc</code> field points to the process the CPU is running. Follow the returned <code>p</code> to see what <code>sys_getpid</code> receives.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      anchor: "myproc(void)",
      before: 1,
      until: "\n}",
    },
    sourceNote:
      "The kernel tracks which process is running on each CPU. myproc returns that process record, rather than searching for a process by a printed name or number.",
    assignment:
      'In sys_getpid, add printf("kernel sees pid=%d\\n", myproc()->pid); directly before return myproc()->pid;. Choose Build & run again. Compare kernel sees pid= and reported pid= in the xv6 console. Which record did both values come from?',
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
    reading: `<p>The handler returns the value stored in <code>myproc()->pid</code>. A <button class="code-link" data-focus="return">return</button> expression can compute an answer from that field without writing it back to the process record.</p><p>While the kernel handles the call, it saves the user registers in a record called a <strong>trapframe</strong>. The code that selects the handler writes its answer into the saved <code>a0</code> register. The caller receives that value as the result of <code>getpid()</code>.</p>`,
    excerpt: {
      file: "kernel/syscall.c",
      anchor: "p->trapframe->a0 = syscalls[num]();",
      after: 0,
    },
    sourceNote:
      "syscalls[num]() invokes the chosen handler. Assigning its result to the saved a0 register delivers it to the user program when execution returns there.",
    starterEvidence:
      "Under Evidence from this run, compare Kernel PID at syscall entry, Kernel PID at process exit and PID reported by the program. The three values should match.",
    assignment:
      "Replace return myproc()->pid; with return myproc()->pid + 1000;. Choose Build & run again. Compare PID reported by the program with both Kernel PID fields. Which value is 1000 greater, and which two still match?",
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
chapters.push({
  number: 15,
  id: "chapter-fifteen",
  title: "Loading programs and integration",
  intro:
    "Load real ELF segments, initialize BSS, construct arguments and entry state, handle exec failure and connect the complete system.",
  lessonIds: Object.keys(chapter15Lessons),
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
  ...chapter15Lessons,
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
