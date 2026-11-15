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
  "heap",
  "pagetables",
  "scheduling",
  "sleeping",
  "blocking",
]);
export const observations = {
  boot: "Find hello between the command and the next $ prompt. The prompt comes from the shell.",
  console:
    "You are paused inside sys_write. Notice the PC and instruction shown here, then continue execution to see the output.",
  fork: "You are paused before this fork handler creates a child. Continue, then notice that the shell returns after the child finishes.",
  pipe: "Read the three counts: lines, words and bytes. Include the newline added by echo.",
  files:
    "The first command writes to note. Use the command field below to run cat note, then compare its output.",
  step: "You are paused in sys_write. Record the PC shown here, take one instruction step, and compare it. Then continue execution.",
  identity:
    "Find lab in the process snapshot. Compare its PID with the number printed after you continue.",
  exec: "This first exec stop may be the shell loading lab. Continue and compare the two printed PIDs: exec keeps process identity.",
  wait: "A wait stop can belong to the shell or lab. Inspect the actual processes, then continue and compare parent value, child value and exit status.",
  descriptors:
    "Continue past dup. The two reads use the same open-file offset: look for A followed by B.",
  unlink:
    "Continue past unlink. The open descriptor can still read alive even after its directory name is gone.",
  links:
    "Continue past link. Look for linked read through alias after the original name is removed.",
  directories:
    "Continue past mkdir, then run ls labdir in the command field. The directory should contain the dot and dot-dot entries.",
  heap: "The first sbrk stop is a query, before growth. Note lab’s size, then continue to see the 4096-byte growth result.",
  pagetables:
    "We walked 0x0 for lab. Read the three PTEs and final physical address, then continue.",
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
    "A bread stop identifies a buffer lookup, not necessarily a disk read. Continue and read the guest README.",
  blocks:
    "The writei stop may happen before lab’s own writes. Continue and verify the 14336-byte result crossing into indirect blocks.",
  transactions:
    "Continue past begin_op and verify the link experiment. The explanation next connects this operation to the log’s commit ordering.",
  capstone:
    "Follow the reader’s three bytes and subsequent EOF. Connect those observations to fork, sleep, write, close, exit and wait.",
};
