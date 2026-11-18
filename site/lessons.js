import { extendedLessons } from "./extended.js?v=learner-flow1";
export const lessons = [
  {
    id: "boot",
    title: "Meet a running kernel",
    tag: "Boot · shell",
    intro:
      "A real operating system, small enough to explore. Boot xv6, wait for its shell, and ask it to run your first program.",
    concept:
      "The emulator supplies a RISC-V CPU, RAM, a timer, a UART console and a virtual disk. xv6 initializes that machine, creates the first user process (init), and starts sh. The $ prompt is printed by a user program—not by this webpage.",
    predict:
      "After boot, who reads the command you type: the webpage, the kernel, or the shell?",
    command: "echo hello",
    expected: "hello",
    experiment:
      "Load banana into the xv6 command field, then choose Run. Compare the failed launch with echo hello. Which program still writes a $ prompt after the failure?",
    question: "What does the $ prompt tell you?",
    choices: [
      "The browser has simulated a successful boot.",
      "The xv6 shell is running and ready to read a command.",
      "The CPU is no longer executing instructions.",
    ],
    answer: 1,
    feedback:
      "init has started sh, and sh has written its prompt. A prompt is user-program output; the kernel still handles interrupts and system calls.",
    source: "kernel/main.c",
    next: "Next, separate the shell’s work from the kernel’s work.",
  },
  {
    id: "console",
    title: "Follow a write into the kernel",
    tag: "System calls · console",
    intro:
      "Printing a word crosses a protection boundary. Stop inside the real write system-call handler before the word reaches the console.",
    concept:
      "echo runs in user mode. It cannot directly use the UART device. Its write system call enters the kernel through a trap; the syscall dispatcher selects sys_write, which obtains arguments from the process’s saved trapframe and writes through a file descriptor.",
    predict:
      "If we stop at sys_write, has that particular write already finished?",
    command: "echo hello",
    expected: "hello (after you continue)",
    breakpoint: "sys_write",
    experiment:
      "Choose Run changed command. The lab sends echo a much longer message and pauses at sys_write. Inspect the PC, then choose Continue execution. Compare the text with hello. A breakpoint shows entry to one write handler, which can carry several bytes.",
    question: "Why does echo enter the kernel to print?",
    choices: [
      "User code must ask the kernel to operate the console file descriptor.",
      "Every C function call switches to kernel mode.",
      "The webpage implements echo itself.",
    ],
    answer: 0,
    feedback:
      "write is a system call. xv6 validates and accesses the calling process’s data and routes the request through its file layer to the console.",
    source: "kernel/sysfile.c",
    next: "A breakpoint stops guest instruction execution. Continue resumes the same machine state.",
  },
  {
    id: "fork",
    title: "Watch the shell create a process",
    tag: "Processes · fork",
    intro:
      "The shell survives the programs it launches. Catch the system call that lets it create a child.",
    concept:
      "For an ordinary external command, sh forks. The child replaces its program with exec; the parent waits. fork creates a separate process with copied user memory and a saved execution context. Parent and child return from fork with different return values.",
    predict:
      "When echo finishes, why is there still a shell to print the next prompt?",
    command: "echo child",
    expected: "child",
    breakpoint: "sys_fork",
    experiment:
      "Choose Run changed command. The lab sends echo second child and pauses at sys_fork. Choose Continue execution and look for second child followed by another $ prompt. What still happens even though you changed the message?",
    question: "What is exec’s role after fork?",
    choices: [
      "Create another CPU.",
      "Replace the child’s program and address space.",
      "Make parent and child share every variable.",
    ],
    answer: 1,
    feedback:
      "fork creates the child process. exec loads a new program into an existing process. wait lets the parent collect the child’s exit status and resources.",
    source: "kernel/sysproc.c",
    next: "Use Processes & saved user registers at a kernel stop to compare actual process records.",
  },
  {
    id: "pipe",
    title: "Connect two programs",
    tag: "Pipes · descriptors",
    intro:
      "Send one program’s output into another program’s input, without writing an intermediate file.",
    concept:
      "The shell creates a pipe and launches processes with redirected descriptors. echo writes to the pipe; wc reads from it. An empty pipe can make a reader sleep, and writing can wake a reader. Once all write ends are closed and buffered data is consumed, read returns zero: end of file.",
    predict:
      "Will wc count the text of the command, or the bytes that echo writes?",
    command: "echo hello | wc",
    expected: "1 1 6 (line, word and byte counts; spacing may differ)",
    experiment:
      "Load echo hello world | wc, then choose Run in the xv6 command field. Compare the three numbers, lines, words and bytes, with 1 1 6. Which counts change when echo adds a second word?",
    question: "Why must unused pipe write ends be closed?",
    choices: [
      "So the reader can eventually observe end of file.",
      "So the pipe becomes a physical disk file.",
      "So both programs use the same PID.",
    ],
    answer: 0,
    feedback:
      "A reader cannot infer that no more bytes will arrive while a write end is still open. Closing descriptors is part of the pipe’s communication protocol.",
    source: "kernel/pipe.c",
    next: "Continue to the blocking and sleep/wakeup lessons to connect pipe behaviour with process state.",
  },
  {
    id: "files",
    title: "Give output a name",
    tag: "Files · redirection",
    intro:
      "Create a file on xv6’s virtual disk, read it back, and remove its directory entry.",
    concept:
      "The shell implements > by opening a file and arranging for the command’s standard output descriptor (1) to refer to it. echo can keep calling write without knowing whether output goes to a console, pipe, or regular file.",
    predict: "Will echo hello > note also print hello on the console?",
    command: "echo hello > note",
    expected: "A new prompt; then cat note prints hello.",
    experiment:
      "After the first command created note, load cat < note and choose Run in the xv6 command field. Compare the console output with echo hello > note. Why does only this command display hello?",
    question: "Why can the same echo program write to a file or a console?",
    choices: [
      "echo contains a special implementation for every device.",
      "The kernel’s file-descriptor interface hides the destination behind write.",
      "Redirection edits echo’s executable on disk.",
    ],
    answer: 1,
    feedback:
      "The shell prepares descriptors before exec. echo writes to descriptor 1; the kernel follows that descriptor to the appropriate file implementation.",
    source: "kernel/file.c",
    next: "Disk changes last only for this running session. Reset boots the original bundled disk; this version does not save a modified disk to browser storage.",
  },
  {
    id: "step",
    title: "Stop, inspect, take one step",
    tag: "Debugging · machine state",
    intro:
      "Move from terminal behaviour to the actual instructions executing inside the kernel.",
    concept:
      "The PC names the next instruction. Integer registers hold the current CPU context; x0 is always zero, sp is the stack pointer, and ra conventionally holds a return address. In kernel code these are kernel execution registers—not automatically the user syscall arguments saved in a trapframe.",
    predict: "Does one instruction step mean one C source line has completed?",
    command: "echo inspect",
    expected: "inspect (after continuing)",
    breakpoint: "sys_write",
    experiment:
      "Choose Run changed command to pause at sys_write again. Choose Step one instruction twice and compare the PC addresses. Does each change have to be four bytes? Choose Continue execution to finish.",
    question: "What does Step instruction advance?",
    choices: [
      "One line of C, including every function it calls.",
      "One guest CPU execution tick, normally one instruction; a trap can redirect execution.",
      "One browser animation frame.",
    ],
    answer: 1,
    feedback:
      "This is machine-instruction stepping. Interrupts, traps and variable-length instructions make it different from source-line stepping. Emulated ticks are not hardware performance measurements.",
    source: "kernel/trap.c",
    next: "Continue through the process, virtual-memory, scheduling and storage lessons. Source excerpts track the current instruction; stepping remains at instruction level.",
  },
];
lessons.push(...extendedLessons);
