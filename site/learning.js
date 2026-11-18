import { extendedLearning } from "./extended.js?v=learner-flow1";
// Authored teaching scaffolds. Diagrams explain a mechanism; they are not live traces.
export const learning = {
  boot: {
    transferAnswer:
      "The shell stayed alive. It reported the failed launch and then returned to reading commands.",
    goal: "Explain how a shell command becomes a running user program.",
    needs: "Start here. No operating-systems background needed.",
    observe:
      "Find the shell prompt, your command, the program’s output, and the next prompt. Which appeared twice?",
    hint: "The shell prints a prompt before reading each command. echo prints hello between those prompts.",
    takeaway:
      "The shell is a user program. The kernel gives it processes, files and access to devices.",
    transfer:
      "If an unknown command fails but another prompt appears, which program stayed alive?",
    flow: [
      ["You", "type a command"],
      ["Shell", "launches echo"],
      ["Kernel", "provides console I/O"],
    ],
    wrong: [
      "The webpage transports keyboard input and UART output; the prompt itself comes from the guest shell.",
      "",
      "The CPU continues executing kernel and user instructions. A prompt means the shell is ready for input.",
    ],
    steps: [
      "Run the experiment. It boots xv6, waits for the shell, and sends echo hello.",
      "Find hello between the command and the next $ prompt.",
      "In the console command field, try ls and then a name that does not exist, such as banana.",
    ],
  },
  console: {
    transferAnswer:
      "Yes. A regular file is also a kernel-managed resource reached through a file descriptor and the write system call.",
    goal: "Describe why printing requires a system call, and stop inside its kernel handler.",
    needs: "Builds on experiment 01: the shell and a user program.",
    observe:
      "At the stop, find sys_write in the status and the PC in the CPU panel. After Continue, find the next shell prompt.",
    hint: "A function breakpoint stops at entry, before that invocation’s body runs. Other shell output can also reach sys_write; the breakpoint is not restricted to echo.",
    takeaway:
      "A user program requests write; the kernel follows its file descriptor to the output device.",
    transfer:
      "Would writing to a regular file still require entering the kernel? Why?",
    flow: [
      ["echo", "calls write"],
      ["Kernel", "handles sys_write"],
      ["Console", "receives bytes"],
    ],
    wrong: [
      "",
      "An ordinary C call stays in the same privilege mode. A system-call trap crosses into the kernel.",
      "The guest echo binary executes on the emulated CPU. The webpage only displays its UART output.",
    ],
    steps: [
      "Run the experiment. It waits for the shell, arms sys_write, and sends echo hello.",
      "At the stop, open the CPU panel. The PC identifies an actual instruction in the handler.",
      "Press Continue. Compare what the console showed before and after the stop.",
    ],
  },
  fork: {
    transferAnswer:
      "exec keeps the process identity and replaces its program and address space. It does not create another process.",
    goal: "Distinguish the jobs of fork, exec and wait when the shell launches a program.",
    needs: "Builds on experiment 02: stopping at a kernel function.",
    observe:
      "Find the sys_fork stop. Continue, then look for child and a new shell prompt. What does that returning prompt suggest?",
    hint: "The shell is the parent. Its child runs echo; the parent waits and then reads another command.",
    takeaway:
      "fork creates a process, exec replaces its program, and wait collects a child’s exit.",
    transfer:
      "Does exec need to assign a new PID, or can a process change its program while keeping its identity?",
    flow: [
      ["Shell", "fork creates child"],
      ["Child", "exec loads echo"],
      ["Parent", "wait, then prompt"],
    ],
    wrong: [
      "Processes are execution contexts managed by the kernel. Creating a process does not create hardware.",
      "",
      "fork gives the child copied user memory. A later write to a variable does not normally change the parent’s copy.",
    ],
    steps: [
      "Run the experiment to arm sys_fork and send echo child.",
      "At the stop, the shell has entered the handler that will create a child. The live CPU panel is not a process-tree view.",
      "Continue. Find the program output and the shell’s next prompt.",
    ],
  },
  pipe: {
    transferAnswer:
      "While a write end remains open, more bytes could still arrive. The reader cannot reach EOF just because the buffer is temporarily empty.",
    goal: "Explain how a pipe connects descriptors and why closing its write ends matters.",
    needs: "Builds on experiment 03: the shell can launch multiple processes.",
    observe:
      "Compare the line, word and byte counts with your prediction. Remember the newline that echo adds.",
    hint: "hello contains five ASCII bytes; the newline adds a sixth. The command text itself is not sent through the pipe.",
    takeaway:
      "A pipe carries bytes between processes. Closing all write ends lets a reader reach end of file.",
    transfer:
      "If one process accidentally keeps a write end open, why might wc keep waiting?",
    flow: [
      ["echo", "writes bytes"],
      ["Pipe", "buffers bytes"],
      ["wc", "reads until EOF"],
    ],
    wrong: [
      "",
      "A pipe is a kernel-managed byte stream, not a named regular file on the disk.",
      "Each process keeps its own identity. File descriptors provide the connection between them.",
    ],
    steps: [
      "Run echo hello | wc with the guided action.",
      "Read the three counts: lines, words and bytes. Open Expected observation only after making your prediction.",
      "Change the command to echo hello world | wc and predict the new counts before running it.",
    ],
  },
  files: {
    transferAnswer:
      "The shell would arrange descriptor 0 to refer to the opened file before exec. cat can then use its normal read calls.",
    goal: "Explain how redirection changes a descriptor without changing the echo program.",
    needs:
      "Builds on experiment 04: programs read and write through descriptors.",
    observe:
      "After creating note, run cat note. Compare output from the file with output sent directly to the console.",
    hint: "A prompt with no hello is expected after redirection. cat note is the separate command that reads the saved bytes.",
    takeaway:
      "The shell arranges descriptor 1 before exec. The same write interface works for a console, pipe or file.",
    transfer:
      "What would the shell change for input redirection with cat < note?",
    flow: [
      ["Shell", "opens note as fd 1"],
      ["echo", "writes to fd 1"],
      ["File", "stores hello + newline"],
    ],
    wrong: [
      "echo writes to descriptor 1. The kernel’s file layer selects the destination prepared by the shell.",
      "",
      "Redirection changes the process’s open descriptors. It does not rewrite the executable file.",
    ],
    steps: [
      "Run the experiment to create note. A prompt without hello is expected.",
      "Send cat note, then ls from the command field. Find the contents and the file.",
      "Send rm note, then cat note again. Explain the error using the removed directory entry.",
    ],
  },
  step: {
    transferAnswer:
      "Kernel instructions can reuse the CPU registers after the trap. The original user values are saved separately in the process’s trapframe.",
    goal: "Interpret a PC/register snapshot and distinguish instruction stepping from C source stepping.",
    needs:
      "Builds on experiments 02–03: kernel breakpoints and execution control.",
    observe:
      "Record the PC before and after one Step. Did it change by two bytes, four bytes, or jump elsewhere?",
    hint: "RISC-V has compressed two-byte instructions as well as four-byte instructions. Branches and traps can change the next address.",
    takeaway:
      "The inspector shows the current CPU context. One guest instruction step is not one line of C.",
    transfer:
      "Why might a0 inside a kernel function differ from the user program’s original syscall argument?",
    flow: [
      ["Pause", "capture CPU context"],
      ["Step", "advance execution"],
      ["Inspect", "compare PC + registers"],
    ],
    wrong: [
      "A C line can compile to several instructions, and a call can execute many more. This control steps the guest CPU.",
      "",
      "Rendering the page and executing guest instructions are separate operations. The worker advances the emulated CPU.",
    ],
    steps: [
      "Run the experiment to stop at sys_write. The CPU panel opens automatically.",
      "Record PC, sp and ra. Press Step instruction, then compare the values.",
      "Copy the current PC into Read virtual memory and inspect eight bytes. Continue when finished.",
    ],
  },
};
Object.assign(learning, extendedLearning);
