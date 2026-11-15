import { program, lesson } from "./lesson-helpers.js?v=chapter3";
const fileLesson = (details) => lesson({ editorHeight: 640, ...details });
const fileProgram = (body) =>
  program(body, { headers: ["kernel/fcntl.h", "kernel/stat.h"] });
const create =
  '  int fd = open("note", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) { printf("open failed\\n"); exit(1); }\n';
const content =
  create +
  '  if (write(fd, "abcd", 4) != 4) exit(1);\n  close(fd);\n  fd = open("note", O_RDONLY);\n  if (fd < 0) exit(1);\n';
export const chapter4Lessons = {
  "opening-and-closing-files": fileLesson({
    title: "A descriptor is a process-local handle",
    goal: "Observe open allocate a descriptor and close make that slot reusable.",
    starter: () =>
      fileProgram(
        create +
          '  close(fd);\n  int next = open("note", O_RDONLY);\n  if (next < 0) exit(1);\n  printf("first fd=%d next fd=%d reused=%d\\n", fd, next, fd == next);\n  close(next);',
      ),
    reading: `<p>A <strong>file descriptor</strong> is a small integer indexing the calling process’s open-file table. We used descriptor <code>1</code> for standard output. <button class="code-link" data-focus="open">open</button> allocates another slot and connects it to an open file.</p><p><code>O_CREATE</code> creates a missing file, <code>O_RDWR</code> allows reading and writing, and <code>O_TRUNC</code> empties an existing regular file. These constants come from xv6’s <code>fcntl.h</code>.</p><p>The example opens a file, closes that descriptor, then opens the file again. xv6 searches from the lowest free slot, so this run reuses the number. Closing a descriptor releases a handle; it does not remove the file’s name.</p>`,
    excerpt: {
      file: "kernel/sysfile.c",
      within: "fdalloc(struct file *f)",
      anchor: "for(fd = 0;",
      after: 5,
    },
    sourceNote:
      "fdalloc finds an empty ofile entry, stores the struct file pointer, and returns that index. Different processes can use the same descriptor number for different open files.",
    assignment:
      "Remove the first close(fd) call. Build and run. The first slot is still occupied, so the second open should use another descriptor and reused should become 0.",
    takeaway:
      "A descriptor number belongs to a process’s table; close releases its slot.",
    reflection:
      "Why does knowing that two processes both use descriptor 3 tell you little about which files they opened?",
    contextTitle: "Read allocation and close",
    contextFiles: ["kernel/sysfile.c", "kernel/file.c", "kernel/proc.h"],
    expected: "reused=1",
  }),
  "reads-advance-the-file-offset": fileLesson({
    title: "Reads advance an open file’s offset",
    goal: "Follow two reads through successive bytes of a regular file.",
    starter: () =>
      fileProgram(
        content +
          '  char buf[3] = {0};\n  read(fd, buf, 2);\n  printf("first=%s\\n", buf);\n  memset(buf, 0, sizeof(buf));\n  read(fd, buf, 2);\n  printf("second=%s\\n", buf);\n  close(fd);',
      ),
    reading: `<p>An open regular file has an <strong>offset</strong>: the position where its next read or write begins. A successful read advances it by the number of bytes actually read.</p><p>The example writes <code>abcd</code>, closes the file, then opens it for reading. A new open starts at offset zero. Two reads of two bytes produce <code>ab</code>, then <code>cd</code>.</p><p>The three-byte C buffer leaves room for a zero terminator so printf can display each result as a string. Clearing the buffer between reads separates this C bookkeeping from the kernel’s file offset.</p>`,
    excerpt: {
      file: "kernel/file.c",
      within: "fileread(struct file *f",
      anchor: "if((r = readi(",
      after: 1,
    },
    sourceNote:
      "readi receives f->off. When it returns a positive byte count, fileread adds that count to the open file’s offset. The offset is not stored in the pathname string.",
    assignment:
      "Change only the first read’s count from 2 to 1. Build and run. The first result should be a, and the next two bytes should be bc.",
    takeaway:
      "Repeated reads use and advance the open file’s current position.",
    reflection:
      "What offset would the next read use after successfully reading one byte and then two more?",
    contextTitle: "Read the file and inode read path",
    contextFiles: ["kernel/file.c", "kernel/fs.c", "kernel/sysfile.c"],
    expected: "second=cd",
  }),
  "dup-shares-the-open-file": fileLesson({
    title: "dup shares the open file",
    goal: "Distinguish a second descriptor from a separate open-file offset.",
    starter: () =>
      fileProgram(
        content +
          '  int other = dup(fd);\n  if (other < 0) exit(1);\n  char first = 0, second = 0;\n  read(fd, &first, 1);\n  read(other, &second, 1);\n  printf("first=%c second=%c\\n", first, second);\n  close(fd);\n  close(other);',
      ),
    reading: `<p><button class="code-link" data-focus="dup">dup(fd)</button> allocates another descriptor pointing to the <em>same</em> open-file object. Both descriptors therefore share its offset.</p><p>The first descriptor reads <code>a</code>. Reading through its duplicate then produces <code>b</code>, because the first read advanced their shared position. The two descriptor numbers identify separate table slots, but those slots point to one object.</p><p>Opening the pathname again is a different operation: it creates another open-file object with its own offset, even though both objects refer to the same underlying file.</p>`,
    excerpt: {
      file: "kernel/sysfile.c",
      within: "sys_dup(void)",
      anchor: "if((fd=fdalloc(f))",
      after: 3,
    },
    sourceNote:
      "sys_dup passes the existing struct file pointer f to fdalloc, then increments its reference count with filedup. It does not create a new struct file or reset f->off.",
    assignment:
      'Replace dup(fd) with open("note", O_RDONLY). Build and run. The second descriptor now has an independent offset, so both reads should produce a.',
    takeaway:
      "Sharing a file’s contents and sharing an open-file position are different relationships.",
    reflection:
      "Why is this same shared-object rule useful when a shell duplicates an output descriptor?",
    contextTitle: "Read descriptor and file references",
    contextFiles: ["kernel/sysfile.c", "kernel/file.c", "kernel/file.h"],
    expected: "first=a second=b",
  }),
  "unlink-keeps-open-files-alive": fileLesson({
    title: "unlink removes a name",
    goal: "Read an already-open file after removing its directory entry.",
    starter: () =>
      fileProgram(
        create +
          '  if (write(fd, "alive", 5) != 5) exit(1);\n  close(fd);\n  fd = open("note", O_RDONLY);\n  if (fd < 0) exit(1);\n  unlink("note");\n  int named = open("note", O_RDONLY);\n  char buf[6] = {0};\n  read(fd, buf, 5);\n  printf("name open=%d open data=%s\\n", named, buf);\n  if (named >= 0) close(named);\n  close(fd);',
      ),
    reading: `<p>A directory entry associates a name with a file’s <strong>inode</strong>, the kernel’s record of that file’s type, size and data blocks. An open descriptor also keeps a reference to the inode through its open-file object.</p><p><button class="code-link" data-focus="unlink">unlink("note")</button> removes the directory name. A later open by that name fails, but the descriptor opened earlier can still read the data.</p><p>xv6 frees the inode’s data only when no directory links remain and its last retained reference is released. That is why unlink and close do different jobs.</p>`,
    excerpt: {
      file: "kernel/fs.c",
      within: "iput(struct inode *ip)",
      anchor: "if(ip->ref == 1",
      after: 2,
    },
    sourceNote:
      "The reclamation check requires both no links and no other inode references. An open file can keep the inode alive after its final name has been removed.",
    assignment:
      'Remove the unlink("note") line. Build and run. Opening the name should now succeed, while the original descriptor still reads alive.',
    takeaway:
      "A name can disappear while an existing open handle remains usable.",
    reflection:
      "When the last name is gone, which later action lets xv6 reclaim this example’s file?",
    contextTitle: "Read unlink and inode lifetime",
    contextFiles: ["kernel/sysfile.c", "kernel/fs.c", "kernel/file.c"],
    expected: "name open=-1 open data=alive",
  }),
  "two-names-one-inode": fileLesson({
    title: "Two names can identify one inode",
    goal: "Observe hard links and separate link counts from open references.",
    starter: () =>
      fileProgram(
        '  int fd = open("first", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0 || write(fd, "Hi", 2) != 2) exit(1);\n  if (link("first", "second") < 0) exit(1);\n  struct stat before, after;\n  if (fstat(fd, &before) < 0) exit(1);\n  unlink("first");\n  int other = open("second", O_RDONLY);\n  if (other < 0 || fstat(other, &after) < 0) exit(1);\n  char buf[3] = {0};\n  read(other, buf, 2);\n  printf("same_inode=%d links_now=%d data=%s\\n", before.ino == after.ino, after.nlink, buf);\n  close(fd);\n  close(other);',
      ),
    reading: `<p>A <strong>hard link</strong> adds another directory name for the same inode. <button class="code-link" data-focus="link(">link("first", "second")</button> does not copy the file’s bytes into an independent file.</p><p><code>fstat</code> reports metadata for an open descriptor. The example compares inode numbers before and after removing the first name, and reads the contents through the second name.</p><p>The inode number agrees, the data remains <code>Hi</code>, and the remaining link count is one. Open descriptors also retain references, but they do not add directory links to <code>nlink</code>.</p>`,
    excerpt: {
      file: "kernel/sysfile.c",
      within: "sys_link(void)",
      anchor: "ip->nlink++;",
      after: 1,
    },
    sourceNote:
      "sys_link increments the inode’s link count before adding the new directory entry, with rollback on failure. Removing a name decrements that count; it does not invalidate another name.",
    assignment:
      'Remove unlink("first"). Build and run. The inode numbers should still agree, but links_now should be 2 because both names remain.',
    takeaway:
      "Names, inodes and open descriptors are connected objects with different lifetimes and counts.",
    reflection:
      "Why does closing one descriptor not remove either hard-link name?",
    contextTitle: "Read names, metadata and linking",
    contextFiles: ["kernel/sysfile.c", "kernel/fs.c", "kernel/stat.h"],
    expected: "same_inode=1 links_now=1 data=Hi",
  }),
  "writes-pass-through-the-log": fileLesson({
    title: "Writes pass through filesystem transactions",
    goal: "Follow a regular-file write through the filesystem and verify its bytes.",
    editorHeight: 720,
    starter: () =>
      fileProgram(
        "  enum { N = 6000 };\n  static char data[N];\n  for (int i = 0; i < N; i++) data[i] = 'a' + i % 26;\n" +
          create +
          '  int written = write(fd, data, N);\n  close(fd);\n  memset(data, 0, N);\n  fd = open("note", O_RDONLY);\n  if (fd < 0) exit(1);\n  int got = read(fd, data, N);\n  int errors = 0;\n  for (int i = 0; i < got; i++)\n    if (data[i] != \'a\' + i % 26) errors++;\n  printf("written=%d read=%d errors=%d\\n", written, got, errors);\n  close(fd);',
      ),
    reading: `<p>A regular-file write passes from the descriptor’s open-file object to the inode and block layer. xv6 records changed disk blocks in a <strong>log</strong>, or journal, so updates can be committed in an ordered way.</p><p>In the excerpt, <code>begin_op</code> reserves room for a filesystem operation. <code>writei</code> changes inode data, and <code>end_op</code> participates in committing the logged changes. A large write is split into bounded chunks, so one write syscall can involve several transactions.</p><p>The program writes a known byte pattern, closes the file, clears its C buffer, and reads the file back. The static buffer is stored in the program’s data area rather than its small user stack. This experiment verifies the running write/read path; each new run starts with a fresh guest filesystem.</p>`,
    excerpt: {
      file: "kernel/file.c",
      within: "filewrite(struct file *f",
      anchor: "begin_op();",
      after: 5,
    },
    sourceNote:
      "The inode is locked while writei uses and advances f->off. The log implementation records and installs changed blocks. The larger edit also exercises bmap’s indirect-block path; readback verifies all returned bytes.",
    assignment:
      "Change N from 6000 to 13000. Build and run. Both byte counts should grow to 13000 and errors should remain zero. Read bmap in the surrounding source to find the direct-to-indirect block boundary.",
    takeaway:
      "A file write is mediated by inode, block and transaction code; successful readback checks the bytes through that path.",
    reflection:
      "Why does the kernel limit each logged chunk instead of putting an arbitrarily large write into one transaction?",
    contextTitle: "Follow writes to blocks and the log",
    contextFiles: ["kernel/file.c", "kernel/fs.c", "kernel/log.c"],
    expected: "written=6000 read=6000 errors=0",
  }),
};
