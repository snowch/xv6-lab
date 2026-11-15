export const edits = {
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
