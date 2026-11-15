import {
  lesson,
  program,
  kernelFunction,
} from "./lesson-helpers.js?v=chapter7";
const hook = (body) =>
  "uint64\nsys_getpid(void)\n{\n" + body + "\n  return myproc()->pid;\n}\n";
const k = (build, details) =>
  lesson({
    mode: "kernel",
    file: build.file || "kernel/sysproc.c",
    offset: build.offset || 20,
    build: {
      target: "sys_getpid",
      file: "kernel/sysproc.c",
      offset: 20,
      ...build,
    },
    editorHeight: 660,
    contextTitle: "Read program loading",
    contextFiles: [
      "kernel/exec.c",
      "kernel/elf.h",
      "kernel/vm.c",
      "user/bssprobe.c",
    ],
    ...details,
  });
const elf = {
  headers: ["kernel/elf.h"],
  functions: ["begin_op", "end_op", "namei", "ilock", "readi", "iunlockput"],
};
const openELF =
  "  begin_op();\n  struct inode *ip = namei(selected);\n  if (!ip) { end_op(); return -1; }\n  ilock(ip);\n  struct elfhdr header;\n  if (readi(ip, 0, (uint64)&header, 0, sizeof header) != sizeof header) {\n    iunlockput(ip); end_op(); return -1;\n  }\n";
