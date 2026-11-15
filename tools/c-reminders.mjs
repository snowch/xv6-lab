// Build-time C refreshers: each lesson keeps its explanation locally and links to
// the exact C Foundry topic only when a learner wants a longer refresher.
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const base = "https://snowch.github.io/c-foundry/#/chapter/";
const topics = {
  doWhile: {
    title: "a loop that checks after its body",
    text: "do ... while runs its body at least once, then repeats while the condition is nonzero. Here each iteration stores a fresh counter sample in after. The semicolon after while is part of this C syntax; the comparison == tests equality without assigning.",
    code: "do {\n  after = uptime();\n} while (after == before);",
    links: [["Loops and repetition", "control-flow/3"]],
  },
  kernelStatic: {
    title: "static state shared by callbacks",
    text: "A file-scope static variable has one storage location for this compiled kernel unit and starts at zero. Its value persists between function calls in this VM, so a probe can arm an interrupt observer and later disarm it. An ordinary local variable is separate for each call. A fresh VM resets this state independently of the source draft saved in your browser.",
    code: "static int watching;\nwatching = !watching;  // toggle between 0 and 1",
    links: [
      ["Scope and storage duration", "functions/3"],
      ["Variables and initialisation", "values/2"],
    ],
  },
  devicePointer: {
    title: "a pointer to volatile bytes",
    text: "volatile unsigned char *reg points at a byte whose accesses the compiler must preserve. *reg reads that byte; the pointer cast alone performs no read. The address and the kernel’s mappings give it its device meaning. volatile does not create a mapping, grant permission or provide a lock.",
    code: "volatile unsigned char *reg = (volatile unsigned char*)address;\nint bits = *reg & 3;",
    links: [
      ["Addresses and dereferencing", "pointers/1"],
      ["Conversions and casts", "values/4"],
    ],
  },
  ringIndex: {
    title: "remainder and array indices",
    text: "The % operator gives the remainder. For a nonnegative counter, counter % 32 selects an index from 0 to 31 in a 32-element array. The counter itself can keep increasing while the selected array slot wraps around. A character constant such as '@' has an integer character-code value.",
    code: "int slot = counter % 32;\nbuffer[slot] = c;",
    links: [
      ["Operators and precedence", "values/3"],
      ["Array indexing and bounds", "arrays-strings/1"],
    ],
  },
  keyArray: {
    title: "an array of character codes",
    text: "An int array can hold printable character codes and numeric control codes. '\\n' is one newline character; 0x15 is hexadecimal for decimal 21. The array’s length comes from its initializer here, and index 0 names its first element. This is a sequence of integer codes, rather than a zero-terminated string.",
    code: "int keys[] = {'a', 0x15, 'b', '\\n'};",
    links: [
      ["Array indexing and bounds", "arrays-strings/1"],
      ["Values and character types", "values/1"],
    ],
  },
  integerOutput: {
    title: "writing through an output pointer",
    text: "An int * parameter holds the address of an integer owned by the caller. Assigning to *ip writes that integer. The function’s return value is separate: returning 0 can report success while the decoded number is delivered through the pointer.",
    code: "int fill(int *out) {\n  *out = 7;\n  return 0;\n}",
    links: [
      ["Pointers as function arguments", "pointers/2"],
      ["Parameters and results", "functions/1"],
    ],
  },
  functionTable: {
    title: "function pointers and conditional selection",
    text: "A function pointer names callable code. In uint64 (*table[N])(void), table is an array of N pointers to functions taking no arguments and returning uint64. table[index]() calls the selected function. condition ? yes : no chooses one value without evaluating the other branch.",
    code: "int selected = condition ? first : second;\nuint64 result = table[selected]();",
    links: [
      ["Function pointers and callbacks", "larger-programs/4"],
      ["Expressions and operators", "values/3"],
    ],
  },
  bitAssignment: {
    title: "setting and clearing flag bits",
    text: "x |= flag sets the selected bits while preserving others. x &= ~flag clears those bits: ~ complements the mask, then & keeps the remaining bits. The compound assignments update x; a comparison such as (x & flag) == 0 only reads it.",
    code: "x &= ~flag;  // clear\nx |= flag;   // set",
    links: [["Bitwise operations and masks", "files-bytes/2"]],
  },
  conditionalValue: {
    title: "a conditional expression",
    text: "condition ? a : b evaluates the condition and then just one of the two alternatives. Its result is a value. Parentheses can make that selection easier to read inside an assignment or array index. This differs from if, which chooses statements to execute.",
    code: "int step = is_getpid ? lab_advance : 4;\npc += step;",
    links: [
      ["Expressions and operators", "values/3"],
      ["Conditions and branches", "control-flow/1"],
    ],
  },
  addressBits: {
    title: "extracting fields with shifts and masks",
    text: "Right shift discards low bits, and bitwise & keeps the bits selected by a mask. 0x1ff has nine low bits set; 4095 has twelve. A cast to int makes these small extracted values suitable for printf’s %d argument.",
    code: "int index = (int)((va >> 12) & 0x1ff);\nint offset = (int)(va & 4095);",
    links: [
      ["Bitwise operations and masks", "files-bytes/2"],
      ["Conversions and casts", "values/4"],
    ],
  },
  tableIndex: {
    title: "array entries versus their addresses",
    text: "table[index] reads an entry through a pointer. &table[index] instead gives the address of that entry, so a function can return it or change it. p->pagetable first reads a member of the process struct; that member’s value is itself a pointer to a table.",
    code: "pte_t value = table[index];\npte_t *address = &table[index];",
    links: [
      ["Arrays and pointers", "pointers/3"],
      ["Pointers to structs", "structured-data/4"],
    ],
  },
  pteBits: {
    title: "bit masks and short-circuit checks",
    text: "The bitwise & operator selects flag bits. A selected flag can have a value such as 16, so compare with zero when you want a printed 0 or 1. Logical && evaluates its right side only if the left side is true; entry && (*entry & PTE_V) therefore avoids dereferencing a null pointer.",
    code: "int user = (flags & PTE_U) != 0;\nint valid = entry && (*entry & PTE_V);",
    links: [
      ["Bitwise operations and masks", "files-bytes/2"],
      ["Expressions and operators", "values/3"],
    ],
  },
  volatileRead: {
    title: "casts, dereferences and volatile",
    text: "The cast converts an address value to a pointer type. The leading * then performs the memory access. volatile requires this read to occur, but it does not grant permission to the address or make an invalid access valid. The experiment confines that deliberate access to a child process.",
    code: "volatile char value = *(volatile char*)address;",
    links: [
      ["Addresses and dereferencing", "pointers/1"],
      ["Conversions and casts", "values/4"],
    ],
  },
  copyDestination: {
    title: "a destination passed by address",
    text: "&byte supplies the address of the kernel’s local variable, letting copyin write into it. The function’s returned integer is a separate result. Check that result before treating the destination as successfully filled; an initialized local value alone does not prove the copy succeeded.",
    code: "char byte = 0;\nint result = copyin(table, &byte, source, 1);",
    links: [["Pointers as function arguments", "pointers/2"]],
  },
  arraySeed: {
    title: "array initializers and comparisons",
    text: "char bytes[2] reserves two elements, indexed 0 and 1. The initializer gives each the value 7, so later comparisons can detect which elements changed. != compares values; it does not assign. These are raw bytes, with no C-string terminator implied.",
    code: "char bytes[2] = {7, 7};\nint changed = bytes[0] != 7;",
    links: [
      ["Array indexing and bounds", "arrays-strings/1"],
      ["Conditions and comparisons", "control-flow/1"],
    ],
  },
  addressInteger: {
    title: "addresses and integer casts",
    text: "In this RV64 kernel, uint64 holds 64-bit values, including its address values. The cast converts a pointer to that integer type for a byte-offset calculation. Adding 4096 to this integer advances by 4096 bytes; adding to a typed pointer would instead count its element size. This calculation does not allocate storage or change the CPU’s stack pointer.",
    code: "uint64 base = (uint64)stack0;\nuint64 top = base + 4096;\nint offset = (int)(top - base);",
    links: [
      ["Addresses and pointer arithmetic", "pointers/3"],
      ["Conversions and casts", "values/4"],
    ],
  },
  bits: {
    title: "shifts, masks and casts",
    text: "Right-shifting an unsigned 64-bit value moves its high bits down. A mask selects particular bits; a cast converts the resulting value to the requested C type. Here shifting by 60 extracts the top four mode bits, then the int cast supplies printf’s %d argument.",
    code: "int mode = (int)(value >> 60);",
    links: [
      ["Bitwise operations and masks", "files-bytes/2"],
      ["Conversions and casts", "values/4"],
    ],
  },
  ownership: {
    title: "allocated memory and lifetime",
    text: "A successful allocation gives you a pointer to live storage. Test for failure before dereferencing it. Releasing the allocation ends your right to use those bytes; a pointer variable can still hold the old address afterwards. xv6’s kalloc and kfree are kernel interfaces introduced in this lesson.",
    code: "char *page = kalloc();\nif (page != 0) {\n  page[0] = 65;\n  kfree(page);\n}",
    links: [
      ["Allocation and storage", "allocation/1"],
      ["Dangling pointers and lifetime", "allocation/4"],
    ],
  },
  basics: {
    title: "reading a small C program",
    text: "main is the program’s entry function. Statements end with semicolons, and braces group a function or branch body. In printf, %d formats an integer and \\n starts a new line.",
    code: 'int n = 3;\nprintf("n=%d\\n", n);',
    links: [
      ["Program structure", "first-program/2"],
      ["Printing with printf", "first-program/3"],
    ],
  },
  calls: {
    title: "arguments and return values",
    text: "A call such as f(x) passes an argument to a function. return supplies its result. In a nested call, the inner result becomes an argument to the outer call; assigning the result to a variable can make that easier to read.",
    code: 'int pid = getpid();\nprintf("reported pid=%d\\n", pid);',
    links: [["Parameters and return values", "functions/1"]],
  },
  prototypes: {
    title: "function declarations",
    text: "A declaration tells the compiler a function’s name, parameter types and result type. void inside the parameter list means no arguments. The declaration describes how to call the function; its implementation can live elsewhere.",
    code: "int getpid(void);  // no arguments; returns an int",
    links: [["Parameters, return values and prototypes", "functions/1"]],
  },
  strings: {
    title: "strings and byte counts",
    text: "A C string is a character array ending with a zero byte. The newline escape \\n is one byte. A byte-counted write uses the count you pass; it does not search for the string terminator.",
    code: 'char text[] = "hello\\n";\n// Six message bytes, followed by one zero terminator.',
    links: [["Character arrays and zero termination", "arrays-strings/2"]],
  },
  structPointer: {
    title: "pointers and the -> operator",
    text: "For a pointer p to a struct, p->pid means (*p).pid: follow the pointer, then read its pid member. Use the dot operator with a struct value itself. Reading a member and assigning to it are different operations.",
    code: "p->pid        // read a member through a pointer\np->pid = 7;   // assign a new member value",
    links: [
      ["Pointers to structs", "structured-data/4"],
      ["Addresses and dereferencing", "pointers/1"],
    ],
  },
  branches: {
    title: "comparisons and branches",
    text: "== compares two values; = assigns a value. if chooses a branch when its condition is nonzero. A test for a negative result is separate from a test for zero, which matters when an interface uses different outcomes for each.",
    code: "if (child < 0) { /* creation failed */ }\nif (child == 0) { /* child’s path */ }",
    links: [["Conditions and branches", "control-flow/1"]],
  },
  address: {
    title: "addresses passed to functions",
    text: "&status gives the address of the caller’s variable, so a function can write a result there. The function’s return value is a separate result. A zero used as a pointer argument is a null pointer; wait(0) supplies no status address.",
    code: "int status = 0;\nint pid = wait(&status);",
    links: [["Pointers as function arguments", "pointers/2"]],
  },
  byteAddress: {
    title: "passing a variable’s address",
    text: "&ch supplies the address of a char variable so read can fill that byte in the caller. The return value separately reports how many bytes were read. Use a count of one for this single-char destination; a larger count would run past it.",
    code: "char ch = 0;\nint n = read(fd, &ch, 1);",
    links: [["Pointers as function arguments", "pointers/2"]],
  },
  values: {
    title: "variables and assignment",
    text: "A declaration such as int value = 7 creates and initialises a variable. A later assignment changes that variable’s value. The braces show which branch contains the assignment; they are important when following parent and child paths.",
    code: "int value = 7;\nif (child == 0) { value = 99; }",
    links: [
      ["Variables and initialisation", "values/2"],
      ["Conditions and branches", "control-flow/1"],
    ],
  },
  arguments: {
    title: "arrays of string pointers",
    text: "args is an array whose elements point to strings. The final 0 is a null pointer marking the end of the argument list. Each string also has its own zero-byte terminator; these are two different uses of zero.",
    code: 'char *args[] = {"echo", "hello", 0};',
    links: [
      ["Arrays and pointer arithmetic", "pointers/3"],
      ["Character strings", "arrays-strings/2"],
    ],
  },
  arithmetic: {
    title: "pointer arithmetic and indexing",
    text: "p[i] means *(p + i). Adding one to a char pointer advances one byte; other pointer types advance by their element size. Keep accesses within the live allocated region. Moving a pointer does not allocate more memory.",
    code: "char *next = p + 1;  // the next char address\np[0] = 17;           // write through the pointer",
    links: [["Arrays, pointers and pointer arithmetic", "pointers/3"]],
  },
  loops: {
    title: "loops and bounds",
    text: "The initialiser runs once, the condition is checked before each iteration, and i++ advances the index afterwards. With i < count, the visited indices are 0 through count - 1. The array must have enough elements for those accesses.",
    code: "for (int i = 0; i < count; i++) {\n  /* use element i */\n}",
    links: [
      ["Loops and repetition", "control-flow/3"],
      ["Array indexing and bounds", "arrays-strings/1"],
    ],
  },
  lifetime: {
    title: "pointer values and memory lifetime",
    text: "A pointer can keep an address after the memory it referred to has been released. Retaining the value does not keep that allocation alive. The fault lesson deliberately makes an invalid access in a child; volatile does not make that address valid again.",
    code: "char *saved = p;\n// Releasing p’s allocation does not clear saved.",
    links: [["Dangling pointers and memory lifetime", "allocation/4"]],
  },
  checkedPointer: {
    title: "a pointer argument versus a dereference",
    text: "Casting an integer to a pointer creates an address value; dereferencing it would request access to memory. Passing that value as an argument lets the called interface inspect it. The syscall’s result is determined by xv6’s checked-copy path, which this lesson explains.",
    code: "write(1, (char*)0x40000000, 4);\n// This call passes a pointer; it does not load *pointer in user C.",
    links: [
      ["Addresses and dereferencing", "pointers/1"],
      ["Pointers as arguments", "pointers/2"],
    ],
  },
  flags: {
    title: "headers and flag bits",
    text: "#include makes declarations and constants available to the compiler. The | operator combines flag bits. It differs from ||, which evaluates a logical condition. xv6 defines the meanings of these particular open flags in its own header.",
    code: "O_CREATE | O_RDWR | O_TRUNC",
    links: [
      ["Bitwise operations and masks", "files-bytes/2"],
      ["Headers and compilation", "larger-programs/1"],
    ],
  },
  buffer: {
    title: "buffers and string terminators",
    text: "The array has six char elements, initially all zero. Reading at most five bytes leaves the final element zero, so the displayed text remains terminated. read reports bytes obtained; it does not append a C string terminator for you.",
    code: "char buf[6] = {0};\nint n = read(fd, buf, 5);",
    links: [
      ["Array bounds", "arrays-strings/1"],
      ["Character arrays and zero termination", "arrays-strings/2"],
    ],
  },
  structValue: {
    title: "struct members and output arguments",
    text: "The dot operator reads a member of a struct value. &st passes its address so fstat can fill it. Check that the call succeeded before reading those fields; declaring a local struct alone does not initialise its contents.",
    code: 'struct stat st;\nif (fstat(fd, &st) == 0)\n  printf("links=%d\\n", st.nlink);',
    links: [
      ["Structs and member access", "structured-data/1"],
      ["Pointers as function arguments", "pointers/2"],
    ],
  },
  storage: {
    title: "array storage and compile-time sizes",
    text: "enum supplies an integer constant usable as an array size. A static local array has storage lasting for the process, rather than living in this function’s call stack. static does not make user memory shared between separate processes or preserve it across a fresh run.",
    code: "enum { N = 6000 };\nstatic char data[N];",
    links: [
      ["Scope and storage duration", "functions/3"],
      ["Stack and heap storage", "allocation/1"],
    ],
  },
  descriptors: {
    title: "arrays used as output arguments",
    text: "int p[2] reserves two integer elements. Passing p to pipe supplies the array’s starting address, so the function can fill p[0] and p[1]. They are integer handles, not pointers to the pipe’s bytes.",
    code: "int p[2];\nif (pipe(p) == 0) { /* use p[0] and p[1] */ }",
    links: [
      ["Arrays and pointers", "pointers/3"],
      ["Pointers as function arguments", "pointers/2"],
    ],
  },
  readLoop: {
    title: "assignment inside a loop condition",
    text: "The parenthesised assignment first stores the read result in n. The > 0 comparison then decides whether to enter the loop. Use only the n bytes actually returned; a request for a larger count does not promise that many bytes arrived.",
    code: "while ((n = read(fd, buf, sizeof(buf))) > 0) {\n  /* consume buf[0] through buf[n - 1] */\n}",
    links: [
      ["while and for loops", "control-flow/3"],
      ["Expressions and precedence", "values/3"],
    ],
  },
};
const map = {
  "virtio-descriptors-name-device-buffers":"structPointer",
  "timer-interrupts-advance-kernel-ticks": "doWhile",
  "masking-supervisor-interrupts": "calls",
  "claiming-and-completing-device-interrupts": "kernelStatic",
  "uart-registers-are-memory-mapped": "devicePointer",
  "uart-output-passes-through-a-ring": "ringIndex",
  "the-console-edits-and-commits-lines": "keyArray",
  "disk-completion-precedes-cache-validity": "structPointer",
  "a-trapframe-saves-user-registers": "structPointer",
  "a-trap-cause-selects-the-path": "pteBits",
  "ecall-must-advance-the-return-pc": "conditionalValue",
  "dispatch-chooses-a-kernel-handler": "functionTable",
  "arguments-come-from-saved-registers": "integerOutput",
  "returning-to-user-mode": "bitAssignment",
  "splitting-a-virtual-address": "addressBits",
  "walking-three-page-table-levels": "tableIndex",
  "reading-page-permissions": "pteBits",
  "kernel-mappings-include-devices": "addressBits",
  "a-guard-page-denies-user-access": "volatileRead",
  "trampoline-mappings-cross-address-spaces": "pteBits",
  "checked-copies-translate-user-addresses": "copyDestination",
  "copies-check-each-page": "arraySeed",
  "editing-the-kernel-boot": "basics",
  "boot-needs-a-stack": "addressInteger",
  "boot-turns-on-paging": "bits",
  "boot-prepares-physical-pages": "ownership",
  "initialization-is-not-execution": "loops",
  "boot-creates-the-first-user-process": "loops",
  "running-a-program": "basics",
  "writing-bytes": "strings",
  "a-system-call-result": "calls",
  "entering-the-kernel": "prototypes",
  "the-current-process": "structPointer",
  "changing-the-answer": "structPointer",
  "fork-creates-a-child": "branches",
  "waiting-for-a-child": "address",
  "a-childs-exit-status": "address",
  "fork-copies-memory": "values",
  "exec-replaces-the-program": "arguments",
  "when-exec-fails": "calls",
  "growing-user-memory": "arithmetic",
  "memory-is-mapped-in-pages": "arithmetic",
  "new-pages-start-at-zero": "loops",
  "shrinking-user-memory": "lifetime",
  "a-user-fault-is-contained": "lifetime",
  "the-kernel-checks-user-pointers": "checkedPointer",
  "opening-and-closing-files": "flags",
  "reads-advance-the-file-offset": "buffer",
  "dup-shares-the-open-file": "byteAddress",
  "unlink-keeps-open-files-alive": "buffer",
  "two-names-one-inode": "structValue",
  "writes-pass-through-the-log": "storage",
  "a-pipe-connects-two-descriptors": "descriptors",
  "eof-needs-closed-writers": "buffer",
  "fork-inherits-pipe-ends": "descriptors",
  "pipes-are-byte-streams": "buffer",
  "a-pipe-reader-can-block": "byteAddress",
  "redirecting-output-through-a-pipe": "readLoop",
  "sleep-counts-guest-ticks": "calls",
  "runnable-processes-take-turns": "loops",
  "waiting-is-a-process-state": "address",
  "wakeup-makes-a-process-runnable": "structPointer",
  "killing-a-sleeping-process": "branches",
  "locks-protect-shared-kernel-state": "readLoop",
};
const link = ([title, route]) =>
  `<a href="${base + route}" target="_blank" rel="noopener noreferrer">${escape(title)} <span class="new-tab-label">(new tab)</span></a>`;
