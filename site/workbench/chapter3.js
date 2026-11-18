import {
  program,
  lesson,
  forkCheck,
  allocation,
} from "./lesson-helpers.js?v=chapter3";
export const chapter3Lessons = {
  "growing-user-memory": lesson({
    title: "sbrk grows the process memory",
    goal: "Request more user memory and interpret the old break returned by sbrk.",
    starter: () =>
      program(
        "  char *before = sbrk(0);\n" +
          allocation() +
          '  p[0] = 17;\n  printf("grew=%d first=%d\\n", (int)(sbrk(0)-before), p[0]);',
      ),
    reading: `<p>A process has a current end to its allocated user memory, often called its <strong>break</strong>. <button class="code-link" data-focus="sbrk">sbrk(n)</button> asks xv6 to change that end by <code>n</code> bytes. On success it returns the <em>old</em> end, where newly added memory starts.</p><p><code>sbrk(0)</code> asks for no change and returns the current break. The example remembers that address, requests 4096 bytes, then writes and reads a byte in the new area. It checks the failure value <code>(char*)-1</code> before using the result.</p><p>This pinned xv6 eagerly allocates memory during sbrk. Growing a process is a kernel operation, unlike declaring another C pointer variable.</p>`,
    excerpt: {
      file: "kernel/sysproc.c",
      within: "sys_sbrk(void)",
      anchor: "addr = myproc()->sz;",
      after: 3,
    },
    sourceNote:
      "The handler saves the old process size, calls growproc, and returns the saved address. A pointer returned by sbrk identifies a user virtual address, not a physical RAM address.",
    assignment:
      "Change sbrk(4096) to sbrk(8192). Choose Build & run again. The reported growth should double, while the first stored byte remains 17.",
    takeaway:
      "sbrk changes the process memory boundary and returns the previous boundary.",
    reflection:
      "Why must the program check for failure before writing through the returned pointer?",
    contextTitle: "Read the growth path",
    contextFiles: ["kernel/sysproc.c", "kernel/proc.c", "kernel/vm.c"],
    expected: "grew=4096 first=17",
  }),
  "memory-is-mapped-in-pages": lesson({
    title: "Memory is mapped in pages",
    goal: "Connect adjacent user addresses with the kernel’s page mappings.",
    starter: () =>
      program(
        allocation("8192") +
          "  p[0] = 'A';\n  p[4096] = 'B';\n  printf(\"first=%c second=%c distance=%d\\n\", p[0], p[4096], (int)(&p[4096]-p));",
      ),
    reading: `<p>xv6 manages user memory in <strong>pages</strong> of 4096 bytes. A <strong>page table</strong> connects a process’s virtual pages to physical memory pages and records their permissions.</p><p>This example requests two pages. <button class="code-link" data-focus="p[4096]">p[4096]</button> is one page beyond <code>p[0]</code>. Both addresses work because the growth operation creates the needed mappings.</p><p>In the kernel loop, <code>a</code> is a user virtual address and <code>mem</code> is a newly allocated physical page. <code>mappages</code> connects the two. Adjacent virtual pages do not have to be adjacent in physical RAM.</p>`,
    excerpt: {
      file: "kernel/vm.c",
      within: "uvmalloc(pagetable_t",
      anchor: "if(mappages(pagetable, a, PGSIZE, (uint64)mem,",
      after: 4,
    },
    sourceNote:
      "Each loop iteration maps one PGSIZE region. PTE_U permits user access; the other flags describe access permissions in this xv6 version. This program observes virtual addresses; it does not measure physical placement.",
    assignment:
      "Change the second page’s byte from B to Z. Choose Build & run again. The bytes should be A and Z, still 4096 addresses apart.",
    takeaway:
      "A user pointer names a virtual address; page mappings make the underlying memory accessible.",
    reflection:
      "Does subtracting two user pointers tell you where their pages sit in physical RAM?",
    contextTitle: "Read allocation and translation",
    contextFiles: ["kernel/vm.c", "kernel/riscv.h"],
    expected: "first=A second=B distance=4096",
  }),
  "new-pages-start-at-zero": lesson({
    title: "New user pages start at zero",
    goal: "Observe the zeroing performed when xv6 allocates user pages.",
    starter: () =>
      program(
        allocation() +
          '  // Add a byte assignment here.\n  int nonzero = 0;\n  for (int i = 0; i < 4096; i++)\n    if (p[i] != 0) nonzero++;\n  printf("nonzero bytes=%d\\n", nonzero);',
      ),
    reading: `<p>Physical memory can be reused after another process releases it. Before mapping a newly allocated page into this process, xv6 fills that page with zero bytes.</p><p>The example reads every byte in a newly requested page and counts nonzero values. It should find none. This is a property of newly allocated user pages, not a claim that every C local variable begins at zero.</p><p>The zeroing happens in <code>uvmalloc</code>, before the new mapping is made available to user code. It prevents a new allocation from exposing the previous contents of that physical page.</p>`,
    excerpt: {
      file: "kernel/vm.c",
      within: "uvmalloc(pagetable_t",
      anchor: "memset(mem, 0, PGSIZE);",
      after: 0,
    },
    sourceNote:
      "The kernel explicitly clears the allocated page. Uninitialised automatic C variables still follow C’s rules; this example reads bytes obtained from a fresh page allocation.",
    assignment:
      "Insert p[0] = 9; at the comment immediately before the counting loop. Choose Build & run again. Compare nonzero bytes across runs. How many bytes did the assignment change?",
    takeaway:
      "The allocator clears new user pages; later writes change those bytes normally.",
    reflection:
      "Why is clearing a reused physical page important when processes should not read each other’s data?",
    contextTitle: "Read page allocation and clearing",
    contextFiles: ["kernel/vm.c", "kernel/kalloc.c"],
    expected: "nonzero bytes=0",
  }),
  "shrinking-user-memory": lesson({
    title: "Shrinking releases user pages",
    goal: "Return allocated memory and observe the restored break.",
    starter: () =>
      program(
        "  char *before = sbrk(0);\n" +
          allocation() +
          '  p[0] = 17;\n  int added = (int)(sbrk(0)-before);\n  if (sbrk(-4096) == (char*)-1) exit(1);\n  printf("added=%d remaining=%d\\n", added, (int)(sbrk(0)-before));',
      ),
    reading: `<p>A negative <button class="code-link" data-focus="sbrk(-4096)">sbrk</button> argument shrinks the process memory boundary. When complete pages fall outside the new boundary, xv6 unmaps and releases them.</p><p>The example adds one page, uses it, then removes it. The final break should equal the original break. It deliberately does not read the old pointer after release: that address no longer belongs to this allocation.</p><p>The kernel rounds boundaries to whole pages when deciding which mappings to remove. Shrinking by a few bytes within a retained page does not necessarily remove that page.</p>`,
    excerpt: {
      file: "kernel/vm.c",
      within: "uvmdealloc(pagetable_t",
      anchor: "if(PGROUNDUP(newsz) < PGROUNDUP(oldsz)){",
      after: 3,
    },
    sourceNote:
      "uvmdealloc calculates which whole pages are no longer needed and calls uvmunmap with the free-memory argument set to 1. The logical boundary itself is recorded in bytes.",
    assignment:
      "Change both 4096-byte amounts to 8192. Choose Build & run again. Added memory should be 8192 bytes and remaining growth should still be zero.",
    takeaway:
      "Releasing memory changes both the process boundary and, when appropriate, its page mappings.",
    reflection:
      "Why is retaining a pointer value different from retaining permission to access that memory?",
    contextTitle: "Read shrinking and unmapping",
    contextFiles: ["kernel/proc.c", "kernel/vm.c"],
    expected: "added=4096 remaining=0",
  }),
  "a-user-fault-is-contained": lesson({
    title: "A user fault is contained",
    goal: "See a bad user access end the child while its parent survives.",
    expectedFault: true,
    editorHeight: 660,
    starter: () =>
      program(
        forkCheck +
          "  if (child == 0) {\n" +
          allocation()
            .split("\n")
            .map((s) => "  " + s)
            .join("\n") +
          '    p[0] = 17;\n    sbrk(-4096);\n    volatile char *probe = p;\n    printf("child read=%d\\n", *probe);\n    exit(0);\n  }\n  int status = 0;\n  wait(&status);\n  printf("parent survived; child status=%d\\n", status);',
      ),
    reading: `<p>A user program cannot use an unmapped page merely because it still has the old address. A CPU access without a valid mapping causes a <strong>page fault</strong>, which transfers control to the kernel.</p><p>This example confines a deliberately invalid read to a child. The child allocates a page, releases it, then uses a <code>volatile</code> pointer to request a real read from the released address. The parent waits and reports the outcome.</p><p>In this xv6 version, the unhandled user fault marks that process as killed and ends it with status <code>-1</code>. The parent and operating system continue. The diagnostic is expected here; it is not evidence that the whole kernel crashed.</p>`,
    excerpt: {
      file: "kernel/trap.c",
      within: "usertrap(void)",
      anchor: 'printf("usertrap(): unexpected scause',
      after: 6,
    },
    sourceNote:
      "The trap handler records the fault, marks the current process killed, and calls exit(-1). The parent can collect that child through the ordinary wait path.",
    assignment:
      "In the child branch, remove sbrk(-4096);. Choose Build & run again. Find child read=17 and parent survived; child status=0 in the console. Why can the child complete this time?",
    takeaway:
      "Page mappings enforce a boundary. A user fault can end one process without ending the OS.",
    reflection:
      "Why does doing the invalid experiment in a child let the parent explain what happened afterwards?",
    contextTitle: "Read fault handling and exit",
    contextFiles: ["kernel/trap.c", "kernel/proc.c", "kernel/vm.c"],
    expected: "parent survived; child status=-1",
  }),
  "the-kernel-checks-user-pointers": lesson({
    title: "The kernel checks user pointers",
    goal: "Distinguish a checked syscall copy from a direct invalid user load.",
    starter: () =>
      program(
        '  int n = write(1, (char*)0x40000000, 4);\n  printf("write copied=%d\\n", n);\n  printf("process still running\\n");',
      ),
    reading: `<p>A system call can receive a pointer without directly trusting it as a kernel address. xv6’s copy helpers translate user addresses through the calling process’s page table and reject an unmapped address.</p><p>The example asks the console to write four bytes from a deliberately unmapped user address. It does not dereference that pointer in user code. The kernel’s copy fails before it obtains a byte.</p><p>For this pinned xv6 console, <code>consolewrite</code> stops at that failed copy and returns the number of bytes sent: <code>0</code>. The caller remains alive. Other operations can report failure differently, so read the actual path rather than assuming a universal return value.</p>`,
    excerpt: {
      file: "kernel/console.c",
      anchor: "consolewrite(int user_src",
      before: 1,
      until: "\n}",
    },
    sourceNote:
      "either_copyin returns -1 for a failed user copy. consolewrite breaks its loop and returns i, the byte count. Here that converts a failed first copy into a zero-byte console write.",
    assignment:
      "In write, replace (char*)0x40000000 with \"safe\", keeping the count at 4. Choose Build & run again. Find safe immediately before write copied=4. Compare the byte count and process still running with the starter.",
    takeaway:
      "A kernel copy validates the user mapping and reports its outcome through the syscall’s own interface.",
    reflection:
      "Why can a checked syscall copy return to the caller when the direct load on the previous page ended the child?",
    contextTitle: "Follow the checked copy",
    contextFiles: ["kernel/console.c", "kernel/vm.c", "kernel/sysfile.c"],
    expected: "write copied=0",
  }),
};
