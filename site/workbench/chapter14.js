import {
  lesson,
  program,
  kernelFunction,
} from "./lesson-helpers.js?v=chapter7";
const hook = (body) =>
  "uint64\nsys_getpid(void)\n{\n" + body + "\n  return myproc()->pid;\n}\n";
const types = [
  { file: "kernel/log.c", start: "struct logheader {", end: "struct log log;" },
];
const headers = [
  "kernel/fs.h",
  "kernel/sleeplock.h",
  "kernel/file.h",
  "kernel/buf.h",
];
const fileProbe = program(
  '  int fd = open("journal", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  write(fd, "A", 1); close(fd);\n  getpid();\n  fd = open("journal", O_RDONLY);\n  char byte = 0;\n  read(fd, &byte, 1); close(fd);\n  printf("committed byte=%c\\n", byte);',
  { headers: ["kernel/fcntl.h"] },
);
const readRecovery = program(
  '  int fd = open("README", O_RDONLY);\n  if (fd < 0) exit(1);\n  char byte = 0;\n  read(fd, &byte, 1); close(fd);\n  printf("recovered byte=%c\\n", byte);',
  { headers: ["kernel/fcntl.h"] },
);
const k = (build, details) =>
  lesson({
    mode: "kernel",
    file: build.file || "kernel/sysproc.c",
    offset: build.offset || 20,
    build: {
      target: "sys_getpid",
      file: "kernel/sysproc.c",
      offset: 20,
      typeSources: types,
      ...build,
    },
    editorHeight: 720,
    contextTitle: "Read commit and recovery",
    contextFiles: [
      "kernel/log.c",
      "kernel/bio.c",
      "kernel/file.c",
      "kernel/virtio_disk.c",
    ],
    ...details,
  });
const io = {
  headers,
  functions: [
    "begin_op",
    "end_op",
    "namei",
    "ilock",
    "iunlockput",
    "bread",
    "brelse",
    "log_write",
    "bpin",
    "bunpin",
    "acquire",
    "release",
  ],
  probe: fileProbe,
};
const update =
  "  struct inode *ip = namei(\"journal\");\n  if (!ip) { end_op(); return -1; }\n  ilock(ip);\n  struct buf *b = bread(ip->dev, ip->addrs[0]);\n  b->data[0] = 'Z';\n  log_write(b);\n";
