# Comprehensive functional xv6 course

All **15 chapters and 99 lessons** are implemented. The first six teach
user-visible foundations; nine further chapters revisit those behaviors inside
the pinned xv6 RISC-V implementation. This is a spiral curriculum: experience
a mechanism, then explain and change its implementation.

| Chapter | Subject                          | Required coverage                                                                                                                          |
| ------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1–6     | Foundations (available)          | Programs/syscalls, fork/exec/wait, memory, descriptors/files, pipes, scheduling                                                            |
| 7       | Boot and kernel organization     | Entry, privilege setup, boot ordering, physical allocation, initialization dependencies, first user process                                |
| 8       | Address translation              | Sv39 indices and walks, leaf PTEs/permissions, kernel mappings, guard pages, trampoline/trapframe mappings, checked copies                 |
| 9       | Traps and system-call machinery  | Saved registers, ecall/epc, dispatch and arguments, return values, user/kernel trap paths, exception containment                           |
| 10      | Interrupts and device drivers    | Timer path, interrupt enable/masking, PLIC claim/complete, UART registers and buffering, console input, VirtIO request/completion          |
| 11      | Context switching                | Kernel contexts versus trapframes, swtch registers, kernel stacks, yield/preemption, scheduler invariants, sleep lock handoff              |
| 12      | Locks and coordination           | Atomic exchange, ownership, interrupt nesting, memory ordering, sleep locks, lost-wakeup prevention and lock ordering                      |
| 13      | Filesystem structure             | Disk layout/superblock, buffer cache/refcounts, inode cache/locking, directories/path traversal, bitmap allocation, direct/indirect blocks |
| 14      | Logging and recovery             | Operation reservation, log absorption, write-ahead commit, commit point, replay/idempotence, interrupted-commit image recovery             |
| 15      | Loading programs and integration | ELF validation/segments, BSS, argv and user stack, exec commit/failure, shell composition, source-led capstone                             |

Each new chapter is implemented, tested and merged before starting the next.
The contents page links every chapter. This matrix defines the completed
functional scope; it does not claim every OS extension or hardware model.

## Lesson acceptance criteria

- One new idea, with vocabulary explained before use and exact matching source.
- A real C edit, browser compilation and actual guest execution; no inferred or
  fabricated kernel results.
- An actionable experiment, an observable expected result, and a concise takeaway.
- A local C reminder and precise optional C Foundry references.
- Starter and suggested edit tested against the real guest; phone/desktop
  navigation, readable content and failure recovery checked in Chromium.
- Kernel lessons identify the function actually replaced and their supplied test
  program. Native instruction helpers bridge assembly the browser C compiler
  cannot assemble; their source and limits are visible.

## Functional scope

One emulated hart, disposable filesystems, bounded incremental compilation and
the pinned xv6 implementation. Explain interrupt concurrency and multicore lock
reasoning without claiming measured multicore contention, hardware timing or
weak-memory testing. Recovery uses an explicitly prepared interrupted-commit
disk image and the actual journal replay code; it does not claim a physical
power-loss experiment. Extensions absent from this kernel, such as copy-on-write
fork, are distinguished from implemented xv6 mechanisms.
