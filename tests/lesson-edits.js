export const edits = {
  "elf-headers-identify-an-executable": {
    edit: (s) => s.replace('selected = "lab"', 'selected = "README"'),
    expected: "ELF magic matches=0",
  },
  "segments-separate-file-bytes-from-memory-size": {
    edit: (s) => s.replace("span = segment.memsz", "span = segment.filesz"),
    expected: "span exceeds file bytes=0",
  },
  "the-loader-zeroes-real-bss-memory": {
    edit: (s) => s.replace("FILL 0", "FILL 7"),
    expected: "BSS byte=7",
  },
  "exec-builds-a-new-argument-vector": {
    edit: (s) => s.replace('"small"', '"clear"'),
    expected: "argc=3 first=clear second=kernel",
  },
  "exec-establishes-the-entry-stack": {
    edit: (s) => s.replace("STACK_BIAS 0", "STACK_BIAS 8"),
    expected: "entry stack alignment=8",
  },
  "failed-exec-preserves-the-old-image": {
    edit: (s) => s.replace("canary = 42", "canary = 73"),
    expected: "exec failed=1 old value=73 same process=1",
  },
  "the-shell-composes-kernel-interfaces": {
    edit: (s) => s.replace('"kernel"', '"source"'),
    expected: "child status=0 redirected output=source",
  },
  "capstone-follow-a-byte-from-process-to-disk": {
    edit: (s) => s.replace("from process to disk", "OS capstone complete"),
    expected: "OS capstone complete",
    verify: (out) => /collected child=0 file bytes=\d+/.test(out),
  },

  "filesystem-operations-reserve-log-space": {
    edit: (s) => s.replace("OPERATIONS 1", "OPERATIONS 2"),
    expected: "outstanding observed=2",
  },
  "the-log-absorbs-repeated-block-updates": {
    edit: (s) => s.replace("ABSORB 1", "ABSORB 0"),
    expected: "extra pin on repeat=1",
  },
  "the-last-operation-triggers-commit": {
    edit: (s) => s.replace("FINISH 1", "FINISH 2"),
    expected: "pending before cleanup=0",
  },
  "the-header-is-the-commit-point": {
    edit: (s) =>
      s.replace(
        "    observe_header();\n    write_head();    // Write header to disk -- the real commit",
        "    write_head();    // Write header to disk -- the real commit\n    observe_header();",
      ),
    expected: "header records a commit=1",
  },
  "boot-replays-a-committed-journal": {
    edit: (s) => s.replace("  install_trans(1);", "  // install_trans(1);"),
    expected: "recovered byte=O",
  },
  "redo-replay-is-idempotent": {
    edit: (s) => s.replace("REPLAYS 1", "REPLAYS 2"),
    expected: "replay passes=2",
    verify: (out) => out.includes("recovered byte=R"),
  },

  "the-superblock-describes-disk-regions": {
    edit: (s) => s.replace("count = sb.size", "count = sb.nblocks"),
    expected: "selected block count=954",
  },
  "the-buffer-cache-reuses-block-identity": {
    edit: (s) =>
      s.replace("second = bread(ROOTDEV, 1)", "second = bread(ROOTDEV, 2)"),
    expected: "same cache object=0",
  },
  "references-keep-cache-buffers-resident": {
    edit: (s) => s.replace("PINS 1", "PINS 2"),
    expected: "added cache references=2",
  },
  "inode-references-and-loaded-metadata-differ": {
    edit: (s) => s.replace("observed = before", "observed = after"),
    expected: "inode metadata loaded=1",
  },
  "paths-start-at-root-or-the-current-directory": {
    edit: (s) => s.replace('selected = "item"', 'selected = "/item"'),
    expected: "selected file byte=R",
  },
  "the-bitmap-tracks-block-ownership": {
    edit: (s) => s.replace("observed = before", "observed = after"),
    expected: "allocation bit=0",
  },
  "direct-and-indirect-blocks-map-file-offsets": {
    edit: (s) => s.replace("logical = 11", "logical = 12"),
    expected: "maps last direct block=0 indirect table present=1",
  },
  "truncation-releases-a-files-block-map": {
    edit: (s) =>
      s.replace('open("trim", O_RDWR | O_TRUNC)', 'open("trim", O_RDWR)'),
    expected: "size after reopening=13312 links=1",
  },

  "an-atomic-swap-returns-the-old-value": {
    edit: (s) =>
      s.replace(
        "second = __sync_lock_test_and_set(&word, 1)",
        "second = __sync_lock_test_and_set(&word, 7)",
      ),
    expected: "old values=0,1 final word=7",
  },
  "a-lock-records-its-owner": {
    edit: (s) => s.replace("observed = after", "observed = before"),
    expected: "owned at observation=1",
  },
  "nested-critical-sections-restore-interrupts": {
    edit: (s) => s.replace("intr_on();", "intr_off();"),
    expected: "after inner pop=0 restored enable=0",
  },
  "locks-order-protected-publication": {
    edit: (s) => s.replace("payload = 42", "payload = 73"),
    expected: "protected payload=73",
  },
  "a-sleeping-lock-does-not-spin-through-io": {
    edit: (s) => s.replace("observed = before", "observed = after"),
    expected: "sleep lock owned=0 internal spin owned=0",
  },
  "a-wakeup-needs-the-right-condition-and-channel": {
    edit: (s) => s.replace("MATCH 1", "MATCH 0"),
    expected: "waiter status=-1",
  },
  "lock-order-prevents-circular-wait": {
    edit: (s) => s.replace("acquire(&right);", "acquire(&left);"),
    expected: "panic: acquire",
    allowPanic: true,
  },

  "kernel-contexts-save-a-call-boundary": {
    edit: (s) =>
      s.replace("sizeof(struct context)", "sizeof(struct trapframe)"),
    expected: "saved words=36",
  },
  "a-saved-stack-belongs-to-the-kernel": {
    edit: (s) => s.replace("saved = p->context.sp", "saved = p->trapframe->sp"),
    expected: "saved pointer inside kernel stack=0",
  },
  "yield-hands-a-process-to-the-scheduler": {
    edit: (s) =>
      s.replace(
        '  if (strncmp(p->name, "workbench", 9) == 0)\n    printf("runnable at observation=%d\\n", p->state == RUNNABLE);\n  sched();',
        '  sched();\n  if (strncmp(p->name, "workbench", 9) == 0)\n    printf("runnable at observation=%d\\n", p->state == RUNNABLE);',
      ),
    expected: "runnable at observation=0",
  },
  "sched-enforces-switching-invariants": {
    edit: (s) => s.replace("yield();", "sched();"),
    expected: "panic: sched p->lock",
    allowPanic: true,
  },
  "timer-preemption-enters-the-scheduler": {
    edit: (s) => s.replace("PREEMPT 1", "PREEMPT 0"),
    expected: "user timer preemptions observed=0",
  },
  "sleep-transfers-lock-protection": {
    edit: (s) =>
      s.replace(
        '    if (lk == &tickslock && strncmp(p->name, "workbench", 9) == 0)\n      printf("handoff condition lock=%d\\n", holding(lk));\n    release(lk);',
        '    release(lk);\n    if (lk == &tickslock && strncmp(p->name, "workbench", 9) == 0)\n      printf("handoff condition lock=%d\\n", holding(lk));',
      ),
    expected: "handoff condition lock=0",
  },

  "virtio-descriptors-name-device-buffers": {
    edit: (s) => s.replace("WATCH_WRITE 0", "WATCH_WRITE 1"),
    expected: "request write=1 device writes data=0",
    verify: (out) => out.includes("device operation finished"),
  },
  "timer-interrupts-advance-kernel-ticks": {
    edit: (s) => s.replace("ticks += 1", "ticks += 2"),
    expected: "observed increment=2",
  },
  "masking-supervisor-interrupts": {
    edit: (s) => s.replace("intr_off();", "intr_on();"),
    expected: "interrupt enable before=1 during=1 after=1",
  },
  "claiming-and-completing-device-interrupts": {
    edit: (s) => s.replace("WATCH_IRQ VIRTIO0_IRQ", "WATCH_IRQ UART0_IRQ"),
    expected: "completed irq=10",
  },
  "uart-registers-are-memory-mapped": {
    edit: (s) => s.replace("offset = 3", "offset = 5"),
    expected: "register low bits=0",
  },
  "uart-output-passes-through-a-ring": {
    edit: (s) => s.replace("replacement = '@'", "replacement = 'X'"),
    expected: "marker=X",
  },
  "the-console-edits-and-commits-lines": {
    edit: (s) => s.replace("0x15", "0x08"),
    expected: "read bytes=6 text=cadog",
  },
  "disk-completion-precedes-cache-validity": {
    edit: (s) => {
      const lines = s.split("\n"),
        first = lines.findIndex((line) => line.includes("if (myproc() &&"));
      const observation = lines.splice(first, 2),
        at = lines.findIndex((line) => line.includes("b->valid = 1;"));
      lines.splice(at + 1, 0, ...observation);
      return lines.join("\n");
    },
    expected: "io complete=1 cache valid=1",
    verify: (out) => out.includes("disk byte=D"),
  },
  "a-trapframe-saves-user-registers": {
    edit: (s) =>
      s.replace("selected = p->trapframe->a7", "selected = p->trapframe->epc"),
    expected: "selected equals syscall number=0",
  },
  "a-trap-cause-selects-the-path": {
    edit: (s) => s.replace("== SYS_getpid", "== SYS_write"),
    expected: "observed syscall=16 cause=8",
  },
  "ecall-must-advance-the-return-pc": {
    edit: (s) => s.replace("LAB_GETPID_ADVANCE 4", "LAB_GETPID_ADVANCE 0"),
    expected: "return pc child status=-1",
    verify: (out) => !out.includes("child syscall returned"),
  },
  "dispatch-chooses-a-kernel-handler": {
    edit: (s) => s.replace("? SYS_getpid : num", "? SYS_uptime : num"),
    expected: "same result=0 changed=1",
  },
  "arguments-come-from-saved-registers": {
    edit: (s) => s.replace("extra = 0", "extra = 3"),
    expected: "decoded sleep ticks=5",
    verify: (out) => Number(out.match(/elapsed ticks=(\d+)/)?.[1]) >= 5,
  },
  "returning-to-user-mode": {
    edit: (s) => s.replace("lab_mode = 0", "lab_mode = SSTATUS_SPP"),
    expected: "panic: usertrap: not from user mode",
    allowPanic: true,
  },
  "splitting-a-virtual-address": {
    edit: (s) => s.replace("0x12345678", "0x12346678"),
    expected: "vpn=0/145/326 offset=1656",
  },
  "walking-three-page-table-levels": {
    edit: (s) => s.replace("va = 0", "va = PGSIZE"),
    expected: "level=0 index=1 valid=1",
  },
  "reading-page-permissions": {
    edit: (s) =>
      s
        .replace("table = p->pagetable", "table = kernel_pagetable")
        .replace("va = 0", "va = KERNBASE"),
    expected: "user=0 writable=0 executable=1",
  },
  "kernel-mappings-include-devices": {
    edit: (s) => s.replace("va = KERNBASE", "va = UART0"),
    expected: "identity=1 writable=1 executable=0",
  },
  "a-guard-page-denies-user-access": {
    edit: (s) => s.replace("return guard;", "return guard + PGSIZE;"),
    expected: "guard child status=0",
    verify: (out) =>
      out.includes("child read succeeded") && !out.includes("usertrap()"),
  },
  "trampoline-mappings-cross-address-spaces": {
    edit: (s) => s.replace("va = TRAMPOLINE", "va = TRAPFRAME"),
    expected: "both mapped=0 same frame=0 user-access=0",
  },
  "checked-copies-translate-user-addresses": {
    edit: (s) => s.replace("source = guard;", "source = guard + PGSIZE;"),
    expected: "checked copy result=0",
  },
  "copies-check-each-page": {
    edit: (s) => s.replace("bytes, source, 2", "bytes, source, 1"),
    expected: "boundary result=0 first changed=1 second unchanged=1",
  },
  "editing-the-kernel-boot": {
    edit: (s) => s.replace("xv6 kernel is booting", "Hello from my kernel"),
    expected: "Hello from my kernel",
  },
  "boot-needs-a-stack": {
    edit: (s) =>
      s.replace("top - (uint64)stack0)", "top - (uint64)stack0 - PGSIZE)"),
    expected: "boot stack top offset=0",
  },
  "boot-turns-on-paging": {
    edit: (s) => {
      const line = s
        .split("\n")
        .find((line) => line.includes('printf("boot paging mode='));
      return s
        .replace(line + "\n", "")
        .replace(/(^.*kvminithart\(\);.*$)/m, "$1\n" + line);
    },
    expected: "boot paging mode=8",
  },
  "boot-prepares-physical-pages": {
    edit: (s) => s.replace("page[0] = 'A'", "page[0] = 'Z'"),
    expected: "allocated byte=90",
  },
  "initialization-is-not-execution": {
    edit: (s) => s.replace("== UNUSED", "== RUNNABLE"),
    expected: "boot matching slots=0",
  },
  "boot-creates-the-first-user-process": {
    edit: (s) => s.replace("== RUNNABLE", "== UNUSED"),
    expected: "initial runnable=63",
  },
  "sleep-counts-guest-ticks": {
    edit: (s) => s.replace("requested = 3", "requested = 5"),
    expected: "requested=5 at_least=1 sleep_result=0",
  },
  "runnable-processes-take-turns": {
    edit: (s) => s.replace("N = 3", "N = 5"),
    expected: "workers collected=2",
    verify: (out) =>
      (out.match(/A/g) || []).length === 5 &&
      (out.match(/B/g) || []).length === 5,
  },
  "waiting-is-a-process-state": {
    edit: (s) => s.replace("exit(0);", "exit(7);"),
    expected: "parent collected child; status=7",
  },
  "wakeup-makes-a-process-runnable": {
    edit: (s) => s.replace('"K"', '"Z"'),
    expected: "woken reader=Z",
  },
  "killing-a-sleeping-process": {
    edit: (s) => s.replace("kill(child)", "kill(99999)"),
    expected: "kill result=-1 child status=0",
    verify: (out) => out.includes("child completed sleep"),
  },
  "locks-protect-shared-kernel-state": {
    edit: (s) => s.replace("N = 20", "N = 30"),
    expected: "bytes=60 A=30 B=30 collected=2",
  },
  "a-pipe-connects-two-descriptors": {
    edit: (s) => s.replace('"cat"', '"dog"'),
    expected: "read=3 data=dog",
  },
  "eof-needs-closed-writers": {
    edit: (s) => s.replace("read(p[0], buf, 8)", "read(p[0], buf, 1)"),
    expected: "next=1",
  },
  "fork-inherits-pipe-ends": {
    edit: (s) => s.replace('"hello"', '"world"'),
    expected: "child data=world bytes=5 eof=0",
  },
  "pipes-are-byte-streams": {
    edit: (s) => s.replace("read(p[0], buf, 4)", "read(p[0], buf, 3)"),
    expected: "read=3 data=ABC",
  },
  "a-pipe-reader-can-block": {
    edit: (s) => s.replace('"K"', '"Z"'),
    expected: "reader: byte=Z",
  },
  "redirecting-output-through-a-pipe": {
    edit: (s) => s.replace('"from echo"', '"new message"'),
    expected: "pipeline=new message",
  },
  "opening-and-closing-files": {
    edit: (s) =>
      s.replace("  close(fd);", "  // Keep the first slot occupied."),
    expected: "reused=0",
  },
  "reads-advance-the-file-offset": {
    edit: (s) => s.replace("read(fd, buf, 2)", "read(fd, buf, 1)"),
    expected: "second=bc",
  },
  "dup-shares-the-open-file": {
    edit: (s) => s.replace("dup(fd)", 'open("note", O_RDONLY)'),
    expected: "first=a second=a",
  },
  "unlink-keeps-open-files-alive": {
    edit: (s) => s.replace('unlink("note");', "// Keep the name."),
    expected: "open data=alive",
    verify: (out) => /name open=\d+ open data=alive/.test(out),
  },
  "two-names-one-inode": {
    edit: (s) => s.replace('unlink("first");', "// Keep both names."),
    expected: "same_inode=1 links_now=2 data=Hi",
  },
  "writes-pass-through-the-log": {
    edit: (s) => s.replace("N = 6000", "N = 13000"),
    expected: "written=13000 read=13000 errors=0",
  },
  "growing-user-memory": {
    edit: (s) => s.replace("sbrk(4096)", "sbrk(8192)"),
    expected: "grew=8192 first=17",
  },
  "memory-is-mapped-in-pages": {
    edit: (s) => s.replace("p[4096] = 'B'", "p[4096] = 'Z'"),
    expected: "first=A second=Z distance=4096",
  },
  "new-pages-start-at-zero": {
    edit: (s) => s.replace("// Add a byte assignment here.", "p[0] = 9;"),
    expected: "nonzero bytes=1",
  },
  "shrinking-user-memory": {
    edit: (s) => s.replaceAll("4096", "8192"),
    expected: "added=8192 remaining=0",
  },
  "a-user-fault-is-contained": {
    edit: (s) => s.replace("sbrk(-4096);", "// Keep this page mapped."),
    expected: "parent survived; child status=0",
  },
  "the-kernel-checks-user-pointers": {
    edit: (s) => s.replace("(char*)0x40000000", '"safe"'),
    expected: "write copied=4",
  },
};
