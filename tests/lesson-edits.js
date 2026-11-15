export const edits = {
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
