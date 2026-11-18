import {
  lesson,
  program,
  kernelFunction,
} from "./lesson-helpers.js?v=chapter7";
const k = (build, details) =>
  lesson({
    mode: "kernel",
    file: build.file,
    offset: build.offset,
    build,
    editorHeight: 680,
    contextTitle: "Read the interrupt and driver path",
    contextFiles: [
      "kernel/trap.c",
      "kernel/uart.c",
      "kernel/console.c",
      "kernel/virtio_disk.c",
      "kernel/plic.c",
    ],
   ...details,
  });
const getpid = (body) =>
  "uint64\nsys_getpid(void)\n{\n" + body + "\n  return myproc()->pid;\n}\n";
const ioProbe = program(
  '  getpid();\n  int fd = open("irqfile", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  write(fd, "D", 1);\n  close(fd);\n  printf("device operation finished\\n");\n  getpid();',
  { headers: ["kernel/fcntl.h"] },
);
const irqContext = {
  target: ["devintr", "sys_getpid"],
  file: "kernel/trap.c",
  offset: 176,
  headers: ["kernel/memlayout.h"],
  bridges: ["r_scause"],
  functions: [
    "plic_claim",
    "plic_complete",
    "uartintr",
    "virtio_disk_intr",
    "cpuid",
    "push_off",
    "pop_off",
  ],
  globals: "void clockintr(void);\nuint64 r_sip(void);\nvoid w_sip(uint64);",
  probe: ioProbe,
};
const completionContext = {
  target: "bread",
  file: "kernel/bio.c",
  offset: 92,
  headers: ["kernel/fs.h", "kernel/sleeplock.h", "kernel/buf.h"],
  functions: ["virtio_disk_rw", "strncmp"],
  globals: "struct buf *bget(uint, uint);",
  probe: program(
    '  int fd = open("driverio", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  write(fd, "D", 1);\n  close(fd);\n  fd = open("driverio", O_RDONLY);\n  char byte = 0;\n  read(fd, &byte, 1);\n  close(fd);\n  printf("disk byte=%c\\n", byte);',
    { headers: ["kernel/fcntl.h"] },
  ),
};
const completionTrace =
  '    if (myproc() && strncmp(myproc()->name, "workbench", 9) == 0)\n      printf("io complete=%d cache valid=%d\\n", b->disk == 0, b->valid);';
