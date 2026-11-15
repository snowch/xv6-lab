export const edits = {
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
