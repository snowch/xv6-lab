// Chapter 2: a process can create a child or replace the program it runs.
const program = (body, exitStatus = 0) =>
  '#include "kernel/types.h"\n#include "user/user.h"\n\nint\nmain(void)\n{\n' +
  body +
  `\n  exit(${exitStatus});\n}\n`;
const forkCheck =
  '  int child = fork();\n  if (child < 0) {\n    printf("fork failed\\n");\n    exit(1);\n  }\n';
const lesson = (details) => ({
  mode: "user",
  observePid: false,
  file: "user/workbench.c",
  offset: 1,
  editorHeight: 600,
  ...details,
});
export const chapter2Lessons = {
  "fork-creates-a-child": lesson({
    title: "fork creates a child process",
    goal: "Follow one fork call as two processes continue from it.",
    starter: () =>
      program(
        forkCheck +
          '  if (child == 0) {\n    printf("child: fork returned %d\\n", child);\n    exit(0);\n  }\n  int collected = wait(0);\n  printf("parent: fork returned %d; collected %d\\n", child, collected);',
      ),
    reading: `<p>In Chapter 1, a process asked the kernel for information. Now it asks the kernel to create another process. <button class="code-link" data-focus="fork">fork()</button> creates a <strong>child</strong> of the calling process, which becomes the <strong>parent</strong>.</p><p>On success, both continue just after the same call. The child receives <code>0</code>; the parent receives the child’s PID. That lets <code>if (child == 0)</code> choose the child’s work. A negative result means creation failed, so the example handles that before either success branch.</p><p>The parent uses <code>wait(0)</code> to wait for its child to exit before printing the final line. wait returns the collected child’s PID. The zero means it does not request an exit status. We will examine wait on the next page; here it keeps the example’s output together.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "fork(void)",
      anchor: "np->trapframe->a0 = 0;",
      after: 0,
    },
    sourceNote:
      "fork copies the saved user registers, then sets the child’s saved a0 register to zero. The parent takes a different return path: fork returns the newly allocated child PID. Both returns belong to this one fork call.",
    assignment:
      "Change only the child’s message and build again. Find its zero return value and the parent’s positive return value. The parent’s fork result and collected PID should match.",
    takeaway:
      "fork creates a second process. Its return value tells each process which side of the creation it is on.",
    reflection:
      "Why would using the same positive return value in both processes make it harder to choose their work?",
    contextTitle: "Read how xv6 creates a process",
    contextFiles: ["kernel/proc.c", "kernel/sysproc.c", "kernel/proc.h"],
    expected: "child: fork returned 0",
  }),
  "waiting-for-a-child": lesson({
    title: "wait collects an exited child",
    goal: "Use wait to collect a child that has finished.",
    starter: () =>
      program(
        forkCheck +
          '  if (child == 0) {\n    printf("child: finishing\\n");\n    exit(0);\n  }\n  int collected = wait(0);\n  printf("parent: collected %d\\n", collected);',
      ),
    reading: `<p>A child can finish before its parent asks about it. xv6 keeps a small record of the exited child until its parent calls <button class="code-link" data-focus="wait">wait</button>. This exited-but-uncollected state is called <strong>ZOMBIE</strong>. The child’s user program has finished.</p><p><code>wait(0)</code> returns an exited child’s PID and releases the resources retained for it. If a child is still running, wait puts the parent to sleep until a child exits. If the parent has no children, wait returns <code>-1</code>.</p><p>The parent’s final message is after wait. You can rely on the child having exited before that message. With several children, wait can collect any exited child; this example creates exactly one.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "wait(uint64 addr)",
      anchor: "freeproc(np);",
      after: 3,
    },
    sourceNote:
      "This excerpt is inside wait’s branch for an exited child. freeproc releases its retained resources; the saved PID is then returned to the parent. The surrounding source contains the child scan and sleep path.",
    assignment:
      'After the parent’s collected message, add printf("second wait=%d\\n", wait(0));. Build and run. With its only child already collected, the second wait should return -1.',
    takeaway:
      "wait both waits for an exited child when necessary and collects its retained process record.",
    reflection:
      "If the child exits before its parent reaches wait, why must xv6 keep the child’s record?",
    contextTitle: "Read exit, wait and process cleanup",
    contextFiles: ["kernel/proc.c", "kernel/proc.h", "kernel/sysproc.c"],
    expected: "parent: collected ",
  }),
  "a-childs-exit-status": lesson({
    title: "A child returns an exit status",
    goal: "Distinguish wait’s returned PID from the child’s exit status.",
    starter: () =>
      program(
        forkCheck +
          '  if (child == 0) {\n    exit(7);\n  }\n  int status = -1;\n  int collected = wait(&status);\n  printf("parent: child %d exited with status %d\\n", collected, status);',
      ),
    reading: `<p>The argument to <button class="code-link" data-focus="exit(7)">exit(7)</button> is the child’s <strong>exit status</strong>: an integer it leaves for its parent. Zero conventionally means success; a program can use other values to describe another outcome.</p><p>The parent supplies <code>&status</code> to <code>wait</code>. In C, this is the address of its local status variable. xv6 copies the child’s exit status there before collecting the child. Passing <code>0</code>, as on the previous page, skips that copy.</p><p>There are two results to keep apart: the value <code>wait</code> returns is the child’s PID; the value it writes into <code>status</code> is the integer the child passed to exit.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "exit(int status)",
      anchor: "p->xstate = status;",
      after: 1,
    },
    sourceNote:
      "exit saves the supplied status in xstate and marks the process ZOMBIE. Later, wait copies xstate into the parent’s requested address before freeing the child’s record.",
    assignment:
      "Change the child’s exit argument from 7 to 23. Build and run. The printed status should change to 23; the child PID still identifies a process, rather than an outcome.",
    takeaway:
      "A parent gets the child’s identity as wait’s return value and its exit status through a separate memory argument.",
    reflection:
      "If wait returns -1 because there is no child, should you treat the status variable as a newly received exit status?",
    contextTitle: "Follow the status from exit to wait",
    contextFiles: ["kernel/proc.c", "kernel/sysproc.c", "kernel/proc.h"],
    expected: "exited with status 7",
  }),
  "fork-copies-memory": lesson({
    title: "Parent and child have separate memory",
    goal: "Observe a child change its own copy of an ordinary variable.",
    starter: () =>
      program(
        "  int value = 7;\n" +
          forkCheck +
          '  if (child == 0) {\n    value = 99;\n    printf("child value=%d\\n", value);\n    exit(0);\n  }\n  wait(0);\n  printf("parent value=%d\\n", value);',
      ),
    reading: `<p>The parent and child start with the same ordinary variable values. That does not mean they share the same user memory. In this xv6 version, <button class="code-link" data-focus="fork">fork</button> copies the parent’s user memory into the child’s address space.</p><p>The child changes <button class="code-link" data-focus="value = 99">value</button> to <code>99</code>, then exits. The parent waits for that to happen and reads its own value, which remains <code>7</code>. Waiting establishes that the child has finished; it does not copy the child’s variables back.</p><p>The kernel passes different page tables to <code>uvmcopy</code> below. A page table describes which memory belongs at each address in a process. The memory chapter will examine that mapping; here observe its consequence for one C variable.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "fork(void)",
      anchor: "// Copy user memory from parent to child.",
      after: 6,
    },
    sourceNote:
      "uvmcopy copies user memory from the parent’s page table to the child’s page table. This lesson concerns ordinary user memory; inherited file descriptors have different sharing rules, which the file lessons will examine.",
    assignment:
      "Change the child’s assignment from 99 to 123. Build and run. The child should print 123 and the parent should still print 7.",
    takeaway:
      "After fork, assigning to an ordinary variable in the child changes the child’s copy of user memory.",
    reflection:
      "Does waiting longer cause the child’s assignment to appear in the parent, or are these different memory copies?",
    contextTitle: "Read the user-memory copy",
    contextFiles: ["kernel/proc.c", "kernel/vm.c", "kernel/proc.h"],
    expected: "parent value=7",
  }),
  "exec-replaces-the-program": lesson({
    title: "exec replaces the program",
    goal: "Run another executable while keeping the same process identity.",
    observePid: true,
    editorHeight: 480,
    starter: () =>
      program(
        '  printf("reported pid=%d\\n", getpid());\n  char *args[] = {"echo", "The new program is echo", 0};\n  exec("echo", args);\n  printf("exec returned to the old program\\n");',
        1,
      ),
    reading: `<p><code>fork</code> created a process. <button class="code-link" data-focus="exec">exec</button> loads a program into the process that calls it. On success, the old program’s memory and starting point are replaced. The process keeps its PID.</p><p>The example first prints its PID. It then requests xv6’s existing <code>echo</code> executable. <code>args</code> is a list of argument strings ending with a null pointer: echo’s name, its message, then <code>0</code>. echo prints the message and exits.</p><p>A successful exec does not return to the following printf. Compare the PID printed before exec with the kernel PID captured at process exit, after echo has run. The same process ran both programs.</p>`,
    excerpt: {
      file: "kernel/exec.c",
      anchor: "// Commit to the user image.",
      after: 7,
    },
    sourceNote:
      "The kernel installs a new page table and sets the saved user program counter and stack pointer for the replacement executable. It frees the old memory image. The current process record is retained.",
    assignment:
      "Change only the message in args and build again. Find the new echo output, confirm that the old program’s final printf is absent, and compare the entry and exit PIDs.",
    takeaway:
      "A process is not tied to one program forever. exec replaces its program; it does not create a second process.",
    reflection:
      "Why does the shell commonly fork first and then have the child exec the requested program?",
    contextTitle: "Read image replacement and echo",
    contextFiles: ["kernel/exec.c", "user/echo.c", "user/sh.c"],
    expected: "The new program is echo",
  }),
  "when-exec-fails": lesson({
    title: "A failed exec leaves the caller running",
    goal: "Handle exec returning -1 when it cannot load the requested program.",
    observePid: true,
    editorHeight: 480,
    starter: () =>
      program(
        '  int before = getpid();\n  printf("reported pid=%d\\n", before);\n  char *args[] = {"echo", "The replacement ran", 0};\n  int result = exec("missing", args);\n  printf("exec result=%d\\n", result);\n  printf("caller pid before=%d after=%d\\n", before, getpid());',
        1,
      ),
    reading: `<p>The file named <code>missing</code> is not present in this fresh xv6 filesystem. <button class="code-link" data-focus='exec("missing"'>exec</button> cannot load it, so it returns <code>-1</code>. The caller continues with its existing program and memory.</p><p>That is why the printf after exec is useful error handling: it is reached when exec fails. On success, the replacement program starts instead. The line after a successful exec is not a place to put work that the replacement should perform.</p><p>Build the unchanged example. You should see <code>exec result=-1</code> and the same caller PID before and after the failed request. The local variable <code>before</code> is still available because the old program was not replaced.</p>`,
    excerpt: {
      file: "kernel/exec.c",
      within: "exec(char *path, char **argv)",
      anchor: "if((ip = namei(path)) == 0){",
      after: 3,
    },
    sourceNote:
      "namei looks up the requested path. When there is no matching file, exec ends the filesystem operation and returns -1 before committing a replacement image. Other load errors also use a failure path that discards the incomplete new image.",
    assignment:
      'Change the path argument in exec from "missing" to "echo", leaving args intact. Build and run. The replacement message should appear, and the old exec-result and caller-after messages should disappear.',
    takeaway:
      "Code following exec handles failure. Successful replacement continues at the new program’s entry point.",
    reflection:
      "If a shell’s child cannot exec a command, why should that child report an error and exit rather than continue as another shell?",
    contextTitle: "Read exec failure and shell error handling",
    contextFiles: ["kernel/exec.c", "user/sh.c", "user/user.h"],
    expected: "exec result=-1",
  }),
};