const descriptorContext = {
  target:["free_chain","sys_getpid"],file:"kernel/virtio_disk.c",offset:173,
  headers:["kernel/virtio.h"],functions:["push_off","pop_off"],
  globals:"struct virtq_desc *wb_disk_descriptors(void);\nvoid free_desc(int);",
  probe:ioProbe,
};
export const chapter10Lessons = {
  "timer-interrupts-advance-kernel-ticks": k(
    {
      target: "clockintr",
      file: "kernel/trap.c",
      offset: 162,
      functions: ["acquire", "wakeup", "release"],
      globals: "extern uint ticks;\nextern struct spinlock tickslock;",
      probe: program(
        '  int before = uptime(), after;\n  do { after = uptime(); } while (after == before);\n  printf("observed increment=%d\\n", after - before);',
      ),
    },
    {
      title: "Timer interrupts advance a kernel counter",
      goal: "Connect the machine timer path to xv6’s software tick counter.",
      editorHeight: 400,
      starter: (files) =>
        kernelFunction(files, "kernel/trap.c", "clockintr").replace(
          "ticks++;",
          "ticks += 1;",
        ),
      reading: `<p>A timer interrupt lets the OS regain control without a user program requesting a syscall. In this kernel, timerinit programs the machine timer. timervec handles that machine-mode interrupt, schedules the next one, and raises a supervisor software interrupt. devintr recognizes that forwarded event and calls clockintr.</p><p>The editable clockintr is the actual kernel routine: it updates ticks under tickslock and wakes processes waiting on that counter. The supplied user program samples uptime until the counter changes. With one runnable test program in this small fixture, observe an increment of 1.</p><p>Changing the increment changes logical kernel time, including what timed sleepers observe. It does not measure browser speed. General programs can miss counter updates between samples, so elapsed-time code should use bounds rather than assume every observed difference is exactly one tick.</p>`,
      excerpt: {
        file: "kernel/trap.c",
        within: "devintr()",
        anchor: "} else if(scause == 0x8000000000000001L)",
        after: 13,
      },
      sourceNote:
        "The machine timer forwards an event through SSIP. The supervisor acknowledges it by clearing that pending bit; clockintr separately maintains the OS counter and wakeups.",
      assignment:
        "Change ticks += 1 to ticks += 2. Choose Build & run again. This sampling fixture should now report observed increment=2. Restore the starter on this page to observe 1 again. Each lesson boots its own fresh image.",
      contextFiles: [
        "kernel/start.c",
        "kernel/kernelvec.S",
        "kernel/trap.c",
        "kernel/sysproc.c",
      ],
      takeaway:
        "Hardware timer delivery and the kernel’s logical tick count are connected by explicit interrupt-handling code.",
      reflection:
        "Why can a timer interrupt make progress even when a user program never calls sleep?",
      expected: "observed increment=1",
    },
  ),
  "masking-supervisor-interrupts": k(
    {
      target: "sys_getpid",
      file: "kernel/sysproc.c",
      offset: 20,
      bridges: ["intr_get", "intr_off", "intr_on"],
    },
    {
      title: "An enable bit controls supervisor interrupt delivery",
      goal: "Observe the supervisor interrupt-enable state around a bounded kernel probe.",
      editorHeight: 440,
      starter: () =>
        getpid(
          '  int before = intr_get();\n  intr_off();\n  int during = intr_get();\n  intr_on();\n  printf("interrupt enable before=%d during=%d after=%d\\n", before, during, intr_get());',
        ),
      reading: `<p>An interrupt source can be pending while delivery is masked. The supervisor SIE bit controls whether supervisor interrupts may interrupt supervisor execution. Masking delivery does not erase the device’s request, and machine-mode interrupts are a separate privilege level.</p><p>usertrap enables interrupts before calling a syscall handler, so this narrow probe begins with SIE set. intr_off clears it; intr_on sets it again. The probe reads SIE before, during and after masking.</p><p>This explicit off/on pair is suitable for this known starting state. General kernel critical sections need to preserve the previous state and handle nesting; xv6’s push_off/pop_off mechanism does that, and the locking chapter examines it. Enabling interrupts blindly is not a substitute for restoring the caller’s state.</p>`,
      excerpt: {
        file: "kernel/riscv.h",
        anchor: "intr_off()",
        before: 1,
        after: 12,
      },
      sourceNote:
        "intr_off clears SSTATUS_SIE, while intr_get reads that bit. The native helpers execute these same register operations for the browser C compiler.",
      assignment:
        "Replace the first intr_off() with intr_on(), leaving the final intr_on() in place. Choose Build & run again. During should become 1, showing that this edit no longer masks supervisor interrupts.",
      takeaway:
        "Masking is a CPU delivery policy; pending device state and interrupt-source configuration are separate concerns.",
      reflection:
        "Why would always calling intr_on at the end be wrong if a caller entered with interrupts disabled?",
      expected: "interrupt enable before=1 during=0 after=1",
    },
  ),
  "claiming-and-completing-device-interrupts": k(irqContext, {
    title: "The interrupt controller identifies a device",
    goal: "Observe real PLIC claims and completions for disk and UART interrupts.",
    editorHeight: 900,
    starter: (files) =>
      "static int watching;\nstatic int traces;\n#define WATCH_IRQ VIRTIO0_IRQ\n" +
      kernelFunction(files, "kernel/trap.c", "devintr")
       .replace(
          "    int irq = plic_claim();",
          '    int irq = plic_claim();\n    int show = watching && irq == WATCH_IRQ && traces < 2;\n    if (show) printf("claimed irq=%d\\n", irq);',
        )
       .replace(
          "      plic_complete(irq);",
          '      plic_complete(irq);\n    if (show) {\n      printf("completed irq=%d\\n", irq);\n      traces++;\n    }',
        ) +
      "\n// Lab hook: the supplied test arms observation, does I/O, then disarms it.\nuint64 sys_getpid(void)\n{\n  push_off();\n  watching = !watching;\n  pop_off();\n  return myproc()->pid;\n}\n",
    reading: `<p>A supervisor external interrupt says that some external source needs attention. The platform-level interrupt controller (PLIC) supplies the device ID through a <strong>claim</strong> operation. xv6 routes UART ID 10 to uartintr and VirtIO ID 1 to virtio_disk_intr. After servicing a nonzero claim, it writes a completion so that source can interrupt again.</p><p>This edited unit contains the real devintr and a small lab hook. The supplied program calls getpid to arm tracing, performs disk and console I/O, then calls it again to disarm before the shell prompt. Tracing is capped at two matched events, so observing UART interrupts cannot create an endless trace of its own output.</p><p>The trace prints the device ID returned by the controller and the one passed back after handling. The filter only selects which events to print.</p>`,
    excerpt: {
      file: "kernel/trap.c",
      within: "devintr()",
      anchor: "int irq = plic_claim();",
      after: 15,
    },
    sourceNote:
      "The device handler consumes or advances the device’s state. PLIC completion is a separate controller acknowledgement; it does not itself copy file data or console characters.",
    assignment:
      "Change WATCH_IRQ from VIRTIO0_IRQ to UART0_IRQ. Choose Build & run again. Expect claimed irq=10 and completed irq=10, followed by a normal shell prompt.",
    takeaway:
      "An external interrupt follows a controller protocol as well as a device-specific handling path.",
    reflection:
      "Why is returning from the C handler insufficient if the controller still considers the claim in progress?",
    expected: "completed irq=1",
  }),
  "uart-registers-are-memory-mapped": k(
    {
      target: "sys_getpid",
      file: "kernel/sysproc.c",
      offset: 20,
      headers: ["kernel/memlayout.h"],
    },
    {
      title: "A device register is accessed through an address",
      goal: "Read real UART configuration and status registers through MMIO.",
      editorHeight: 380,
      starter: () =>
        getpid(
          '  int offset = 3;\n  volatile unsigned char *reg = (volatile unsigned char*)(UART0 + offset);\n  printf("register low bits=%d\\n", *reg & 3);',
        ),
      reading: `<p>The kernel maps the UART’s physical register region into its address space. Accessing a byte at UART0 plus a register offset invokes the emulated device, rather than reading ordinary RAM. volatile keeps the C access present; it does not by itself create a device mapping.</p><p>Offset 3 is the line-control register. uartinit leaves it configured for eight-bit characters with its low two bits equal to 3. The probe shows the register setting in this emulated device.</p><p>Offset 5 is the line-status register, which describes different state. In this supplied run, the command’s input has already been consumed; its low receive-ready/error bits are zero. Register offsets and bit meanings are part of the device interface, so the same numeric mask must be interpreted in the selected register’s context.</p>`,
      excerpt: {
        file: "kernel/uart.c",
        within: "uartinit(void)",
        anchor: "WriteReg(LCR, LCR_EIGHT_BITS);",
        before: 2,
        after: 8,
      },
      sourceNote:
        "The driver distinguishes configuration, receive/transmit data, status and interrupt-control registers. Reg casts the mapped address to a volatile byte pointer.",
      assignment:
        "Change offset from 3 to 5. Choose Build & run again. Register low bits should become 0 for the empty receive state in this fixture; this is now a status read rather than the line-control configuration.",
      takeaway:
        "A device’s register map assigns meanings to addresses and bits; memory access syntax alone does not describe the device operation.",
      reflection:
        "Why should a C compiler preserve repeated reads of a volatile device status register?",
      expected: "register low bits=3",
    },
  ),
  "uart-output-passes-through-a-ring": k(
    {
      target: "uartputc",
      file: "kernel/uart.c",
      offset: 86,
      functions: ["acquire", "sleep", "release"],
      globals:
        "#define UART_TX_BUF_SIZE 32\nextern struct spinlock uart_tx_lock;\nextern char uart_tx_buf[UART_TX_BUF_SIZE];\nextern uint64 uart_tx_w, uart_tx_r;\nextern volatile int panicked;\nvoid uartstart(void);",
      probe: program('  printf("marker=@\\n");'),
    },
    {
      title: "Buffered output separates a writer from the UART",
      goal: "Change a byte entering the actual kernel transmit ring.",
      starter: (files) =>
        kernelFunction(files, "kernel/uart.c", "uartputc").replace(
          "  acquire(&uart_tx_lock);",
          "  int replacement = '@';\n  if (c == '@') c = replacement;\n  acquire(&uart_tx_lock);",
        ),
      reading: `<p>A user write reaches uartputc through the console driver. The kernel places its character in a transmit ring and advances the write counter. uartstart sends queued bytes when the device can accept them; the interrupt handler calls it again as progress becomes possible.</p><p>A full software ring makes the process sleep on the read counter while releasing uart_tx_lock. Advancing the read side wakes writers. This is distinct from a user program spinning on a device register.</p><p>The editable function is the real uartputc. The small marker transformation happens before its ordinary ring operations. The supplied program writes a fixed marker. The editable driver decides which byte to queue in its place. Kernel printf uses the separate synchronous routine, so its diagnostic output is not this user-output ring.</p>`,
      excerpt: {
        file: "kernel/uart.c",
        within: "uartputc(int c)",
        anchor: "if(uart_tx_w == uart_tx_r + UART_TX_BUF_SIZE)",
        after: 12,
      },
      sourceNote:
        "The monotonically increasing counters select ring slots with modulo. The lock protects those counters and bytes; sleep permits the consumer to make space.",
      assignment:
        "Change replacement from '@' to 'X'. Choose Build & run again. The supplied program is unchanged, but its output should become marker=X because the kernel driver changes the queued byte.",
      takeaway:
        "A buffered driver coordinates producer state, device readiness and wakeups while preserving a process-facing write interface.",
      reflection:
        "Why must a full-ring writer release the lock while it waits for a consumer to advance?",
      expected: "marker=@",
    },
  ),
  "the-console-edits-and-commits-lines": k(
    {
      target: "sys_getpid",
      file: "kernel/sysproc.c",
      offset: 20,
      functions: ["consoleintr"],
      probe: program(
        '  getpid();\n  char buf[16] = {0};\n  int n = read(0, buf, 15);\n  printf("read bytes=%d text=%s", n, buf);',
      ),
    },
    {
      title: "The console edits a line before readers consume it",
      goal: "Observe real console-buffer editing and newline commitment.",
      editorHeight: 470,
      starter: () =>
        getpid(
          "  int keys[] = {'c', 'a', 't', 0x15, 'd', 'o', 'g', '\\n'};\n  for (int i = 0; i < 8; i++) consoleintr(keys[i]);",
        ),
      reading: `<p>The UART input handler obtains bytes from the device and passes them to consoleintr. The console adds a line-oriented policy: it tracks read, committed-write and edit positions, supports editing keys, and wakes readers when a line is committed.</p><p>This kernel lab hook feeds an explicit sequence directly into the real consoleintr callback to isolate line editing from interrupt delivery. It does not emulate a physical keyboard event. The supplied user program then calls read on its actual console descriptor and prints the bytes from the kernel’s buffer.</p><p>The sequence types cat, sends Ctrl-U (0x15), then types dog and a newline. Ctrl-U removes the unfinished line, so the first run returns dog and a newline. Backspace instead removes just one unfinished character, leaving ca before dog. The newline advances the committed boundary so the waiting read can finish.</p>`,
      excerpt: {
        file: "kernel/console.c",
        within: "consoleintr(int c)",
        anchor: "case C('U'):",
        after: 14,
      },
      sourceNote:
        "consoleintr changes the edit position while handling erase keys. Its newline/EOF/full-buffer case publishes the edited bytes through cons.w and wakes readers on cons.r.",
      assignment:
        "Change 0x15 to 0x08 in the keys array. Choose Build & run again. Backspace removes only the t, so expect read bytes=6 text=cadog followed by a newline.",
      takeaway:
        "A terminal driver supplies editing and read-completion rules above the raw stream of device bytes.",
      reflection:
        "Why should bytes still being edited not automatically be available to a line reader?",
      expected: "read bytes=4 text=dog",
    },
  ),
  "virtio-descriptors-name-device-buffers": k(descriptorContext,{
    title:"Descriptors tell the device which memory to use",
    goal:"Read the actual request direction and device-write flag in a submitted VirtIO chain.",editorHeight:900,
    starter:files=>'static int watching;\nstatic int traces;\n#define WATCH_WRITE 0\n'+kernelFunction(files,"kernel/virtio_disk.c","free_chain").replace('  while(1){','  struct virtq_desc *desc = wb_disk_descriptors();\n  if (watching && traces < 2) {\n    int data = desc[i].next;\n    struct virtio_blk_req *request = (struct virtio_blk_req*)desc[i].addr;\n    int write = request->type == VIRTIO_BLK_T_OUT;\n    if (write == WATCH_WRITE) {\n      printf("request write=%d device writes data=%d\\n", write, (desc[data].flags & VRING_DESC_F_WRITE) != 0);\n      traces++;\n    }\n  }\n  while(1){').replaceAll('disk.desc', 'desc')+'\n// Lab hook: toggle observation around the supplied I/O.\nuint64 sys_getpid(void)\n{\n  push_off();\n  watching = !watching;\n  pop_off();\n  return myproc()->pid;\n}\n',
    reading:`<p>A VirtIO block request uses three linked descriptors: one for the request header, one for the data buffer, and one for the status byte. Each descriptor contains an address, a length, flags and a next index. The available ring publishes the chain’s first index to the device.</p><p>Direction has two perspectives. Reading the disk requires the device to <em>write</em> into the RAM buffer, so the data descriptor has VRING_DESC_F_WRITE set. Writing the disk requires the device to <em>read</em> the RAM buffer, so that flag is clear. This descriptor flag is separate from CPU page-table permissions.</p><p>The editable free_chain observes the real completed chain just before it is recycled. A helper reads the descriptor array so the probe can report the chain’s flags. A temporary getpid hook arms and disarms the observer; it still returns the real PID. The supplied program also causes writes, which the alternate filter observes.</p>`,
    excerpt:{file:"kernel/virtio_disk.c",within:"virtio_disk_rw(struct buf",anchor:"disk.desc[idx[1]].addr",after:14},
    sourceNote:"The data descriptor’s WRITE flag describes permission from the device’s perspective. The final descriptor always permits the device to write a status byte. Fences precede publishing and notifying the queue.",
    assignment:"Change WATCH_WRITE from 0 to 1. Choose Build & run again. Expect request write=1 device writes data=0, followed by successful completion of the supplied file operation.",
    takeaway:"A driver describes memory ownership and direction explicitly before handing a request to a device.",
    reflection:"Why does a disk read need a device-writable data descriptor while a disk write does not?",expected:"request write=0 device writes data=1",
    contextFiles:["kernel/virtio_disk.c","kernel/virtio.h","kernel/buf.h","kernel/memlayout.h"],
  }),
  "disk-completion-precedes-cache-validity": k(completionContext, {
    title: "A disk request completes through an interrupt",
    goal: "Observe the boundary between device completion and a cache buffer becoming valid.",
    editorHeight: 470,
    starter: (files) =>
      kernelFunction(files, "kernel/bio.c", "bread").replace(
        "    virtio_disk_rw(b, 0);",
        "    virtio_disk_rw(b, 0);\n" + completionTrace,
      ),
    reading: `<p>VirtIO communicates through descriptor chains and available/used rings in RAM. The driver describes the request header, data buffer and completion status, publishes the chain and notifies the device. For a read, the device transfers bytes into the buffer.</p><p>virtio_disk_rw sleeps while b->disk indicates an outstanding request. The device interrupt handler consumes used entries, clears that flag and wakes the waiter. Returning from virtio_disk_rw therefore marks device completion; bread then sets b->valid so the cache can reuse those bytes.</p><p>The edited bread observes that exact boundary for workbench. The supplied program creates a file, causing a cold data-block request, and reads its byte back. The console reports device completion, cache validity and the file byte separately. A later read may be a cache hit and need no new device request.</p>`,
    excerpt: {
      file: "kernel/virtio_disk.c",
      within: "virtio_disk_rw(struct buf",
      anchor: "disk.desc[idx[0]].addr",
      before: 2,
      after: 16,
    },
    sourceNote:
      "The chain identifies buffers by physical address. The available ring hands ownership to the device; used-ring processing in virtio_disk_intr completes the request and wakes its process.",
    assignment:
      "Move the two-line observation block to immediately after b->valid = 1. Choose Build & run again. Io complete should remain 1 while cache valid becomes 1. The file’s readback byte should still be D.",
    takeaway:
      "Asynchronous device completion and a filesystem cache’s validity state are related but separate transitions.",
    reflection:
      "Why can a later bread return valid bytes without submitting another VirtIO request?",
    expected: "io complete=1 cache valid=0",
  }),
};
