# Original concept diagrams

The course contains 46 original concept models, placed in 91 of its 99 lessons. Eight models have manually controlled steps. A model is reused where the same mechanism connects several lessons; diagrams are omitted where they would add little to the explanation.

## Authorship and rights

The diagram layouts, connectors, labels, explanatory text and interaction sequences were authored specifically for xv6 Lab. No textbook figures, screenshots, external icon sets, downloaded illustrations or third-party diagram assets were copied or adapted. The diagrams use semantic HTML, CSS connectors and text; they are covered by this repository’s [MIT license](../LICENSE).

Technical mechanisms were checked against the lab’s pinned, MIT-licensed xv6 source in `guest/`, with matching source anchors printed beside each diagram. The existing xv6 copyright and license notices are retained. Existing bundled fonts retain their own license notices. These diagrams are separate from the generated front-page illustration and introduce no new third-party visual assets or dependencies.

## Learning and accessibility

Each diagram sits between its lesson explanation and the matching source. Reading, source editing, building and guest execution stay on the same page. Labels use real selectable text rather than shrinking an image; layouts reflow into vertical paths or nested branches on narrow screens.

Step controls are native keyboard-operable buttons with explicit boundaries and a polite text announcement. Nothing autoplays. A disclosure includes the complete sequence in text, also available without JavaScript. The initial diagram is included in the generated HTML.

All state is illustrative. Changing a diagram step neither executes the guest nor changes edited C, console output, source drafts or evidence. The scheduler sequence is one possible ordering, not a timing guarantee. The page walk models ordinary 4 KiB mappings in this kernel. The recovery model describes the lesson’s prepared committed journal entry. Source and actual guest observations remain authoritative.

## Maintenance

Model data, lesson associations, HTML rendering and step enhancement live in [concept-diagrams.js](../site/workbench/concept-diagrams.js). Styles live in [style.css](../site/workbench/style.css). After edits, run `npm run build:lessons` to update the static pages. Node tests check lesson associations, no-JavaScript content, step boundaries and meaningful state transitions; browser tests check label sizes, keyboard operation, draft preservation and responsive overflow across all lesson pages at four widths.

## Inventory

Each row links a representative lesson. Source anchors name the mechanism used to check the explanation; they are not visual sources or copied figure credits.