export function renderReminder(id) {
  const topic = topics[map[id]];
  if (!topic) throw new Error("Missing C reminder for lesson: " + id);
  return `<details class="c-reminder"><summary>C reminder: ${escape(topic.title)}</summary><div class="c-reminder-content"><p>${escape(topic.text)}</p><pre translate="no"><code>${escape(topic.code)}</code></pre><p class="c-refresher-links">Refresh in C Foundry: ${topic.links.map(link).join(" · ")}</p></div></details>`;
}
export const prerequisiteSection = `<section id="c-prerequisites" class="c-prerequisites" aria-labelledby="c-prerequisites-title"><h2 id="c-prerequisites-title">C you’ll need</h2><p>You should be comfortable reading small C programs: variables, conditions, loops, function calls and return values.</p><p>New to C or feeling rusty? Use these focused C Foundry refreshers: ${link(["Program structure", "first-program/2"])}, ${link(["Conditions", "control-flow/1"])}, ${link(["Loops", "control-flow/3"])} and ${link(["Functions", "functions/1"])}.</p><p>Short, expandable <strong>C reminders</strong> explain pointers, arrays and structs where the lessons use them, with optional links for more practice. Read the reminder here to keep your place in the lab.</p><p class="c-interface-note">xv6 uses its own headers and system calls. We introduce those interfaces here; C Foundry’s standard-library file functions are not a prerequisite.</p></section>`;
