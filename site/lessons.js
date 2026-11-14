export const lessons = [
  {
    id: 'boot', title: 'Meet a running kernel', tag: 'Boot · shell',
    intro: 'A real operating system, small enough to explore. Boot xv6, wait for its shell, and ask it to run your first program.',
    concept: 'The emulator supplies a RISC-V CPU, RAM, a timer, a UART console and a virtual disk. xv6 initializes that machine, creates the first user process (init), and starts sh. The $ prompt is printed by a user program—not by this webpage.',
    predict: 'After boot, who reads the command you type: the webpage, the kernel, or the shell?',
    command: 'echo hello', expected: 'hello',
    steps: ['Press Boot xv6. Initialization can take a little while; wait for the $ prompt.', 'Send echo hello. The shell starts the echo program, which writes to the console.', 'Try ls. These names come from xv6’s disk image. This is not your computer’s filesystem.'],
    experiment: 'Run a name that does not exist, such as banana. Compare its error with echo hello. The shell is still alive after a failed command.',
    question: 'What does the $ prompt tell you?', choices: ['The browser has simulated a successful boot.', 'The xv6 shell is running and ready to read a command.', 'The CPU is no longer executing instructions.'], answer: 1,
    feedback: 'init has started sh, and sh has written its prompt. A prompt is user-program output; the kernel still handles interrupts and system calls.',
    source: 'kernel/main.c', next: 'Next, separate the shell’s work from the kernel’s work.'
  },
  {
    id: 'console', title: 'Follow a write into the kernel', tag: 'System calls · console',
    intro: 'Printing a word crosses a protection boundary. Stop inside the real write system-call handler before the word reaches the console.',
    concept: 'echo runs in user mode. It cannot directly use the UART device. Its write system call enters the kernel through a trap; the syscall dispatcher selects sys_write, which obtains arguments from the process’s saved trapframe and writes through a file descriptor.',
    predict: 'If we stop at sys_write, has that particular write already finished?',
    command: 'echo hello', expected: 'hello (after you continue)', breakpoint: 'sys_write',
    steps: ['Boot and wait for the shell prompt, then press Pause.', 'Choose sys_write and press Arm & continue. Send echo hello.', 'When the breakpoint is hit, inspect the PC and next instruction. Press Continue to finish the command.'],
    experiment: 'Arm sys_write again, then run echo a much longer message. One handler entry is not one printed character: a write can carry several bytes. Shell echo and the prompt can also cause this breakpoint to fire.',
    question: 'Why does echo enter the kernel to print?', choices: ['User code must ask the kernel to operate the console file descriptor.', 'Every C function call switches to kernel mode.', 'The webpage implements echo itself.'], answer: 0,
    feedback: 'write is a system call. xv6 validates and accesses the calling process’s data and routes the request through its file layer to the console.',
    source: 'kernel/sysfile.c', next: 'A breakpoint stops guest instruction execution. Continue resumes the same machine state.'
  },
  {
    id: 'fork', title: 'Watch the shell create a process', tag: 'Processes · fork',
    intro: 'The shell survives the programs it launches. Catch the system call that lets it create a child.',
    concept: 'For an ordinary external command, sh forks. The child replaces its program with exec; the parent waits. fork creates a separate process with copied user memory and a saved execution context. Parent and child return from fork with different return values.',
    predict: 'When echo finishes, why is there still a shell to print the next prompt?',
    command: 'echo child', expected: 'child', breakpoint: 'sys_fork',
    steps: ['With the shell ready, pause the machine.', 'Arm sys_fork and continue, then send echo child.', 'The machine stops inside sys_fork before the child has been created by this handler. Continue and observe the command finish and the shell prompt return.'],
    experiment: 'Run echo one, then echo two. Re-arm the breakpoint for each command. Each external command needs a child; the original shell continues to accept commands.',
    question: 'What is exec’s role after fork?', choices: ['Create another CPU.', 'Replace the child’s program and address space.', 'Make parent and child share every variable.'], answer: 1,
    feedback: 'fork creates the child process. exec loads a new program into an existing process. wait lets the parent collect the child’s exit status and resources.',
    source: 'kernel/sysproc.c', next: 'The live inspector shows CPU registers, not a process table yet. Process-table visualization is a later lab increment.'
  },
  {
    id: 'pipe', title: 'Connect two programs', tag: 'Pipes · descriptors',
    intro: 'Send one program’s output into another program’s input, without writing an intermediate file.',
    concept: 'The shell creates a pipe and launches processes with redirected descriptors. echo writes to the pipe; wc reads from it. An empty pipe can make a reader sleep, and writing can wake a reader. Once all write ends are closed and buffered data is consumed, read returns zero: end of file.',
    predict: 'Will wc count the text of the command, or the bytes that echo writes?',
    command: 'echo hello | wc', expected: '1 1 6 (line, word and byte counts; spacing may differ)',
    steps: ['Continue to the shell prompt. Send echo hello | wc.', 'Count the five letters plus the newline: six bytes in this ASCII example.', 'Run echo hello world | wc. Predict all three counts before sending it.'],
    experiment: 'Run echo hello | cat. cat copies from its input descriptor to its output descriptor. Compare that with echo hello > note, which routes output to a file.',
    question: 'Why must unused pipe write ends be closed?', choices: ['So the reader can eventually observe end of file.', 'So the pipe becomes a physical disk file.', 'So both programs use the same PID.'], answer: 0,
    feedback: 'A reader cannot infer that no more bytes will arrive while a write end is still open. Closing descriptors is part of the pipe’s communication protocol.',
    source: 'kernel/pipe.c', next: 'This experiment observes pipe behaviour. Sleep-channel and wakeup visualization will be added in a later increment.'
  },
  {
    id: 'files', title: 'Give output a name', tag: 'Files · redirection',
    intro: 'Create a file on xv6’s virtual disk, read it back, and remove its directory entry.',
    concept: 'The shell implements > by opening a file and arranging for the command’s standard output descriptor (1) to refer to it. echo can keep calling write without knowing whether output goes to a console, pipe, or regular file.',
    predict: 'Will echo hello > note also print hello on the console?',
    command: 'echo hello > note', expected: 'A new prompt; then cat note prints hello.',
    steps: ['Send echo hello > note. The output goes into note.', 'Send cat note, then ls. Find the file and inspect its size.', 'Send rm note and run ls again.'],
    experiment: 'Create note again and run cat < note. Input redirection changes descriptor 0, just as output redirection changes descriptor 1.',
    question: 'Why can the same echo program write to a file or a console?', choices: ['echo contains a special implementation for every device.', 'The kernel’s file-descriptor interface hides the destination behind write.', 'Redirection edits echo’s executable on disk.'], answer: 1,
    feedback: 'The shell prepares descriptors before exec. echo writes to descriptor 1; the kernel follows that descriptor to the appropriate file implementation.',
    source: 'kernel/file.c', next: 'Disk changes last only for this running session. Reset boots the original bundled disk; this version does not save a modified disk to browser storage.'
  },
  {
    id: 'step', title: 'Stop, inspect, take one step', tag: 'Debugging · machine state',
    intro: 'Move from terminal behaviour to the actual instructions executing inside the kernel.',
    concept: 'The PC names the next instruction. Integer registers hold the current CPU context; x0 is always zero, sp is the stack pointer, and ra conventionally holds a return address. In kernel code these are kernel execution registers—not automatically the user syscall arguments saved in a trapframe.',
    predict: 'Does one instruction step mean one C source line has completed?',
    command: 'echo inspect', expected: 'inspect (after continuing)', breakpoint: 'sys_write',
    steps: ['Pause, arm sys_write, continue, and send echo inspect.', 'Record the PC, sp and ra. Press Step instruction and inspect them again.', 'Use Inspect memory with the current PC address to read eight bytes through the active virtual-address translation. Continue to return to the shell.'],
    experiment: 'Step several instructions. Notice that PC changes need not always be four bytes: RISC-V compressed instructions can occupy two bytes, and branches change control flow.',
    question: 'What does Step instruction advance?', choices: ['One line of C, including every function it calls.', 'One guest CPU execution tick, normally one instruction; a trap can redirect execution.', 'One browser animation frame.'], answer: 1,
    feedback: 'This is machine-instruction stepping. Interrupts, traps and variable-length instructions make it different from source-line stepping. Emulated ticks are not hardware performance measurements.',
    source: 'kernel/trap.c', next: 'You have a working foundation: a real kernel, controlled execution, live registers and memory. Page tables, process state and source stepping are next.'
  }
];
