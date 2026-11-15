import { lesson, program } from "./lesson-helpers.js?v=chapter7";
const hook = (body) =>
  "uint64\nsys_getpid(void)\n{\n" + body + "\n  return myproc()->pid;\n}\n";
const k = (build, details) =>
  lesson({
    mode: "kernel",
    file: "kernel/sysproc.c",
    offset: 20,
    build: {
      target: "sys_getpid",
      file: "kernel/sysproc.c",
      offset: 20,
      ...build,
    },
    editorHeight: 640,
    contextTitle: "Read the locking protocol",
    contextFiles: ["kernel/spinlock.c", "kernel/sleeplock.c", "kernel/proc.c"],
    ...details,
  });
const locks = [
  "initlock",
  "acquire",
  "release",
  "holding",
  "push_off",
  "pop_off",
];
const waiting = program(
  '  int child = fork();\n  if (child < 0) exit(1);\n  if (child == 0) { getpid(); exit(0); }\n  sleep(2);\n  getpid();\n  sleep(2);\n  kill(child);\n  int status;\n  wait(&status);\n  printf("waiter status=%d\\n", status);',
);
export const chapter12Lessons = {
  "an-atomic-swap-returns-the-old-value": k(
    { bridges: ["__sync_lock_test_and_set"] },
    {
      title: "An atomic swap returns the old value",
      goal: "Observe the read-and-write operation used to claim a spinlock.",
      starter: () =>
        "static volatile uint word;\n" +
        hook(
          '  uint first = __sync_lock_test_and_set(&word, 1);\n  uint second = __sync_lock_test_and_set(&word, 1);\n  printf("old values=%d,%d final word=%d\\n", first, second, word);',
        ),
      reading:
        "<p>A spinlock needs to test whether a word is free and claim it as one indivisible operation. A separate load followed by a store would let two CPUs both observe zero before either stores one.</p><p>xv6 uses an atomic exchange: it writes 1 and returns the previous value. Returning 0 means this attempt claimed an unlocked word; returning 1 means someone already held it. acquire repeats the exchange until it observes 0.</p><p>The native instruction helper executes the real atomic operation. Build and observe old values 0,1 with a final word of 1. Changing the second new value changes what gets stored, while its return still reports the preceding 1. This isolated word is an instruction experiment, not a complete lock: ownership, interrupt control and ordering come next.</p>",
      excerpt: {
        file: "kernel/spinlock.c",
        within: "acquire(struct spinlock",
        anchor: "while(__sync_lock_test_and_set",
        before: 4,
        after: 3,
      },
      sourceNote:
        "The comment identifies amoswap.w.aq. Atomicity applies to the exchange itself; a whole critical section needs the surrounding acquire/release protocol.",
      assignment:
        "Change only the second exchange’s new value from 1 to 7. Build and run. The old values remain 0,1, while final word becomes 7.",
      expected: "old values=0,1 final word=1",
      takeaway:
        "An atomic exchange reports what it replaced as well as publishing a new value.",
      reflection:
        "Why can two separate C statements not supply this indivisible claim?",
    },
  ),
  "a-lock-records-its-owner": k(
    { functions: locks },
    {
      title: "A spinlock records its owning CPU",
      goal: "Distinguish a set lock word from this CPU’s ownership of it.",
      starter: () =>
        hook(
          '  struct spinlock gate;\n  initlock(&gate, "gate");\n  acquire(&gate);\n  int before = holding(&gate);\n  release(&gate);\n  push_off();\n  int after = holding(&gate);\n  pop_off();\n  int observed = after;\n  printf("owned at observation=%d\\n", observed);',
        ),
      reading:
        "<p>The lock word answers whether a lock is held. xv6 also records the owning CPU in lk-&gt;cpu. holding checks both fields; release rejects a caller that does not own the lock.</p><p>The probe acquires a real local spinlock, samples ownership, releases it and samples again. holding requires interrupts off so the CPU lookup stays stable, which is why the second sample has an explicit push_off/pop_off pair. The first sample already has interrupts disabled by acquire.</p><p>Build and expect 0 from the after sample. Select before to observe 1. This is CPU ownership for a spinlock, not the process PID ownership used by a sleeping lock.</p>",
      excerpt: {
        file: "kernel/spinlock.c",
        within: "holding(struct spinlock",
        anchor: "r = (lk->locked",
        before: 2,
        after: 2,
      },
      sourceNote:
        "acquire records mycpu after the claim. release checks holding, clears ownership and unlocks before balancing interrupt nesting.",
      assignment:
        "Change observed = after to observed = before. Build and run; owned at observation becomes 1.",
      expected: "owned at observation=0",
      takeaway: "Lock state and ownership are related but distinct checks.",
      reflection: "Why is testing lk->locked alone insufficient for release?",
    },
  ),
  "nested-critical-sections-restore-interrupts": k(
    {
      functions: ["push_off", "pop_off"],
      bridges: ["intr_on", "intr_off", "intr_get"],
    },
    {
      title: "Nested critical sections restore the previous interrupt state",
      goal: "Observe that the outermost pop restores the original enable state.",
      starter: () =>
        hook(
          '  intr_on();\n  push_off();\n  push_off();\n  pop_off();\n  int inner = intr_get();\n  pop_off();\n  int restored = intr_get();\n  intr_on(); // Restore the known syscall-entry state after this experiment.\n  printf("after inner pop=%d restored enable=%d\\n", inner, restored);',
        ),
      reading:
        "<p>A device interrupt could try to acquire a spinlock already held by the code it interrupted. On one hart, spinning in that interrupt would prevent the interrupted holder from ever releasing it. xv6 disables local interrupts while holding spinlocks.</p><p>Critical sections can nest. push_off saves the previous interrupt-enable state only at nesting depth zero, then increments noff. pop_off decrements it and restores delivery only when the outermost level ends and the saved state allowed interrupts.</p><p>Build and expect the inner pop to leave interrupts off, with the outer pop restoring 1. Change the initial state to off: both samples become 0. The final cleanup explicitly reinstates this handler’s known normal entry state; general callers should preserve their own state through matched nesting.</p>",
      excerpt: {
        file: "kernel/spinlock.c",
        within: "pop_off(void)",
        anchor: "c->noff -= 1;",
        after: 3,
      },
      sourceNote:
        "The nesting count prevents an inner release from enabling interrupts inside an outer critical section. intena remembers the initial state.",
      assignment:
        "Replace the first intr_on() with intr_off(), leaving the final cleanup unchanged. Build and run; restored enable becomes 0.",
      expected: "after inner pop=0 restored enable=1",
      takeaway:
        "Leaving a nested critical section restores a saved policy rather than blindly enabling interrupts.",
      reflection:
        "Why would intr_on at every release break an outer lock’s protection?",
    },
  ),
  "locks-order-protected-publication": k(
    { functions: ["initlock", "acquire", "release"] },
    {
      title: "Locks order the publication of protected state",
      goal: "Connect payload visibility to the ordering inside acquire and release.",
      starter: () =>
        "static struct spinlock gate;\nstatic int payload, ready;\n" +
        hook(
          '  initlock(&gate, "publication");\n  acquire(&gate);\n  payload = 42;\n  ready = 1;\n  release(&gate);\n  acquire(&gate);\n  int observed = ready ? payload : -1;\n  release(&gate);\n  printf("protected payload=%d\\n", observed);',
        ),
      reading:
        "<p>Mutual exclusion is only part of the lock contract. Other CPUs must also observe the protected writes in the required order. The fences and atomic operations in xv6 prevent protected accesses from moving across the lock boundaries.</p><p>This probe publishes a payload and a ready condition under one real lock, then reads both under that same lock. Build and observe 42; edit the payload to observe 73. Both the flag and the payload follow the protocol. Reading a flag without the shared synchronization would require a separate, carefully defined memory-ordering protocol.</p><p>This one-hart sequential experiment makes the protected data flow visible. Its successful output cannot prove weak-memory behavior on multiple CPUs. The ordering guarantee comes from the actual acquire/release implementation and its fences, which the source below shows.</p>",
      excerpt: {
        file: "kernel/spinlock.c",
        within: "release(struct spinlock",
        anchor: "__sync_synchronize();",
        before: 4,
        after: 12,
      },
      sourceNote:
        "The fence orders protected stores before unlocking. acquire has its matching ordering before subsequent protected loads and stores.",
      assignment:
        "Change payload = 42 to payload = 73. Build and run; the protected reader should see 73.",
      expected: "protected payload=42",
      takeaway:
        "A lock protocol governs access and visibility, including the data accompanying a ready flag.",
      reflection: "Why is the ready flag also protected by the lock?",
    },
  ),
  "a-sleeping-lock-does-not-spin-through-io": k(
    {
      headers: ["kernel/sleeplock.h"],
      functions: [
        ...locks,
        "initsleeplock",
        "acquiresleep",
        "releasesleep",
        "holdingsleep",
      ],
    },
    {
      title: "A sleeping lock can stay held across blocking work",
      goal: "Observe process ownership while its internal spinlock is released.",
      starter: () =>
        hook(
          '  struct sleeplock gate;\n  initsleeplock(&gate, "payload");\n  acquiresleep(&gate);\n  int before = holdingsleep(&gate);\n  push_off();\n  int spinning = holding(&gate.lk);\n  pop_off();\n  releasesleep(&gate);\n  int after = holdingsleep(&gate);\n  int observed = before;\n  printf("sleep lock owned=%d internal spin owned=%d\\n", observed, spinning);',
        ),
      reading:
        "<p>A buffer may stay locked while disk I/O blocks. Holding an ordinary spinlock throughout that wait would violate sched’s contract and waste a CPU on a multiprocessor. A sleeping lock instead records its owning process and puts contenders to sleep.</p><p>Its internal spinlock protects the locked flag and PID only while changing or inspecting them. acquiresleep releases that spinlock before returning, while the logical sleeping lock remains owned. releasesleep clears ownership and wakes contenders, which recheck the condition in a while loop.</p><p>Build and observe sleep lock owned=1 with internal spin owned=0. Select the after-release sample to observe ownership 0. This uncontended probe inspects the protocol; the source shows how a contender blocks and rechecks.</p>",
      excerpt: {
        file: "kernel/sleeplock.c",
        within: "acquiresleep(struct sleeplock",
        anchor: "acquire(&lk->lk);",
        after: 8,
      },
      sourceNote:
        "The owning PID is distinct from the CPU field of a spinlock. sleep atomically releases the internal lock and reacquires it before the condition is tested again.",
      assignment:
        "Change observed = before to observed = after. Build and run; sleep lock owned becomes 0 while internal spin owned remains 0.",
      expected: "sleep lock owned=1 internal spin owned=0",
      takeaway:
        "A sleeping lock retains process ownership while allowing its holder or contenders to block.",
      reflection: "Why must a woken contender recheck lk->locked?",
    },
  ),
  "a-wakeup-needs-the-right-condition-and-channel": k(
    {
      functions: ["initlock", "acquire", "release", "sleep", "wakeup"],
      probe: waiting,
    },
    {
      title: "A wakeup needs the matching channel",
      goal: "Observe that changing a condition does not itself wake a sleeping process.",
      editorHeight: 850,
      starter: () =>
        "static struct spinlock gate;\nstatic int initialized, arrivals, ready;\nstatic int channel, other;\n#define MATCH 1\n" +
        hook(
          '  if (!initialized) { initlock(&gate, "condition"); initialized = 1; }\n  acquire(&gate);\n  if (arrivals++ == 0) {\n    while (!ready && !myproc()->killed) sleep(&channel, &gate);\n  } else {\n    ready = 1;\n    wakeup(MATCH ? &channel : &other);\n  }\n  release(&gate);',
        ),
      reading:
        "<p>A sleep channel is an identity, commonly an address. wakeup marks processes sleeping on exactly that channel RUNNABLE; it is not a stored token. The shared condition records whether work may proceed, and a loop rechecks it under the condition lock.</p><p>The supplied child calls the edited getpid hook first and waits for ready. Its parent sleeps briefly, calls the hook to set ready under the same lock, and wakes the matching channel. Build and expect waiter status=0. sleep’s acquire-before-release handoff prevents a notification from falling between the condition check and publication of the sleeping state.</p><p>Set MATCH to 0. The condition becomes true but the notification targets another address, so the child remains sleeping. The parent’s bounded cleanup kills it after two further ticks; the real exit status becomes -1. A notification and a condition are separate parts of one protocol.</p>",
      excerpt: {
        file: "kernel/proc.c",
        within: "wakeup(void *chan)",
        anchor: "if(p->state == SLEEPING",
        before: 2,
        after: 4,
      },
      sourceNote:
        "wakeup acquires each process lock before matching its state and channel. Being made runnable still does not guarantee the condition remains true until execution resumes.",
      assignment:
        "Change MATCH from 1 to 0. Build and run; the parent’s bounded cleanup should report waiter status=-1.",
      expected: "waiter status=0",
      takeaway:
        "Correct blocking needs a protected condition, atomic sleep handoff and a matching notification.",
      reflection:
        "Why does ready=1 not cause an unrelated sleeping process to run automatically?",
    },
  ),
  "lock-order-prevents-circular-wait": k(
    { functions: ["initlock", "acquire", "release"] },
    {
      title: "Lock order prevents circular wait",
      goal: "Recognize a self-cycle and extend the reasoning to multiple locks.",
      teachesKernelPanic: true,
      starter: () =>
        hook(
          '  struct spinlock left, right;\n  initlock(&left, "left");\n  initlock(&right, "right");\n  acquire(&left);\n  acquire(&right);\n  printf("held two distinct locks\\n");\n  release(&right);\n  release(&left);',
        ),
      reading:
        "<p>If one execution path holds A and waits for B while another holds B and waits for A, neither can proceed. A consistent global acquisition order rules out that circular wait. Choosing an order requires inspecting every path that can hold the locks together.</p><p>The starter follows left then right and releases in reverse order. Build to hold both real locks. Change the second acquisition to left again: this creates a self-cycle. xv6 catches that case with panic: acquire rather than spinning forever.</p><p>A self-cycle is the simplest example, not a demonstration of multicore contention. The pinned wait implementation below explains a more subtle ordering constraint: it already holds the parent’s lock and must check the parent relationship before locking a candidate that might be an ancestor. Lock ordering is a property of the whole protocol.</p>",
      excerpt: {
        file: "kernel/proc.c",
        within: "wait(uint64 addr)",
        anchor: "this code uses np->parent",
        before: 1,
        after: 10,
      },
      sourceNote:
        "Moving acquire(&np->lock) ahead of the relationship check can introduce a lock-order cycle. Local mutual exclusion does not automatically make a multi-lock algorithm deadlock-free.",
      assignment:
        "Replace acquire(&right) with acquire(&left), leaving the first acquisition intact. Build and run; expect panic: acquire. Restore the starter and rebuild a fresh VM.",
      expected: "held two distinct locks",
      takeaway:
        "Locks need a consistent acquisition protocol as well as correct individual acquire and release calls.",
      reflection:
        "What cycle appears if one path takes A then B and another takes B then A?",
    },
  ),
};