const closeELF = "  iunlockput(ip);\n  end_op();\n";
const execBuild = {
  target: "exec",
  file: "kernel/exec.c",
  offset: 12,
  headers: ["kernel/elf.h"],
  constants: ["PGSIZE", "PGROUNDUP"],
  functions: [
    "begin_op",
    "end_op",
    "namei",
    "ilock",
    "readi",
    "proc_pagetable",
    "uvmalloc",
    "iunlockput",
    "uvmclear",
    "strlen",
    "copyout",
    "safestrcpy",
    "proc_freepagetable",
    "strncmp",
  ],
  globals: "int loadseg(pagetable_t,uint64,struct inode*,uint,uint);",
};
export const chapter15Lessons = {
  "elf-headers-identify-an-executable": k(elf, {
    title: "An ELF header identifies an executable",
    goal: "Read the real file header checked by exec.",
    starter: () =>
      hook(
        '  char *selected = "lab";\n' +
          openELF +
          '  printf("ELF magic matches=%d\\n", header.magic == ELF_MAGIC);\n' +
          closeELF,
      ),
    reading:
      "<p>exec does not execute a C source file or arbitrary text. It reads an ELF executable containing a header, a program-header table and bytes to load. The magic identifies this format before the kernel creates a replacement address space.</p><p>The kernel probe opens the actual lab executable, locks its inode and reads its header with readi. Build and observe ELF magic matches=1. Select README to read an ordinary text file and observe 0.</p><p>Magic is only the first check. This pinned loader also checks segment sizes, address overflow and alignment as it loads. It assumes the course’s RV64 executable format; recognizing a magic word alone is not a complete general-purpose ELF validation policy.</p>",
    excerpt: {
      file: "kernel/exec.c",
      within: "exec(char *path",
      anchor: "// Check ELF header",
      after: 9,
    },
    sourceNote:
      "readi with user_dst=0 writes into a kernel buffer. The inode stays locked while the loader interprets its file data.",
    assignment:
      'Change selected = "lab" to selected = "README". Build and run; ELF magic matches becomes 0.',
    expected: "ELF magic matches=1",
    takeaway:
      "The loader interprets a structured executable file before replacing a program.",
    reflection:
      "Why should the kernel reject an invalid header before committing a new address space?",
  }),
  "segments-separate-file-bytes-from-memory-size": k(elf, {
    title: "A segment’s memory size can exceed its file bytes",
    goal: "Read PT_LOAD sizes from the native BSS fixture.",
    starter: () =>
      hook(
        '  char *selected = "bssprobe";\n' +
          openELF +
          '  for (int i = 0; i < header.phnum; i++) {\n    struct proghdr segment;\n    if (readi(ip, 0, (uint64)&segment, header.phoff + i * sizeof segment, sizeof segment) != sizeof segment) break;\n    if (segment.type != ELF_PROG_LOAD) continue;\n    uint64 span = segment.memsz;\n    printf("span exceeds file bytes=%d\\n", span > segment.filesz);\n    break;\n  }\n' +
          closeELF,
      ),
    reading:
      "<p>A loadable program segment names a file offset, a virtual address, a file byte count and a memory byte count. The kernel allocates memsz bytes but copies only filesz bytes. The remaining memory must start at zero.</p><p>The supplied native bssprobe contains an uninitialized 4096-byte object in a real ELF NOBITS section. Its loadable segment therefore has memsz greater than filesz. The probe reads the actual program header from that executable. Build and observe 1, then select filesz itself to observe 0.</p><p>ELF segment flags and the kernel’s chosen page permissions are separate. As the earlier memory chapter showed, this pinned xv6 maps ordinary user allocations RWX; it does not derive per-segment permissions from these ELF flags.</p>",
    excerpt: {
      file: "kernel/exec.c",
      within: "exec(char *path",
      anchor: "if(ph.memsz < ph.filesz)",
      after: 13,
    },
    sourceNote:
      "The loader checks memsz >= filesz and rejects address wraparound before allocation. loadseg copies the file-backed prefix into already mapped pages.",
    assignment:
      "Change span = segment.memsz to span = segment.filesz. Build and run; span exceeds file bytes becomes 0.",
    expected: "span exceeds file bytes=1",
    takeaway:
      "A program’s file representation and its initialized memory image have different sizes.",
    reflection:
      "Why need an executable not store thousands of zero bytes for an uninitialized object?",
  }),
  "the-loader-zeroes-real-bss-memory": k(
    {
      target: "uvmalloc",
      file: "kernel/vm.c",
      offset: 220,
      constants: ["PGSIZE", "PGROUNDUP", "PTE_R", "PTE_W", "PTE_X", "PTE_U"],
      functions: [
        "kalloc",
        "kfree",
        "uvmdealloc",
        "memset",
        "mappages",
        "strncmp",
      ],
      probe: program(
        '  char *args[] = {"bssprobe", 0};\n  exec("bssprobe", args);\n  printf("exec failed\\n");\n  exit(1);',
      ),
    },
    {
      title: "The loader supplies zero bytes for BSS",
      goal: "Change actual page initialization before loading a native NOBITS object.",
      editorHeight: 850,
      starter: (files) =>
        "#define FILL 0\n" +
        kernelFunction(files, "kernel/vm.c", "uvmalloc").replace(
          "memset(mem, 0, PGSIZE);",
          'memset(mem, myproc() && strncmp(myproc()->name, "workbench", 10) == 0 ? FILL : 0, PGSIZE);',
        ),
      reading:
        "<p>C requires an uninitialized object with static storage to start at zero. For a native ELF BSS region, those bytes are absent from the file. xv6 satisfies the requirement by zeroing allocated pages before copying each segment’s file-backed bytes over the prefix.</p><p>The editable uvmalloc is the actual allocator. The supplied workbench program execs native bssprobe, whose source is available below. Its volatile array read forces an actual memory load. Build and observe BSS byte=0.</p><p>Set FILL to 7. Only allocations while the caller is named workbench receive that fill, isolating this exec experiment from normal init and shell loading. The file copy does not overwrite BSS, so the native program reads 7. This deliberately violates the initialization contract. It does not use a browser link-slot global as evidence of ELF zero-fill.</p>",
      excerpt: {
        file: "kernel/vm.c",
        within: "uvmalloc(pagetable_t",
        anchor: "memset(mem, 0, PGSIZE);",
        before: 5,
        after: 7,
      },
      sourceNote:
        "bssprobe is built by the native toolchain with a real NOBITS region and memsz > filesz. loadseg copies only filesz; zero-fill supplies the remaining initialized memory.",
      assignment:
        "Change FILL from 0 to 7. Build and run; the actual native program should report BSS byte=7. Restore 0 to restore the C initialization contract.",
      expected: "BSS byte=0",
      takeaway:
        "Executable loading must construct bytes that are required in memory but absent from the file.",
      reflection:
        "Which writes initialize the BSS tail: reading file bytes or zeroing allocated pages?",
    },
  ),
  "exec-builds-a-new-argument-vector": lesson({
    title: "Exec builds a new argument vector",
    goal: "Follow copied strings and user pointers into the replacement program.",
    editorHeight: 720,
    starter: () =>
      '#include "kernel/types.h"\n#include "user/user.h"\n\nint main(int argc, char **argv)\n{\n  if (argc == 1) {\n    char *next[] = {"workbench", "small", "kernel", 0};\n    exec("workbench", next);\n    printf("exec failed\\n");\n    exit(1);\n  }\n  printf("argc=%d first=%s second=%s\\n", argc, argv[1], argv[2]);\n  exit(0);\n}\n',
    reading:
      "<p>An exec caller supplies pointers into its old address space. The replacement cannot keep using those old pointers after its image is freed. xv6 copies the argument strings into the new user stack and creates a new array of pointers to those copies.</p><p>ustack is a temporary kernel array containing new user addresses. Its final zero entry terminates argv. copyout writes both strings and the pointer array through the new page table, before that table becomes the process’s active image.</p><p>This program execs its own file once with two extra arguments. The replacement enters main with argc=3 and prints the copied strings. Change small to clear to observe the new argument after a real image replacement. The new argc prevents repeated self-exec.</p>",
    excerpt: {
      file: "kernel/exec.c",
      within: "exec(char *path",
      anchor: "for(argc = 0; argv[argc]; argc++)",
      after: 24,
    },
    sourceNote:
      "The pointer array contains user virtual addresses, not kernel stack addresses. argc reaches a0 through the syscall return value, while a1 names the new argv array.",
    assignment:
      'Change "small" in the next array to "clear". Build and run; the replacement prints argc=3 first=clear second=kernel.',
    expected: "argc=3 first=small second=kernel",
    takeaway:
      "Exec reconstructs arguments in the new address space before discarding the old one.",
    reflection:
      "Why can the replacement not reuse the caller's original argv pointers?",
    contextTitle: "Read argument copying",
    contextFiles: ["kernel/exec.c", "kernel/sysfile.c"],
  }),
  "exec-establishes-the-entry-stack": k(execBuild, {
    title: "Exec establishes the entry stack",
    goal: "Change the real saved entry stack pointer and observe the ABI alignment.",
    editorHeight: 900,
    starter: (files) =>
      "#define STACK_BIAS 0\n" +
      kernelFunction(files, "kernel/exec.c", "exec").replace(
        "p->trapframe->sp = sp;",
        'p->trapframe->sp = sp + (strncmp(path, "workbench", 10) == 0 ? STACK_BIAS : 0);\n  if (strncmp(path, "workbench", 10) == 0)\n    printf("entry stack alignment=%d\\n", (int)(p->trapframe->sp % 16));',
      ),
    reading:
      "<p>The RISC-V calling convention requires a 16-byte-aligned stack at program entry. exec rounds its argument placements accordingly, records argv in a1 and puts the final entry stack pointer in the trapframe.</p><p>It also allocates two stack-area pages and clears user access on the lower one, creating the guard page studied earlier. The usable stack and the argument vector are related parts of the new image, but a1 and sp are distinct saved values.</p><p>The editor contains the actual complete exec function. Build and observe entry stack alignment=0, meaning remainder zero modulo 16. Set STACK_BIAS to 8 to deliberately misalign only workbench’s entry pointer and observe 8. This small integer-only test can still run, but that does not relax the ABI contract; code may depend on its required alignment. Init and shell entry pointers remain normal in this fixture.</p>",
    excerpt: {
      file: "kernel/exec.c",
      within: "exec(char *path",
      anchor: "// Allocate two pages",
      after: 12,
    },
    sourceNote:
      "The kernel commits epc and sp only after constructing the replacement image. The observation reads the actual saved entry sp, not the kernel's live stack-pointer register.",
    assignment:
      "Change STACK_BIAS from 0 to 8. Build and run; entry stack alignment becomes 8. Restore 0 to return to the valid entry contract.",
    expected: "entry stack alignment=0",
    takeaway:
      "A loader establishes both a memory image and the machine state expected by its entry ABI.",
    reflection:
      "Why are a valid mapped address and an ABI-correct stack pointer different requirements?",
  }),
  "failed-exec-preserves-the-old-image": lesson({
    title: "A failed exec preserves the old image",
    goal: "Observe failure returning to the caller with its old memory intact.",
    editorHeight: 650,
    starter: () =>
      program(
        '  int fd = open("notelf", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  write(fd, "ordinary text", 13); close(fd);\n  int canary = 42;\n  int pid = getpid();\n  char *args[] = {"notelf", 0};\n  int result = exec("notelf", args);\n  printf("exec failed=%d old value=%d same process=%d\\n", result == -1, canary, getpid() == pid);',
        { headers: ["kernel/fcntl.h"] },
      ),
    reading:
      "<p>Building a new image can fail while reading headers, allocating pages or copying arguments. xv6 constructs a candidate page table while retaining the old one. Only after successful preparation does it assign p-&gt;pagetable and free the previous image.</p><p>The bad path frees any candidate image and releases the executable inode and filesystem operation. The original program can then receive -1 from exec and handle the failure.</p><p>The program creates a text file and tries to execute it. Build and observe failure, the original canary value 42, and the same process identity. Change the canary to 73 and see that value survive the failed replacement. A successful exec would enter a new program instead of returning to this printf.</p>",
    excerpt: {
      file: "kernel/exec.c",
      within: "exec(char *path",
      anchor: "bad:",
      after: 10,
    },
    sourceNote:
      "The commit section above bad changes p->pagetable, size, epc and sp only after all preparation succeeds. Failure cleanup must preserve the currently running image.",
    assignment:
      "Change canary = 42 to canary = 73. Build and run; old value becomes 73 while exec failed and same process remain 1.",
    expected: "exec failed=1 old value=42 same process=1",
    takeaway:
      "Replacement needs a commit boundary so preparation failures can return to the old program.",
    reflection:
      "Why would freeing the old page table before loading the candidate make failure handling harder?",
    contextTitle: "Read exec commit and cleanup",
    contextFiles: ["kernel/exec.c", "kernel/vm.c"],
  }),
  "the-shell-composes-kernel-interfaces": lesson({
    title: "The shell composes kernel interfaces",
    goal: "Build redirection with fork, descriptors and exec.",
    editorHeight: 790,
    starter: () =>
      program(
        '  int child = fork();\n  if (child < 0) exit(1);\n  if (child == 0) {\n    close(1);\n    if (open("redirected", O_CREATE | O_WRONLY | O_TRUNC) != 1) exit(1);\n    char *args[] = {"echo", "kernel", 0};\n    exec("echo", args);\n    exit(1);\n  }\n  int status; wait(&status);\n  int fd = open("redirected", O_RDONLY);\n  if (fd < 0) exit(1);\n  char text[32] = {0};\n  read(fd, text, sizeof text - 1); close(fd);\n  printf("child status=%d redirected output=%s", status, text);',
        { headers: ["kernel/fcntl.h"] },
      ),
    reading:
      "<p>The shell is a user program that combines kernel interfaces. It does not need a special “run this command with redirection” syscall. A child closes descriptor 1, opens the output file into the lowest free slot, and execs the requested program.</p><p>The open descriptor survives exec. echo writes to its ordinary stdout, which now names the file. The parent retains its own console descriptors and waits for the child before opening the completed output.</p><p>This program builds that composition directly, without a parser. Build to read kernel from the actual redirected file, then change the echo argument to source. The matching runcmd code shows the same descriptor manipulation in xv6’s real shell. Earlier pipe lessons supply the parallel composition used by its PIPE case.</p>",
    excerpt: {
      file: "user/sh.c",
      within: "runcmd(struct cmd",
      anchor: "case REDIR:",
      after: 12,
    },
    sourceNote:
      "The shell arranges descriptors before exec; the executed program uses the normal write interface. The kernel's descriptor table and file object implement the resulting routing.",
    assignment:
      'Change the echo argument "kernel" to "source". Build and run; redirected output becomes source and child status remains 0.',
    expected: "child status=0 redirected output=kernel",
    takeaway:
      "A shell gains expressive behavior by composing a small set of process and file interfaces.",
    reflection:
      "Why can the parent's console remain unchanged when its child redirects stdout?",
    contextTitle: "Read the real shell",
    contextFiles: [
      "user/sh.c",
      "kernel/proc.c",
      "kernel/sysfile.c",
      "kernel/file.c",
    ],
  }),
  "capstone-follow-a-byte-from-process-to-disk": lesson({
    title: "Follow a byte from a process to disk and back",
    goal: "Connect process, pipe, file, journal and loader paths in one working program.",
    editorHeight: 900,
    starter: () =>
      program(
        '  int fd = open("capstone", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  int ends[2];\n  if (pipe(ends) < 0) exit(1);\n  int child = fork();\n  if (child < 0) exit(1);\n  if (child == 0) {\n    close(ends[0]); close(fd);\n    char *message = "from process to disk\\n";\n    write(ends[1], message, strlen(message));\n    close(ends[1]); exit(0);\n  }\n  close(ends[1]);\n  char buf[64];\n  int n, total = 0;\n  while ((n = read(ends[0], buf, sizeof buf)) > 0) {\n    if (write(fd, buf, n) != n) exit(1);\n    total += n;\n  }\n  close(ends[0]); close(fd);\n  int status; wait(&status);\n  printf("collected child=%d file bytes=%d\\n", status, total);\n  char *args[] = {"cat", "capstone", 0};\n  exec("cat", args);\n  printf("exec failed\\n");\n  exit(1);',
        { headers: ["kernel/fcntl.h"] },
      ),
    reading:
      "<p>The child sends bytes through a pipe. The parent reads the stream until EOF, writes those bytes to a real file, collects the child and replaces itself with native cat to read the file back. Build and follow the output through the complete system.</p><p>Trace one write through the source picker: syscall checks and dispatch lead to filewrite; a pipe uses pipewrite, while a regular file reaches writei, bmap, buffer-cache updates and the journal. Commit submits actual VirtIO requests, whose interrupts wake blocked work. Checked copies connect the user buffers to those kernel paths.</p><p>Then trace the final exec: a new page table, ELF segments, zero-filled memory, arguments and entry state replace the parent’s image. Change the child’s message and find that exact text printed by cat after file readback. Use one source path at a time; the purpose is to connect mechanisms you have already changed, rather than memorize the whole kernel.</p>",
    excerpt: {
      file: "kernel/file.c",
      within: "filewrite(struct file",
      anchor: "begin_op();",
      after: 13,
    },
    sourceNote:
      "The final output is produced by the unchanged cat executable reading the guest file. The parent checks every file write and counts the actual bytes transferred from the pipe.",
    assignment:
      'Change "from process to disk\\n" to "OS capstone complete\\n". Build and run; cat should print the new text, with collected child=0 and the actual file byte count.',
    expected: "from process to disk",
    takeaway:
      "An OS is a set of cooperating mechanisms whose contracts compose into complete programs.",
    reflection:
      "Choose one byte in the final output. Which copy, mapping, locking, logging and interrupt paths allowed it to get there?",
    contextTitle: "Trace one path at a time",
    contextFiles: [
      "kernel/syscall.c",
      "kernel/pipe.c",
      "kernel/file.c",
      "kernel/fs.c",
      "kernel/log.c",
      "kernel/virtio_disk.c",
      "kernel/exec.c",
      "user/cat.c",
    ],
  }),
};
