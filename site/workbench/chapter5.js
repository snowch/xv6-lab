import { program, lesson, forkCheck } from "./lesson-helpers.js?v=chapter3";
export const pipeCheck =
  '  int p[2];\n  if (pipe(p) < 0) { printf("pipe failed\\n"); exit(1); }\n';
const pipeLesson = (details) => lesson({ editorHeight: 640, ...details });
export const chapter5Lessons = {
  "a-pipe-connects-two-descriptors": pipeLesson({
    title: "A pipe connects two descriptors",
    goal: "Send bytes from a pipe’s write end to its read end.",
    starter: () =>
      program(
        pipeCheck +
          '  write(p[1], "cat", 3);\n  char buf[4] = {0};\n  int n = read(p[0], buf, 3);\n  printf("read=%d data=%s\\n", n, buf);\n  close(p[0]);\n  close(p[1]);',
      ),
    reading: `<p><button class="code-link" data-focus="pipe(p)">pipe(p)</button> creates a kernel byte buffer and returns two file descriptors in the array <code>p</code>. <code>p[0]</code> reads from it; <code>p[1]</code> writes to it.</p><p>The example writes three bytes and reads them back through the other end. There is no pathname to open: the pipe is connected through the descriptors the kernel returned.</p><p>The two open-file objects have different permissions but point to the same pipe object. The existing read/write system calls dispatch to pipe operations when they encounter this file type.</p>`,
    excerpt: {
      file: "kernel/pipe.c",
      within: "pipealloc(struct file **f0",
      anchor: "(*f0)->type = FD_PIPE;",
      after: 7,
    },
    sourceNote:
      "The read object is readable, the write object is writable, and both store the same pi pointer. The descriptor array gives the caller handles to those objects.",
    assignment:
      "Change cat to dog, keeping the count at 3. Build and run. The pipe should deliver the new three bytes.",
    takeaway:
      "A pipe is a kernel byte stream accessed through a read descriptor and a write descriptor.",
    reflection:
      "Why can a pipe use the same read/write interface as a regular file even though its storage and lifetime differ?",
    contextTitle: "Read pipe allocation and dispatch",
    contextFiles: ["kernel/pipe.c", "kernel/sysfile.c", "kernel/file.c"],
    expected: "read=3 data=cat",
  }),
  "eof-needs-closed-writers": pipeLesson({
    title: "EOF needs an empty pipe and closed writers",
    goal: "Distinguish buffered bytes from end of file.",
    starter: () =>
      program(
        pipeCheck +
          '  write(p[1], "ok", 2);\n  close(p[1]);\n  char buf[9] = {0};\n  int first = read(p[0], buf, 8);\n  printf("first=%d data=%s\\n", first, buf);\n  int next = read(p[0], buf, 8);\n  printf("next=%d\\n", next);\n  close(p[0]);',
      ),
    reading: `<p>A read returning <code>0</code> indicates <strong>end of file</strong>, or EOF. A pipe reaches this condition when its buffer is empty and no write-end references remain open.</p><p>Closing the writer does not throw away buffered bytes. The first read still obtains <code>ok</code>. The next read returns zero because those bytes are gone and no writer can supply more.</p><p>EOF is a state, not a special character inserted into the data. An empty pipe with an open writer instead makes a reader wait.</p>`,
    excerpt: {
      file: "kernel/pipe.c",
      within: "piperead(struct pipe *pi",
      anchor: "while(pi->nread == pi->nwrite && pi->writeopen)",
      after: 10,
    },
    sourceNote:
      "piperead waits while the pipe is empty and a writer remains. After writers close, its copy loop returns zero if there are no buffered bytes left.",
    assignment:
      "Change only the first read’s count from 8 to 1. Build and run. The next read should return 1, because the second byte was still buffered despite the closed writer.",
    takeaway:
      "A closed writer allows EOF after the reader drains the remaining bytes.",
    reflection:
      "Why is a zero-byte write different from closing the write descriptor?",
    contextTitle: "Read EOF and close handling",
    contextFiles: ["kernel/pipe.c", "kernel/file.c"],
    expected: "first=2 data=ok\nnext=0",
  }),
  "fork-inherits-pipe-ends": pipeLesson({
    title: "fork inherits the pipe ends",
    goal: "Connect parent and child while closing their unused ends.",
    editorHeight: 760,
    starter: () =>
      program(
        pipeCheck +
          forkCheck +
          '  if (child == 0) {\n    close(p[1]);\n    char buf[6] = {0}, extra;\n    int n = read(p[0], buf, 5);\n    int end = read(p[0], &extra, 1);\n    printf("child data=%s bytes=%d eof=%d\\n", buf, n, end);\n    close(p[0]);\n    exit(0);\n  }\n  close(p[0]);\n  write(p[1], "hello", 5);\n  close(p[1]);\n  wait(0);\n  printf("parent collected child\\n");',
      ),
    reading: `<p>A pipe created before fork is accessible to both processes. Fork copies descriptor references, so their descriptors connect to the same kernel pipe rather than independent byte buffers.</p><p>The child reads and closes its unused write end. The parent writes and closes its unused read end. After writing, the parent closes its writer and waits for the child.</p><p>The child reads the data and then checks EOF. Its own unused writer must be closed too: retaining any writer reference would keep that second read waiting. Every process must close the ends it does not need.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "fork(void)",
      anchor: "for(i = 0; i < NOFILE; i++)",
      after: 2,
    },
    sourceNote:
      "Fork duplicates references to each open-file object with filedup. A pipe’s writer becomes closed only when its last open-file reference is released, not merely when one process closes a descriptor.",
    assignment:
      "Change the parent’s five-byte message from hello to world. Build and run. The child should receive world and still observe EOF after the writer closes.",
    takeaway:
      "Inherited descriptors connect processes; closing unused references is part of correct pipe communication.",
    reflection:
      "Which unused descriptor in the child would prevent EOF if it were left open?",
    contextTitle: "Follow inherited references and closes",
    contextFiles: ["kernel/proc.c", "kernel/file.c", "kernel/pipe.c"],
    expected: "child data=hello bytes=5 eof=0",
  }),
  "pipes-are-byte-streams": pipeLesson({
    title: "Pipes are byte streams",
    goal: "Observe that read boundaries need not match write boundaries.",
    starter: () =>
      program(
        pipeCheck +
          '  write(p[1], "AB", 2);\n  write(p[1], "CD", 2);\n  close(p[1]);\n  char buf[5] = {0};\n  int n = read(p[0], buf, 4);\n  printf("read=%d data=%s\\n", n, buf);\n  close(p[0]);',
      ),
    reading: `<p>Two writes do not create two stored messages in a pipe. They append bytes to a stream. A read asks for up to a byte count, not for one original write.</p><p>The example writes <code>AB</code>, then <code>CD</code>. One read can return all four bytes as <code>ABCD</code>. A smaller read would consume only part of the available stream.</p><p>In concurrent programs, a read can return fewer bytes than requested. Programs that need a complete message must choose a framing rule, such as a fixed length or a delimiter, and loop over reads.</p>`,
    excerpt: {
      file: "kernel/pipe.c",
      within: "piperead(struct pipe *pi",
      anchor: "for(i = 0; i < n; i++)",
      after: 6,
    },
    sourceNote:
      "The copy loop consumes available bytes until the requested count or current buffer content is exhausted. The pipe records byte counters, not the boundaries between the caller’s write operations.",
    assignment:
      "Change the read count from 4 to 3. Build and run. It should return ABC, leaving D for a later read rather than preserving the two original writes.",
    takeaway:
      "Applications define message boundaries on top of the pipe’s byte stream.",
    reflection:
      "Why must a program loop if it requires exactly eight bytes from a pipe?",
    contextTitle: "Read the byte-buffer implementation",
    contextFiles: ["kernel/pipe.c"],
    expected: "read=4 data=ABCD",
  }),
  "a-pipe-reader-can-block": pipeLesson({
    title: "A pipe reader can block",
    goal: "Follow a reader waiting for a producer to supply a byte.",
    editorHeight: 720,
    starter: () =>
      program(
        pipeCheck +
          forkCheck +
          '  if (child == 0) {\n    close(p[1]);\n    char ch = 0;\n    printf("reader: waiting\\n");\n    read(p[0], &ch, 1);\n    printf("reader: byte=%c\\n", ch);\n    close(p[0]);\n    exit(0);\n  }\n  close(p[0]);\n  sleep(3);\n  write(p[1], "K", 1);\n  close(p[1]);\n  wait(0);',
      ),
    reading: `<p>An empty pipe with an open writer is not at EOF. Its reader can <strong>block</strong>: the kernel pauses that process until the condition can change, letting other processes run.</p><p>The parent’s supplied <code>sleep(3)</code> asks the kernel to wait for timer ticks before writing. These are guest timer events, not browser milliseconds. It gives the child an opportunity to reach an empty-pipe read; the scheduling chapter will explain sleep in more detail.</p><p>piperead sleeps on a channel associated with the read counter. A writer wakes readers after supplying data. The loop checks the condition again after waking; waking is a reason to retry, not a guarantee that a byte belongs to this reader.</p>`,
    excerpt: {
      file: "kernel/pipe.c",
      within: "piperead(struct pipe *pi",
      anchor: "sleep(&pi->nread, &pi->lock);",
      before: 5,
      after: 1,
    },
    sourceNote:
      "sleep releases the pipe lock while the reader waits and reacquires it when the reader resumes. Otherwise the producer could not acquire that lock to supply data.",
    assignment:
      "Change the producer’s byte from K to Z. Build and run. The waiting reader should resume with Z.",
    takeaway:
      "A blocked read waits for a condition while the CPU can run other processes.",
    reflection:
      "Why would keeping the pipe lock held while waiting prevent the producer from helping?",
    contextTitle: "Read blocking and wakeup",
    contextFiles: ["kernel/pipe.c", "kernel/proc.c"],
    expected: "reader: byte=K",
  }),
  "redirecting-output-through-a-pipe": pipeLesson({
    title: "Redirection changes the destination",
    goal: "Run echo with its standard output connected to a pipe.",
    editorHeight: 800,
    starter: () =>
      program(
        pipeCheck +
          forkCheck +
          '  if (child == 0) {\n    close(1);\n    if (dup(p[1]) != 1) exit(1);\n    close(p[0]);\n    close(p[1]);\n    char *args[] = {"echo", "from echo", 0};\n    exec("echo", args);\n    fprintf(2, "exec failed\\n");\n    exit(1);\n  }\n  close(p[1]);\n  char buf[64] = {0};\n  int total = 0, n;\n  while (total < 63 && (n = read(p[0], buf+total, 63-total)) > 0)\n    total += n;\n  close(p[0]);\n  wait(0);\n  printf("pipeline=%s", buf);',
      ),
    reading: `<p>A program like echo writes to descriptor <code>1</code>. A shell can change what that descriptor points to before starting the program, without changing echo’s code.</p><p>The child closes its console descriptor 1, then duplicates the pipe writer. Because 1 is the lowest free slot, dup places the writer there. Closing the original pipe descriptors leaves standard output as the child’s writer reference.</p><p>exec preserves those descriptor connections. Echo’s bytes enter the pipe; the parent loops until EOF to collect the short message. This combines fork, close, dup and exec from the preceding lessons.</p>`,
    excerpt: {
      file: "user/sh.c",
      within: "runcmd(struct cmd *cmd)",
      anchor: "case PIPE:",
      after: 10,
    },
    sourceNote:
      "The real shell rewires its left child’s output this way and also connects a right child’s input. This smaller experiment uses the parent as the reader so the destination is easy to observe.",
    assignment:
      'Change echo’s argument from "from echo" to "new message". Build and run. The parent should print pipeline=new message, having received echo’s output through the pipe.',
    takeaway:
      "Redirection rearranges descriptor references; ordinary programs keep using the same read/write interfaces.",
    reflection:
      "Why must the parent close its own unused write descriptor before waiting for EOF?",
    contextTitle: "Read shell pipelines and exec",
    contextFiles: ["user/sh.c", "kernel/sysfile.c", "kernel/pipe.c"],
    expected: "pipeline=from echo",
  }),
};
