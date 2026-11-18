export const stages = [
  ["predict", "Predict"],
  ["observe", "Run & inspect"],
  ["explain", "Explain"],
  ["vary", "Try a change"],
  ["check", "Check"],
];
export const processLessons = new Set([
  "identity",
  "traps",
  "wait",
  "descriptors",
  "heap",
  "pagetables",
  "scheduling",
  "sleeping",
  "blocking",
]);
export const observations = {
  boot: "Find hello between the command and the next $ prompt. The prompt comes from the shell.",
  console:
    "At the stop, find the PC, the address of the next instruction. Choose Continue execution and look for hello before the next shell prompt.",
  fork: "At the sys_fork stop, the handler has yet to create a child. Choose Continue execution. Look for child and the returning shell prompt.",
  pipe: "Read the three counts: lines, words and bytes. Include the newline added by echo.",
  files:
    "After the prompt returns, enter cat note in the xv6 command field and choose Run. When does hello appear in the console?",
  step: "At the sys_write stop, note the PC shown here. Choose Step one instruction and compare the new PC. Then choose Continue execution.",
  identity:
    "At the stop, find the PID (process identifier) for lab in the snapshot. Choose Continue execution and compare it with user pid= in the console.",
  exec: "This first exec stop may be the shell loading lab. Continue and compare the two printed PIDs: exec keeps process identity.",
  wait: "A wait stop can belong to the shell or lab. Inspect the actual processes, then continue and compare parent value, child value and exit status.",
  descriptors:
    "At sys_dup, find lab’s Open descriptors count in the paused process table. Choose Continue execution. Find A followed by B in the console.",
  unlink:
    "Continue past unlink. The open descriptor can still read alive even after its directory name is gone.",
  links:
    "Continue past link. Look for linked read through alias after the original name is removed.",
  directories:
    "Choose Continue execution. When the shell prompt returns, enter ls labdir in the xv6 command field and choose Run. Look for . and .., the directory and its parent.",
  heap: "The first sbrk stop is a query, before growth. Note lab’s size, then continue to see the 4096-byte growth result.",
  pagetables:
    "At the sys_getpid stop, the lab walks address 0x0 for the lab process. Find the level, index and page-table entry (PTE) on each line. Which entry has the U flag for user access and the X flag for execution? Then choose Continue execution.",
  faults:
    "Find the child fault diagnostic and the surviving parent’s message. A user fault should not end the shell.",
  traps:
    "Compare lab’s saved user epc/a0/a7 with the live kernel PC shown here. getpid uses saved a7=11. Then continue.",
  scheduling:
    "This scheduling stop can happen before lab starts. Inspect the actual process states, then continue and watch both parent and child make progress.",
  sleeping:
    "Continue past sys_sleep. Watch sleeping for 3 timer ticks followed by awake; the timer supplies the wakeup event.",
  blocking:
    "At pipe read, inspect the current processes. Continue to see hey arrive and the following read return zero at EOF.",
  locks:
    "This acquire stop may come from unrelated kernel activity. The source excerpt shows where you actually stopped. Continue to finish lab pid.",
  cache:
    "A stop in bread shows that the kernel looked up a cached buffer. Choose Continue execution and read the guest README. The same stop can happen with a cache hit or a disk request.",
  blocks:
    "The writei stop may happen before lab’s own writes. Continue and verify the 14336-byte result crossing into indirect blocks.",
  transactions:
    "Continue past begin_op and verify the link experiment. The explanation next connects this operation to the log’s commit ordering.",
  capstone:
    "Find reader got 3 bytes: hey and reader EOF=0 (end of file) in the shell output. Which operations sent the three bytes, and which operation let the reader finish?",
};

// Some changes require a new debugger stop. Others are shell commands or a
// source exercise, so their controls should not imply a breakpoint is needed.
export const guidedChanges = {
  console: "echo a much longer message",
  fork: "echo second child",
  step: "echo inspect",
  descriptors: "lab fd",
  pagetables: "lab pid",
};
export const commandChanges = {
  boot: "banana",
  pipe: "echo hello world | wc",
  files: "cat < note",
  identity: "lab pid",
  exec: "banana",
  unlink: "cat held",
  links: "echo text > first",
  directories: "echo hello > labdir/item",
  heap: "lab vm",
  faults: "lab pid",
  scheduling: "lab yield",
  sleeping: "lab yield",
  blocking: "echo hey | wc",
  cache: "cat README",
  capstone: "echo hello | wc",
};