const recovery = {
  target: "recover_from_log",
  file: "kernel/log.c",
  offset: 118,
  fixture: "committed-redo",
  globals:
    "void read_head(void);\nvoid install_trans(int);\nvoid write_head(void);",
  probe: readRecovery,
};
export const chapter14Lessons = {
  "filesystem-operations-reserve-log-space": k(
    { functions: ["begin_op", "end_op", "acquire", "release"] },
    {
      title: "Filesystem operations reserve log space",
      goal: "Observe outstanding operations before balanced completion.",
      starter: () =>
        "#define OPERATIONS 1\n" +
        hook(
          '  for (int i = 0; i < OPERATIONS; i++) begin_op();\n  acquire(&log.lock);\n  int count = log.outstanding;\n  release(&log.lock);\n  for (int i = 0; i < OPERATIONS; i++) end_op();\n  printf("outstanding observed=%d\\n", count);',
        ),
      reading:
        "<p>A filesystem operation may modify several metadata and data blocks. begin_op reserves enough worst-case log capacity before allowing that work to start. It sleeps if a commit is active or existing reservations could exhaust the log.</p><p>The actual source checks recorded blocks plus (outstanding+1)*MAXOPBLOCKS against LOGSIZE. A reservation is not the same as immediately writing that many log records; it guarantees room for the operation’s possible updates.</p><p>The probe begins one empty operation, samples the real outstanding count under the log lock and balances its completion. Build for 1, then begin two nested empty operations for 2. This fixture fits the reservation bound. It is not a general license to nest arbitrarily many operations, which could wait for a reservation held by the caller itself.</p>",
      excerpt: {
        file: "kernel/log.c",
        within: "begin_op(void)",
        anchor: "if(log.committing)",
        after: 12,
      },
      sourceNote:
        "begin_op releases log.lock after admitting the operation. The caller must eventually end_op even when its filesystem work fails.",
      assignment:
        "Change OPERATIONS from 1 to 2. Build and run; outstanding observed becomes 2. Keep both loops balanced.",
      expected: "outstanding observed=1",
      takeaway:
        "Reservation controls admission; recorded changes and commit are later steps.",
      reflection:
        "Why reserve worst-case space before an operation starts changing blocks?",
    },
  ),
  "the-log-absorbs-repeated-block-updates": k(io, {
    title: "The log absorbs repeated updates to one block",
    goal: "Observe that a repeated log_write does not add another pin.",
    starter: () =>
      "#define ABSORB 1\n" +
      hook(
        "  begin_op();\n" +
          update +
          '  int before = b->refcnt;\n  if (ABSORB) log_write(b);\n  else bpin(b);\n  int added = b->refcnt - before;\n  if (!ABSORB) bunpin(b);\n  brelse(b);\n  iunlockput(ip);\n  end_op();\n  printf("extra pin on repeat=%d\\n", added);',
      ),
    reading:
      "<p>Multiple changes to one disk block need only one log entry containing its final cached contents. log_write searches for an existing block number before appending a record. The first entry pins the buffer; another call for the same block does not pin it again.</p><p>The supplied program creates a file containing A. The edited kernel hook changes its actual data byte to Z and records it twice. Build and observe extra pin on repeat=0, followed by committed byte=Z after the real commit.</p><p>Set ABSORB to 0 to replace the repeated log_write with a manual bpin. The measured extra reference becomes 1; the paired bunpin removes it before normal completion. This comparison exposes absorption’s reference effect without leaking a buffer or changing the journal’s block list.</p>",
    excerpt: {
      file: "kernel/log.c",
      within: "log_write(struct buf",
      anchor: "for (i = 0;",
      after: 12,
    },
    sourceNote:
      "The journal records a block identity once and later copies its final buffer contents. Absorption is distinct from dropping or merging user-visible write calls.",
    assignment:
      "Change ABSORB from 1 to 0. Build and run; extra pin on repeat becomes 1 while the file still reads back Z.",
    expected: "extra pin on repeat=0",
    takeaway:
      "A transaction logs final block images, with one retained cache reference per recorded block.",
    reflection:
      "Why would pinning again on every repeated log_write require different cleanup?",
  }),
  "the-last-operation-triggers-commit": k(io, {
    title: "The last outstanding operation triggers commit",
    goal: "Observe pending changes before and after the final end_op.",
    starter: () =>
      "#define FINISH 1\n" +
      hook(
        "  begin_op();\n  begin_op();\n" +
          update.replace(
            "end_op(); return -1;",
            "end_op(); end_op(); return -1;",
          ) +
          '  brelse(b);\n  iunlockput(ip);\n  for (int i = 0; i < FINISH; i++) end_op();\n  acquire(&log.lock);\n  int pending = log.lh.n > 0;\n  release(&log.lock);\n  for (int i = FINISH; i < 2; i++) end_op();\n  printf("pending before cleanup=%d\\n", pending);',
      ),
    reading:
      "<p>A transaction can contain updates from several overlapping filesystem operations. end_op decrements outstanding. Only the last completion sets committing and runs commit; earlier completions leave the recorded block list pending.</p><p>This controlled probe begins two operations and modifies one actual file block. It ends one operation, samples whether the log still has entries, and then completes the remaining operation. Build and observe pending before cleanup=1. The final cleanup commits Z, which the supplied program reads back.</p><p>Set FINISH to 2 to complete both operations before the sample. The real commit installs the data and clears the in-memory log count, so pending becomes 0. The loops still call end_op exactly twice. Returning from a particular syscall and defining a transaction boundary are related through this protocol, not through a one-syscall-one-transaction rule.</p>",
    excerpt: {
      file: "kernel/log.c",
      within: "end_op(void)",
      anchor: "log.outstanding -= 1;",
      after: 22,
    },
    sourceNote:
      "Commit runs outside log.lock because it performs disk I/O and may sleep. committing blocks new operations until completion resets the flag and wakes them.",
    assignment:
      "Change FINISH from 1 to 2. Build and run; pending before cleanup becomes 0, and committed byte remains Z.",
    expected: "pending before cleanup=1",
    takeaway: "The commit boundary follows the outstanding-operation protocol.",
    reflection:
      "Why must commit wait until no admitted operation can still modify its recorded buffers?",
  }),
  "the-header-is-the-commit-point": k(
    {
      target: "commit",
      file: "kernel/log.c",
      offset: 193,
      headers: ["kernel/fs.h", "kernel/sleeplock.h", "kernel/buf.h"],
      functions: ["bread", "brelse", "strncmp"],
      globals:
        "void write_log(void);\nvoid write_head(void);\nvoid install_trans(int);",
      probe: fileProbe,
    },
    {
      title: "The journal header marks the commit point",
      goal: "Observe the real header before and after write_head.",
      editorHeight: 800,
      starter: (files) =>
        'static void observe_header(void)\n{\n  if (!myproc() || strncmp(myproc()->name, "workbench", 9) != 0) return;\n  struct buf *b = bread(log.dev, log.start);\n  printf("header records a commit=%d\\n", ((struct logheader*)b->data)->n > 0);\n  brelse(b);\n}\n' +
        kernelFunction(files, "kernel/log.c", "commit").replace(
          "    write_head();    // Write header to disk -- the real commit",
          "    observe_header();\n    write_head();    // Write header to disk -- the real commit",
        ),
      reading:
        "<p>Write-ahead logging first copies changed block images into the log. Only after those writes complete does write_head publish a nonzero entry count and home block numbers. xv6 treats that header write as the commit point.</p><p>commit then installs logged bytes at their home blocks and clears the header. If installation is interrupted after commit, boot can repeat it from the recorded images. Bytes in log-data blocks alone do not establish a committed transaction; recovery follows the header count.</p><p>The editable function is the actual commit. Its observer reads the real header buffer after write_log but before write_head, and reports 0. Move the observation after the first write_head to report 1. The driver’s synchronous completion model supplies xv6’s disk-write ordering here; this is not a measurement of physical storage caches.</p>",
      excerpt: {
        file: "kernel/log.c",
        within: "commit()",
        anchor: "write_log();",
        after: 5,
      },
      sourceNote:
        "write_head performs bwrite before returning. The observation reads the cache's actual header contents at that completed-write boundary; it does not infer commit from a user print statement.",
      assignment:
        "Move observe_header() from before the first write_head() to immediately after it. Build and run; header records a commit becomes 1.",
      expected: "header records a commit=0",
      takeaway:
        "Logged data precedes a commit record, and home installation follows it.",
      reflection:
        "Why must the header never announce log entries whose data has not been written?",
    },
  ),
  "boot-replays-a-committed-journal": k(recovery, {
    title: "Boot replays a committed journal",
    goal: "Run xv6’s actual recovery on a prepared interrupted-install image.",
    editorHeight: 460,
    starter: (files) =>
      kernelFunction(files, "kernel/log.c", "recover_from_log"),
    reading:
      "<p>This lesson boots an explicitly prepared disk image. README’s home data block contains O. A committed one-entry journal names that block and contains its replacement byte R, as if commit completed but home installation had not. The browser prepares those bytes; it does not perform the recovery.</p><p>The editable recover_from_log is xv6’s actual boot routine. read_head loads the committed entry, install_trans(1) copies its recorded data to the home block, and write_head clears the transaction. Build and the supplied user program reads recovered byte=R from the real file after boot.</p><p>Skip install_trans(1) and build again. The broken recovery clears the header without installing the committed data, so the file still contains O. This disposable fixture isolates one committed data-block update. It demonstrates actual replay, not an emulated physical power cut or every possible storage-failure model.</p>",
    excerpt: {
      file: "kernel/log.c",
      within: "install_trans(int recovering)",
      anchor: "struct buf *lbuf",
      after: 10,
    },
    sourceNote:
      "Recovery does not bunpin the home buffer: pins were in the previous kernel's memory and do not survive reboot. Normal commit installation uses a different recovering flag.",
    assignment:
      "Comment out install_trans(1), leaving the rest of recover_from_log intact. Build and run; recovered byte becomes O. Restore the starter to replay R again.",
    expected: "recovered byte=R",
    takeaway:
      "A committed redo record lets boot complete an interrupted home-block installation.",
    reflection:
      "Why does clearing the header before installing its data lose a committed update?",
  }),
  "redo-replay-is-idempotent": k(recovery, {
    title: "Redo replay can be repeated safely",
    goal: "Install the same committed block image twice before clearing the header.",
    editorHeight: 570,
    starter: () =>
      '#define REPLAYS 1\nstatic void\nrecover_from_log(void)\n{\n  read_head();\n  int pass;\n  for (pass = 0; pass < REPLAYS; pass++) install_trans(1);\n  printf("replay passes=%d\\n", pass);\n  log.lh.n = 0;\n  write_head();\n}\n',
    reading:
      "<p>A crash may interrupt recovery itself. The journal cannot depend on remembering which home blocks were already installed in the previous boot. Instead, copying a committed final block image is idempotent: copying it again leaves the same bytes.</p><p>This page uses the same prepared O-to-R committed journal. The edited recovery loops over the actual install_trans routine before clearing its header. Build for one pass and read R. Set REPLAYS to 2 for two real installation passes; the resulting file still contains R.</p><p>This property would not follow from replaying an arbitrary instruction such as “increment this byte.” A redo log stores the desired block image, and the committed header remains available until installation is complete. Clearing it is safe only after every recorded image has reached its home location.</p>",
    excerpt: {
      file: "kernel/log.c",
      within: "install_trans(int recovering)",
      anchor: "memmove(dbuf->data",
      before: 2,
      after: 6,
    },
    sourceNote:
      "Each pass copies identical logged bytes to the same recorded home addresses. The printed pass count comes from the executed loop, while the user program independently reads the installed file.",
    assignment:
      "Change REPLAYS from 1 to 2. Build and run; replay passes becomes 2 and recovered byte remains R.",
    expected: "replay passes=1",
    takeaway:
      "Redo recovery works across repeated interruptions because installing final images is idempotent.",
    reflection:
      "Why would replaying an increment operation twice require a different recovery design?",
  }),
};
