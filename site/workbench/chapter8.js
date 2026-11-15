import { lesson, program, forkCheck } from "./lesson-helpers.js?v=chapter7";
const context = {
  target: "sys_getpid",
  file: "kernel/sysproc.c",
  offset: 20,
  headers: ["kernel/memlayout.h"],
  constants: [
    "PGSIZE",
    "PGROUNDDOWN",
    "PGROUNDUP",
    "MAXVA",
    "PX",
    "PTE_V",
    "PTE_R",
    "PTE_W",
    "PTE_X",
    "PTE_U",
    "PTE2PA",
  ],
  functions: ["copyin", "copyout", "walkaddr"],
  globals:
    "extern pagetable_t kernel_pagetable;\npte_t *walk(pagetable_t, uint64, int);",
};
const inspect = (body) =>
  "uint64\nsys_getpid(void)\n{\n  struct proc *p = myproc();\n" +
  body +
  "\n  return p->pid;\n}\n";
const vmLesson = (details) =>
  lesson({
    mode: "kernel",
    file: "kernel/sysproc.c",
    offset: 20,
    build: context,
    editorHeight: 620,
    contextTitle: "Read translation and mapping source",
    contextFiles: [
      "kernel/vm.c",
      "kernel/riscv.h",
      "kernel/memlayout.h",
      "kernel/proc.c",
    ],
    ...details,
  });
