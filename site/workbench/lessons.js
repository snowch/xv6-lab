export const lessons = {
  user: {
    title: "A program asks the kernel for help",
    brief:
      "getpid() crosses into the kernel to read the calling process’s identity. Change the greeting in printf, build, and look for your text in the console.",
    subtitle: "Change a real C program, compile it, and run it inside xv6.",
    file: "user/workbench.c",
    offset: 1,
    focus: "getpid",
    reading: `<h2>Start with the call</h2><p>This program runs in user mode. <button class="code-link" data-focus="printf">printf</button> eventually writes bytes through the kernel. <button class="code-link" data-focus="getpid">getpid()</button> asks the kernel for the identity of the calling process.</p><p>The C call enters a small assembly stub, executes <code>ecall</code>, and reaches the kernel’s syscall dispatcher. The return value comes back to the program.</p><div class="assignment"><h3>Make one change</h3><p>Change the greeting inside <code>printf</code>. Choose <strong>Build & run</strong>, then find your new text in the console.</p><p>Keep the <code>getpid()</code> call for now: the evidence panel compares its return value with the real kernel process record.</p></div>`,
    contextTitle: "Follow the syscall boundary",
    contextFiles: ["user/user.h", "user/usys.S", "kernel/sysproc.c"],
    reflection:
      "Which parts of this experiment ran as your user program, and which required the kernel? Changing a printed string changes the user executable; it does not change the kernel.",
  },
  kernel: {
    title: "What does getpid actually return?",
    brief:
      "myproc()->pid reads an internal process field. Add + 1000 to the returned expression, build, and compare the reported PID with the kernel record.",
    subtitle:
      "Read the syscall handler, change its result, and compare it with kernel state.",
    file: "kernel/sysproc.c",
    offset: 20,
    focus: "myproc",
    reading: `<h2>Read the handler</h2><p><button class="code-link" data-focus="myproc">myproc()</button> returns the current process record. Its <button class="code-link" data-focus="pid">pid</button> member holds the process’s identity.</p><p>The handler returns that field. The syscall dispatcher places the result in the saved user <code>a0</code> register, so the calling program receives it.</p><div class="assignment"><h3>Change the reported value</h3><p>Change the expression to <code>myproc()->pid + 1000</code>. Build and run, then compare the program’s reported PID with the kernel PID captured at syscall entry and exit.</p><p>This changes the returned value. The expression does not assign a new value to the process record.</p></div>`,
    contextTitle: "See the surrounding kernel and probe",
    contextFiles: [
      "kernel/sysproc.c",
      "kernel/proc.h",
      "kernel/syscall.c",
      "user/workbench.c",
    ],
    reflection:
      "What changes if you add 1000 to the returned value? What would be different about assigning to myproc()->pid? Restore the starter whenever you want the original behaviour.",
  },
};