| Model                                                                                                                                   | Sequence | Matching xv6 source anchors                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| [Source, executable and process are different things](https://snowch.github.io/xv6-lab/lessons/running-a-program/)                      | Static   | user/sh.c · runcmd; kernel/proc.c · fork; kernel/exec.c · exec                  |
| [The count selects bytes, not a whole string](https://snowch.github.io/xv6-lab/lessons/writing-bytes/)                                  | Static   | kernel/sysfile.c · sys_write; kernel/file.c · filewrite                         |
| [A request delivers a C return value](https://snowch.github.io/xv6-lab/lessons/a-system-call-result/)                                   | Static   | user/user.h · getpid; kernel/sysproc.c · sys_getpid                             |
| [Follow the current CPU’s process pointer](https://snowch.github.io/xv6-lab/lessons/the-current-process/)                               | Static   | kernel/proc.c · myproc; kernel/proc.h · struct cpu · struct proc                |
| [Computing an answer does not assign to the record](https://snowch.github.io/xv6-lab/lessons/changing-the-answer/)                      | Static   | kernel/sysproc.c · sys_getpid; kernel/syscall.c · syscall                       |
| [A request crosses a privilege boundary](https://snowch.github.io/xv6-lab/lessons/entering-the-kernel/)                                 | 3 steps  | user/usys.S · kernel/trampoline.S · kernel/trap.c · kernel/syscall.c            |
| [One fork creates two continuations](https://snowch.github.io/xv6-lab/lessons/fork-creates-a-child/)                                    | Static   | kernel/proc.c · fork · uvmcopy                                                  |
| [Exit and collection are different events](https://snowch.github.io/xv6-lab/lessons/waiting-for-a-child/)                               | Static   | kernel/proc.c · exit · wait                                                     |
| [Prepare first; replace only on success](https://snowch.github.io/xv6-lab/lessons/exec-replaces-the-program/)                           | 3 steps  | kernel/exec.c · exec                                                            |
| [Memory growth crosses page boundaries](https://snowch.github.io/xv6-lab/lessons/growing-user-memory/)                                  | Static   | kernel/proc.c · growproc; kernel/vm.c · uvmalloc                                |
| [Split an Sv39 virtual address](https://snowch.github.io/xv6-lab/lessons/splitting-a-virtual-address/)                                  | Static   | kernel/riscv.h · PX · PXSHIFT · PGSIZE                                          |
| [Follow a three-level page-table walk](https://snowch.github.io/xv6-lab/lessons/walking-three-page-table-levels/)                       | 4 steps  | kernel/vm.c · walk · walkaddr                                                   |
| [A mapped page can still deny user access](https://snowch.github.io/xv6-lab/lessons/a-guard-page-denies-user-access/)                   | Static   | kernel/exec.c · uvmclear; kernel/vm.c · uvmclear                                |
| [A stale address does not retain its mapping](https://snowch.github.io/xv6-lab/lessons/a-user-fault-is-contained/)                      | Static   | kernel/vm.c · uvmdealloc; kernel/trap.c · usertrap; kernel/proc.c · exit · wait |
| [Read permissions before using an address](https://snowch.github.io/xv6-lab/lessons/reading-page-permissions/)                          | Static   | kernel/riscv.h · PTE flags; kernel/vm.c · walkaddr                              |
| [Checked copies cross one page at a time](https://snowch.github.io/xv6-lab/lessons/the-kernel-checks-user-pointers/)                    | Static   | kernel/vm.c · copyin · copyout                                                  |
| [A descriptor is an index, not the file itself](https://snowch.github.io/xv6-lab/lessons/opening-and-closing-files/)                    | Static   | kernel/proc.h · ofile; kernel/file.h · struct file; kernel/sysfile.c · sys_dup  |
| [Two names can identify one inode](https://snowch.github.io/xv6-lab/lessons/unlink-keeps-open-files-alive/)                             | Static   | kernel/fs.c · dirlink · iput; kernel/sysfile.c · sys_link · sys_unlink          |
| [A pipe connects writers to readers](https://snowch.github.io/xv6-lab/lessons/a-pipe-connects-two-descriptors/)                         | Static   | kernel/pipe.c · pipewrite · piperead                                            |
| [Empty does not always mean EOF](https://snowch.github.io/xv6-lab/lessons/eof-needs-closed-writers/)                                    | Static   | kernel/pipe.c · piperead · pipeclose                                            |
| [Wakeup makes a process eligible to run](https://snowch.github.io/xv6-lab/lessons/runnable-processes-take-turns/)                       | 5 steps  | kernel/proc.c · scheduler · yield · sleep · wakeup                              |
| [Boot establishes dependencies before running users](https://snowch.github.io/xv6-lab/lessons/editing-the-kernel-boot/)                 | Static   | kernel/entry.S · start.c · main.c · proc.c                                      |
| [The transition code is mapped on both sides](https://snowch.github.io/xv6-lab/lessons/trampoline-mappings-cross-address-spaces/)       | Static   | kernel/memlayout.h · trampoline.S · proc.c · vm.c                               |
| [Two saved contexts serve different boundaries](https://snowch.github.io/xv6-lab/lessons/kernel-contexts-save-a-call-boundary/)         | Static   | kernel/proc.h · struct trapframe · struct context; kernel/swtch.S               |
| [Switch through the CPU scheduler](https://snowch.github.io/xv6-lab/lessons/yield-hands-a-process-to-the-scheduler/)                    | 3 steps  | kernel/proc.c · sched · scheduler; kernel/swtch.S                               |
| [Sleep closes the gap with overlapping protection](https://snowch.github.io/xv6-lab/lessons/sleep-transfers-lock-protection/)           | 4 steps  | kernel/proc.c · sleep · wakeup                                                  |
| [A machine timer event becomes a kernel tick](https://snowch.github.io/xv6-lab/lessons/sleep-counts-guest-ticks/)                       | Static   | kernel/start.c · kernel/kernelvec.S · kernel/trap.c                             |
| [Service the device and complete the claim](https://snowch.github.io/xv6-lab/lessons/claiming-and-completing-device-interrupts/)        | Static   | kernel/trap.c · devintr; kernel/plic.c · plic_claim · plic_complete             |
| [A ring reuses a fixed set of slots](https://snowch.github.io/xv6-lab/lessons/uart-output-passes-through-a-ring/)                       | Static   | kernel/uart.c · uart_tx_w · uart_tx_r; kernel/pipe.c · nwrite · nread           |
| [A block request links three descriptors](https://snowch.github.io/xv6-lab/lessons/virtio-descriptors-name-device-buffers/)             | Static   | kernel/virtio_disk.c · virtio_disk_rw · virtio_disk_intr                        |
| [Filesystem blocks have different jobs](https://snowch.github.io/xv6-lab/lessons/the-superblock-describes-disk-regions/)                | Static   | kernel/fs.h · struct superblock; mkfs/mkfs.c                                    |
| [Identity, references and content locking differ](https://snowch.github.io/xv6-lab/lessons/the-buffer-cache-reuses-block-identity/)     | Static   | kernel/bio.c · bget · brelse · bpin · bunpin                                    |
| [An inode reference can precede loaded metadata](https://snowch.github.io/xv6-lab/lessons/inode-references-and-loaded-metadata-differ/) | Static   | kernel/fs.c · iget · ilock · iput                                               |
| [Direct pointers and an indirect table](https://snowch.github.io/xv6-lab/lessons/direct-and-indirect-blocks-map-file-offsets/)          | Static   | kernel/fs.h · NDIRECT · NINDIRECT; kernel/fs.c · bmap                           |
| [The lock guards a protocol, not just a word](https://snowch.github.io/xv6-lab/lessons/locks-protect-shared-kernel-state/)              | Static   | kernel/spinlock.c · acquire · release                                           |
| [A sleeping lock has two kinds of ownership](https://snowch.github.io/xv6-lab/lessons/a-sleeping-lock-does-not-spin-through-io/)        | Static   | kernel/sleeplock.c · acquiresleep · releasesleep                                |
| [Publish the commit record between data and installation](https://snowch.github.io/xv6-lab/lessons/writes-pass-through-the-log/)        | 4 steps  | kernel/log.c · commit · write_log · write_head · install_trans                  |
| [Replay the committed image into its home block](https://snowch.github.io/xv6-lab/lessons/boot-replays-a-committed-journal/)            | 4 steps  | kernel/log.c · recover_from_log · install_trans                                 |
| [Construct a memory image from ELF segments](https://snowch.github.io/xv6-lab/lessons/elf-headers-identify-an-executable/)              | Static   | kernel/exec.c · exec · loadseg; kernel/vm.c · uvmalloc                          |
| [Rebuild argv in the new address space](https://snowch.github.io/xv6-lab/lessons/exec-builds-a-new-argument-vector/)                    | Static   | kernel/sysfile.c · sys_exec; kernel/exec.c · exec                               |
| [Dup adds a slot, not another offset](https://snowch.github.io/xv6-lab/lessons/dup-shares-the-open-file/)                               | Static   | kernel/sysfile.c · sys_dup; kernel/file.c · filedup · fileread                  |
| [The starting inode changes path resolution](https://snowch.github.io/xv6-lab/lessons/paths-start-at-root-or-the-current-directory/)    | Static   | kernel/fs.c · namex · dirlookup; kernel/sysfile.c · sys_chdir                   |
| [Kernel mappings include memory and devices](https://snowch.github.io/xv6-lab/lessons/kernel-mappings-include-devices/)                 | Static   | kernel/vm.c · kvminit · kvminithart; kernel/memlayout.h                         |
| [Opposite lock orders can form a wait cycle](https://snowch.github.io/xv6-lab/lessons/lock-order-prevents-circular-wait/)               | Static   | kernel/spinlock.c · acquire; kernel/proc.c · wait                               |
| [The child changes where stdout leads](https://snowch.github.io/xv6-lab/lessons/the-shell-composes-kernel-interfaces/)                  | Static   | user/sh.c · runcmd; kernel/sysfile.c · sys_open; kernel/exec.c                  |
| [Follow the capstone’s bytes](https://snowch.github.io/xv6-lab/lessons/capstone-follow-a-byte-from-process-to-disk/)                    | Static   | kernel/pipe.c · file.c · fs.c · log.c · virtio_disk.c · exec.c                  |