export const chapter8Lessons = {
  "splitting-a-virtual-address": vmLesson({
    title: "A virtual address selects indices and an offset",
    goal: "Split an address into the fields used by Sv39 translation.",
    starter: () =>
      inspect(
        '  uint64 va = 0x12345678;\n  printf("vpn=%d/%d/%d offset=%d\\n", (int)PX(2, va), (int)PX(1, va), (int)PX(0, va), (int)(va & (PGSIZE - 1)));',
      ),
    reading: `<p>A virtual address is not a physical RAM address. Under Sv39, its low 12 bits select a byte within a 4096-byte page. Three fields of nine bits select entries in three levels of page tables. Nine bits select one of 512 entries.</p><p>The <code>PX(level, va)</code> macro extracts an index by shifting and masking. The chosen address is a number for this calculation; this first experiment does <em>not</em> claim that it is mapped. Build and find indices 0, 145 and 325, with byte offset 1656.</p><p>xv6 uses the lower positive half of the Sv39 address range, below MAXVA, to avoid sign-extension complications. We follow its ordinary 4 KiB mappings here. In these lessons, the edited getpid handler is a temporary inspection hook: the supplied user program calls it, the handler prints its observations, then returns the real PID unless the lesson explicitly changes that result.</p>`,
    excerpt: { file: "kernel/riscv.h", anchor: "#define PXMASK", after: 8 },
    sourceNote:
      "PXSHIFT accounts for the 12-bit page offset and nine bits per level. The mask keeps exactly nine index bits. MAXVA is xv6’s chosen limit, rather than a statement that Sv39 has only 38 address bits.",
    assignment:
      "Change va from 0x12345678 to 0x12346678, one page higher. Build and run. The level-0 index should become 326 while the other indices and the byte offset stay the same.",
    takeaway:
      "Translation uses page-number fields; the byte offset is carried through to the selected physical page.",
    reflection:
      "Why does adding a whole page preserve the offset within a page?",
    expected: "vpn=0/145/325 offset=1656",
  }),
  "walking-three-page-table-levels": vmLesson({
    title: "A page-table walk follows physical page addresses",
    goal: "Read the real entries along a mapped user address’s translation path.",
    starter: () =>
      inspect(
        '  uint64 va = 0;\n  pagetable_t table = p->pagetable;\n  for (int level = 2; level >= 0; level--) {\n    int index = PX(level, va);\n    pte_t entry = table[index];\n    printf("level=%d index=%d valid=%d\\n", level, index, (entry & PTE_V) != 0);\n    if (!(entry & PTE_V)) break;\n    if (entry & (PTE_R | PTE_W | PTE_X)) break;\n    table = (pagetable_t)PTE2PA(entry);\n  }',
      ),
    reading: `<p>The process record points to its top-level page table. A valid <strong>branch entry</strong> identifies the physical page containing the next table. A <strong>leaf entry</strong> identifies the physical page containing the program’s bytes and carries access permissions.</p><p>The observation follows the same indices and PTE2PA conversion used by walk, reading actual entries without allocating anything. A set V bit marks a valid entry. R, W or X marks a leaf; an intermediate entry has V set without those permission bits.</p><p>Address 0 contains the supplied program’s code. Build and expect valid entries at levels 2, 1 and 0. The kernel can read the table pages through its direct mapping of physical RAM. A missing intermediate entry would stop this read-only inspection; walk’s alloc argument separately controls whether the real kernel routine may create missing tables.</p>`,
    excerpt: {
      file: "kernel/vm.c",
      within: "walk(pagetable_t",
      anchor: "for(int level = 2;",
      after: 13,
    },
    sourceNote:
      "walk follows two intermediate tables, optionally allocating missing pages, then returns the address of the level-0 PTE. Returning a PTE address does not itself guarantee that the leaf is valid.",
    assignment:
      "Change va from 0 to PGSIZE. Build and run. This program has another mapped code page, so the leaf report should become level=0 index=1 valid=1. The intermediate indices remain zero.",
    takeaway:
      "A walk follows entries stored in real memory; a valid branch and a valid leaf play different roles.",
    reflection:
      "Why must a read-only inspector check V before following the address in an entry?",
    expected: "level=0 index=0 valid=1",
  }),
  "reading-page-permissions": vmLesson({
    title: "A valid mapping still has access permissions",
    goal: "Distinguish validity, user access, writability and executability in actual PTEs.",
    starter: () =>
      inspect(
        '  pagetable_t table = p->pagetable;\n  uint64 va = 0;\n  pte_t *entry = walk(table, va, 0);\n  if (entry == 0 || !(*entry & PTE_V)) return -1;\n  printf("user=%d writable=%d executable=%d\\n", (*entry & PTE_U) != 0, (*entry & PTE_W) != 0, (*entry & PTE_X) != 0);',
      ),
    reading: `<p>V says a PTE is valid. U permits user-mode access; W permits writes; X permits instruction fetch. These are separate questions. A valid supervisor mapping can exist in a process’s page table without granting that process user-mode access to it.</p><p>The default query examines address 0 in the current user page table. This pinned xv6 allocates ordinary user pages with R, W, X and U set. Build and observe user=1, writable=1 and executable=1. Those are this implementation’s actual permissions.</p><p>The kernel’s own text mapping instead allows reads and instruction fetch, while excluding writes and user access. Change the table and address together to inspect that mapping. The experiment reads permission bits; the guard-page lesson later tests a denied access with actual user execution.</p>`,
    excerpt: {
      file: "kernel/vm.c",
      within: "uvmalloc(pagetable_t",
      anchor: "mappages(pagetable, a, PGSIZE",
      before: 2,
      after: 4,
    },
    sourceNote:
      "uvmalloc supplies PTE_W | PTE_X | PTE_R | PTE_U for these user pages. Kernel text receives PTE_R | PTE_X in kvmmake instead.",
    assignment:
      "Replace p->pagetable with kernel_pagetable in the table initializer, and change va from 0 to KERNBASE. Build and run. The kernel text mapping should report user=0 writable=0 executable=1.",
    takeaway:
      "Validity identifies a translation; permission bits determine which kinds of access that translation allows.",
    reflection:
      "Why does a valid PTE with U cleared not grant user access even if R and W are set?",
    expected: "user=1 writable=1 executable=1",
  }),
  "kernel-mappings-include-devices": vmLesson({
    title: "The kernel maps RAM and device registers",
    goal: "Observe an identity mapping and distinguish executable text from device memory.",
    starter: () =>
      inspect(
        '  uint64 va = KERNBASE;\n  pte_t *entry = walk(kernel_pagetable, va, 0);\n  if (entry == 0 || !(*entry & PTE_V)) return -1;\n  uint64 pa = PTE2PA(*entry) + (va & (PGSIZE - 1));\n  printf("identity=%d writable=%d executable=%d\\n", pa == va, (*entry & PTE_W) != 0, (*entry & PTE_X) != 0);',
      ),
    reading: `<p>A kernel often needs stable access to physical RAM and device registers. xv6 directly maps its kernel RAM: a virtual address in that region translates to the same numerical physical address. This is an <strong>identity mapping</strong>, not an absence of translation.</p><p>The kernel also maps memory-mapped I/O, or MMIO. Reads and writes at those physical addresses communicate with devices rather than ordinary RAM. UART0 names the console device’s register region. Merely reading its PTE does not access a UART register.</p><p>Build with KERNBASE. The mapping should be an identity mapping, read-only and executable. Then query UART0: it is also mapped at its physical address, but is writable and not executable. Other mappings, including the high trampoline, deliberately use different virtual and physical addresses.</p>`,
    excerpt: {
      file: "kernel/vm.c",
      within: "kvmmake(void)",
      anchor: "// uart registers",
      after: 17,
    },
    sourceNote:
      "kvmmake supplies separate permissions for devices, kernel text and data. satp still enables translation even where a mapping happens to preserve the numerical address.",
    assignment:
      "Change va from KERNBASE to UART0. Build and run. Expect identity=1 writable=1 executable=0. This queries the page-table entry; it does not read or write the device register itself.",
    takeaway:
      "One kernel address space can map RAM, executable code and device registers with different permissions.",
    reflection:
      "Why should a mapping used for device-register writes not also be executable?",
    expected: "identity=1 writable=0 executable=1",
  }),
  "a-guard-page-denies-user-access": vmLesson({
    title: "A guard page catches an invalid user access",
    goal: "Connect a cleared U bit with a real, contained user page fault.",
    editorHeight: 650,
    build: {
      ...context,
      probe: program(
        forkCheck +
          '  if (child == 0) {\n    volatile char value = *(volatile char*)(uint64)getpid();\n    (void)value;\n    printf("child read succeeded\\n");\n    exit(0);\n  }\n  int status = 0;\n  wait(&status);\n  printf("guard child status=%d\\n", status);',
      ),
    },
    starter: () =>
      'uint64\nsys_getpid(void)\n{\n  struct proc *p = myproc();\n  uint64 stack = PGROUNDDOWN(p->trapframe->sp);\n  uint64 guard = stack - PGSIZE;\n  pte_t *entry = walk(p->pagetable, guard, 0);\n  printf("guard valid=%d user=%d\\n", entry && (*entry & PTE_V), entry && (*entry & PTE_U));\n  return guard;\n}\n',
    reading: `<p>exec allocates two pages for the initial stack region and clears U on the lower page. That page remains backed by physical memory, but user-mode access is denied. It is a <strong>guard page</strong>, intended to catch a stack that grows beyond its allowed page.</p><p>This lesson deliberately changes getpid’s result into a lab address. The handler locates the guard page below the saved user stack pointer and reports its real V and U bits. The supplied test program forks a child, has it load a byte from the returned address, and lets the parent collect its status. The handler’s return value is no longer a PID in this experiment.</p><p>Build and find guard valid=1 user=0, a user page-fault report and child status -1. The parent and shell continue. Changing the returned address to the adjacent usable stack page lets the child complete. volatile ensures the test actually attempts its load; it does not make a protected address valid.</p>`,
    excerpt: {
      file: "kernel/exec.c",
      within: "exec(char *path",
      anchor: "uvmclear(pagetable, sz-2*PGSIZE);",
      before: 5,
      after: 8,
    },
    sourceNote:
      "uvmclear removes user permission from an allocated page. A guard fault therefore differs from an entirely missing translation, even though either can deny user access.",
    assignment:
      "Change return guard to return guard + PGSIZE. Build and run. The child should print child read succeeded, its collected status should be 0, and there should be no usertrap report.",
    takeaway:
      "A mapped page can still be inaccessible to user code; the CPU enforces the permissions when the load executes.",
    reflection:
      "Why does allocating physical memory for a guard page not make it safe for user code to access?",
    contextFiles: [
      "kernel/exec.c",
      "kernel/vm.c",
      "kernel/proc.h",
      "kernel/trap.c",
    ],
    expected: "guard child status=-1",
    expectedFault: true,
  }),
  "trampoline-mappings-cross-address-spaces": vmLesson({
    title: "The trampoline has a shared virtual location",
    goal: "Compare the actual trampoline and trapframe mappings across user and kernel page tables.",
    starter: () =>
      inspect(
        '  uint64 va = TRAMPOLINE;\n  pte_t *user = walk(p->pagetable, va, 0);\n  pte_t *kernel = walk(kernel_pagetable, va, 0);\n  int both = user && kernel && (*user & PTE_V) && (*kernel & PTE_V);\n  int same = both && PTE2PA(*user) == PTE2PA(*kernel);\n  printf("both mapped=%d same frame=%d user-access=%d\\n", both != 0, same, user && (*user & PTE_U));',
      ),
    reading: `<p>The <strong>trampoline</strong> is a page of assembly used when crossing between user and kernel execution. Its instructions have to remain reachable while the active page table changes. xv6 maps that page at the same high virtual address in both page tables, referring to the same physical code.</p><p>Build and compare the real entries: both should be valid, both should identify the same physical frame, and the user page table’s entry should have U cleared. The CPU uses this mapping while in supervisor mode; user programs cannot execute it directly.</p><p>The trapframe has a different arrangement. It is mapped just below the trampoline in the user page table, also without U. Under the kernel page table, the kernel accesses its physical allocation through the direct RAM mapping, rather than through the TRAPFRAME virtual address. The next chapter follows how the trampoline saves registers there.</p>`,
    excerpt: {
      file: "kernel/proc.c",
      within: "proc_pagetable(struct proc",
      anchor: "if(mappages(pagetable, TRAMPOLINE",
      after: 12,
    },
    sourceNote:
      "proc_pagetable maps the shared trampoline code and the current process’s own trapframe. Both exclude PTE_U; their presence in this page table does not make them user-accessible.",
    assignment:
      "Change va from TRAMPOLINE to TRAPFRAME. Build and run. Expect both mapped=0 same frame=0 user-access=0: the kernel does not map that virtual trapframe address, although it can access the frame through its direct physical mapping.",
    takeaway:
      "Crossing address spaces requires carefully chosen mappings; the same physical memory need not have the same virtual address everywhere.",
    reflection:
      "Why is a shared trampoline virtual address useful at the exact instruction that switches page tables?",
    expected: "both mapped=1 same frame=1 user-access=0",
  }),
  "checked-copies-translate-user-addresses": vmLesson({
    title: "The kernel translates user pointers before copying",
    goal: "Follow a checked user-memory copy through walkaddr and its U-bit check.",
    starter: () =>
      inspect(
        '  uint64 stack = PGROUNDDOWN(p->trapframe->sp);\n  uint64 guard = stack - PGSIZE;\n  uint64 source = guard;\n  char byte = 0;\n  int result = copyin(p->pagetable, &byte, source, 1);\n  printf("checked copy result=%d\\n", result);',
      ),
    reading: `<p>A user pointer names an address in the user page table. The kernel is running under a different page table, so treating that number as an ordinary kernel pointer would not perform the required user-address translation.</p><p>copyin rounds the source down to a page boundary, asks walkaddr for a permitted user translation, then copies through the physical page’s kernel mapping. walkaddr rejects invalid mappings and entries without U. copyout performs the reverse data transfer using the same translation helper.</p><p>The default copy targets the guard page. Build and expect -1 from copyin, with no usertrap report: this is a checked kernel operation returning an error, rather than a user instruction attempting a forbidden load. This pinned walkaddr checks V and U; its source does not add a separate W-bit check for copyout.</p>`,
    excerpt: {
      file: "kernel/vm.c",
      within: "walkaddr(pagetable_t",
      anchor: "pte = walk(pagetable, va, 0);",
      after: 10,
    },
    sourceNote:
      "walkaddr rejects a missing PTE, a clear V bit or a clear U bit, then returns the physical page address. copyin and copyout add the original offset and enforce their requested copy bounds.",
    assignment:
      "Change source = guard to source = guard + PGSIZE. Build and run. The source is now the usable stack page and checked copy result should become 0.",
    takeaway:
      "Checked-copy helpers interpret a pointer in the caller’s address space and report failure without relying on a user-mode fault.",
    reflection:
      "Why is a successful page-table lookup alone insufficient for copying from a user pointer?",
    expected: "checked copy result=-1",
  }),
  "copies-check-each-page": vmLesson({
    title: "A copy must check each page it crosses",
    goal: "Observe a checked copy stopping at an unmapped boundary after copying an initial byte.",
    starter: () =>
      inspect(
        '  uint64 source = PGROUNDUP(p->trapframe->sp) - 1;\n  char bytes[2] = {7, 7};\n  int result = copyin(p->pagetable, bytes, source, 2);\n  printf("boundary result=%d first changed=%d second unchanged=%d\\n", result, bytes[0] != 7, bytes[1] == 7);',
      ),
    reading: `<p>Adjacent virtual pages need not be adjacent physical pages, and the second page may not be mapped at all. copyin therefore copies at most the remaining bytes in one page, then translates the next virtual page before continuing.</p><p>The supplied program has not grown a heap. Its stack’s upper boundary is followed by an unmapped page. The source starts at the last byte of the stack and requests two bytes. Build and expect -1, with the second destination byte still equal to its initial value 7.</p><p>The first byte can already have been copied before the second page fails. A -1 return does not promise that the destination buffer is untouched. Callers must check the result and follow the interface’s error contract. The loop’s page-by-page work is also what lets successful copies span noncontiguous physical pages.</p>`,
    excerpt: {
      file: "kernel/vm.c",
      within: "copyin(pagetable_t",
      anchor: "while(len > 0)",
      after: 15,
    },
    sourceNote:
      "The loop clips n to the remainder of the current page, copies it, advances the addresses and decrements len. Each iteration performs a new walkaddr check.",
    assignment:
      "Change the final copyin count from 2 to 1. Build and run. Expect boundary result=0 first changed=1 second unchanged=1: the request now stays within the mapped stack page.",
    takeaway:
      "A checked memory copy validates every page it needs, and failure can occur after partial progress.",
    reflection:
      "Why can checking only the starting address fail to protect a multi-byte copy?",
    expected: "boundary result=-1 first changed=1 second unchanged=1",
  }),
};
