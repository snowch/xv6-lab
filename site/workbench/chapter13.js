import { lesson, program } from "./lesson-helpers.js?v=chapter7";
const hook = (body) =>
  "uint64\nsys_getpid(void)\n{\n" + body + "\n  return myproc()->pid;\n}\n";
const cache = ["kernel/fs.h", "kernel/sleeplock.h", "kernel/buf.h"],
  inode = ["kernel/fs.h", "kernel/sleeplock.h", "kernel/file.h"];
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
    editorHeight: 660,
    contextTitle: "Read the filesystem path",
    contextFiles: [
      "kernel/fs.c",
      "kernel/bio.c",
      "kernel/fs.h",
      "kernel/file.h",
    ],
    ...details,
  });
const blocks = program(
  "  int fd = open(\"mapped\", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  char block[1024];\n  memset(block, 'D', sizeof block);\n  for (int i = 0; i < 13; i++)\n    if (write(fd, block, sizeof block) != sizeof block) exit(1);\n  close(fd);\n  getpid();",
  { headers: ["kernel/fcntl.h"] },
);
export const chapter13Lessons = {
  "the-superblock-describes-disk-regions": k(
    { headers: ["kernel/fs.h"], globals: "extern struct superblock sb;" },
    {
      title: "The superblock describes disk regions",
      goal: "Distinguish the whole image from its data-block region.",
      starter: () =>
        hook(
          '  uint count = sb.size;\n  printf("selected block count=%d\\n", count);',
        ),
      reading:
        "<p>xv6 divides its disk into a boot block, superblock, log, inode blocks, bitmap and data blocks. The superblock records their sizes and starting positions. fsinit reads it from block 1 and checks its magic before using the filesystem.</p><p>The probe reads the actual in-memory superblock loaded from this image. size counts all 1000 blocks. nblocks counts the 954 blocks in the data region. That region contains both allocated and unallocated blocks: nblocks is not a count of currently free space.</p><p>Build and observe 1000. Select nblocks to observe 954. The source shows how mkfs describes the format; later pages follow the bitmap that tracks allocation within it.</p>",
      excerpt: {
        file: "kernel/fs.h",
        anchor: "struct superblock {",
        after: 10,
      },
      sourceNote:
        "Block numbers identify 1024-byte filesystem blocks. Metadata regions reserve space before the data region; a file's byte offset is a different coordinate.",
      assignment:
        "Change count = sb.size to count = sb.nblocks. Build and run; selected block count becomes 954.",
      expected: "selected block count=1000",
      takeaway:
        "Disk layout metadata describes regions; allocation metadata describes which blocks are in use.",
      reflection:
        "Why does nblocks not tell you how many more blocks a program can allocate?",
    },
  ),
  "the-buffer-cache-reuses-block-identity": k(
    { headers: cache, functions: ["bread", "brelse"] },
    {
      title: "The buffer cache reuses a block’s identity",
      goal: "Observe a cached buffer without confusing its address with a disk block number.",
      starter: () =>
        hook(
          '  struct buf *first = bread(ROOTDEV, 1);\n  brelse(first);\n  struct buf *second = bread(ROOTDEV, 1);\n  printf("same cache object=%d\\n", first == second);\n  brelse(second);',
        ),
      reading:
        "<p>bread returns a locked cache buffer for a device and block number. bget finds an existing identity or recycles an unreferenced buffer; bread reads the device only if that buffer is not valid.</p><p>This controlled probe releases the superblock buffer, then requests the same block again. Build and observe the same cache object. Request block 2 instead to obtain a different identity. Comparing these fixed cache-object addresses does not grant permission to keep using a released buffer.</p><p>brelse drops the reference and moves an unused buffer to the most-recently-used end of the list. bget searches from the opposite end when recycling. A live reference prevents that buffer from being recycled; the next lesson inspects that protection.</p>",
      excerpt: {
        file: "kernel/bio.c",
        within: "bget(uint dev",
        anchor: "if(b->dev == dev",
        before: 3,
        after: 12,
      },
      sourceNote:
        "The cache lock protects identities and reference counts; each buffer's sleeping lock protects its contents. The cache array remains allocated, but callers must own a reference and content lock to use a buffer.",
      assignment:
        "Change only the second bread call’s block number from 1 to 2. Build and run; same cache object becomes 0.",
      expected: "same cache object=1",
      takeaway:
        "A buffer cache manages reusable memory objects keyed by device and block identity.",
      reflection:
        "Why must an unreferenced buffer be eligible for recycling even if its bytes remain valid?",
    },
  ),
  "references-keep-cache-buffers-resident": k(
    { headers: cache, functions: ["bread", "brelse", "bpin", "bunpin"] },
    {
      title: "References keep cache buffers resident",
      goal: "Observe real pin counts and balance their lifetime.",
      starter: () =>
        "#define PINS 1\n" +
        hook(
          '  struct buf *b = bread(ROOTDEV, 1);\n  int before = b->refcnt;\n  for (int i = 0; i < PINS; i++) bpin(b);\n  int added = b->refcnt - before;\n  for (int i = 0; i < PINS; i++) bunpin(b);\n  brelse(b);\n  printf("added cache references=%d\\n", added);',
        ),
      reading:
        "<p>A valid cached block can still be recycled once nobody references it. A pin adds a reference that survives an ordinary brelse. The journal uses this to retain modified buffers until commit has copied their final bytes.</p><p>The probe holds a real buffer, adds one pin, reads the change in refcnt, then balances the pin and its original bread reference. Build and observe 1. Change PINS to 2 to observe two real additional references.</p><p>A pin does not itself grant the content lock, write the disk or make an inode persist. These are separate protocols. Leaving a pin unbalanced can exhaust the fixed cache by making buffers permanently ineligible for recycling.</p>",
      excerpt: {
        file: "kernel/bio.c",
        anchor: "bpin(struct buf *b)",
        before: 1,
        after: 11,
      },
      sourceNote:
        "bpin and bunpin change refcnt under bcache.lock. The loops deliberately balance every added reference before brelse.",
      assignment:
        "Change PINS from 1 to 2. Build and run; added cache references becomes 2, with all references still balanced.",
      expected: "added cache references=1",
      takeaway:
        "Residency, content ownership and persistence are different responsibilities.",
      reflection:
        "Why does the log need a pin after a filesystem caller releases its buffer?",
    },
  ),
  "inode-references-and-loaded-metadata-differ": k(
    {
      headers: inode,
      functions: ["begin_op", "end_op", "namei", "ilock", "iunlockput"],
    },
    {
      title: "An inode reference can precede loaded metadata",
      goal: "Observe lazy inode loading at ilock.",
      starter: () =>
        hook(
          '  begin_op();\n  struct inode *ip = namei("README");\n  if (!ip) { end_op(); return -1; }\n  int before = ip->valid;\n  ilock(ip);\n  int after = ip->valid;\n  int observed = before;\n  iunlockput(ip);\n  end_op();\n  printf("inode metadata loaded=%d\\n", observed);',
        ),
      reading:
        "<p>An inode number identifies a file on a device. iget returns a referenced in-memory inode object, but it need not read the on-disk inode yet. Newly reused cache entries start with valid=0.</p><p>ilock acquires the inode’s sleeping lock. If metadata is not loaded, it reads the corresponding inode block and fills type, size and block addresses before setting valid. The supplied README lookup starts with a fresh inode-cache reference in this fixture. Its before sample is a controlled diagnostic; normal callers acquire ilock before using inode metadata.</p><p>Build and observe valid=0 before ilock. Select after to observe 1. A reference keeps the inode object alive; its lock protects the loaded metadata. Neither is the directory link count, which governs names and on-disk lifetime.</p>",
      excerpt: {
        file: "kernel/fs.c",
        within: "ilock(struct inode",
        anchor: "if(ip->valid == 0)",
        after: 15,
      },
      sourceNote:
        "iget's cache lock protects object identity and ref. ilock protects metadata through a sleeping lock and can perform disk I/O. iunlockput combines unlock with dropping the reference.",
      assignment:
        "Change observed = before to observed = after. Build and run; inode metadata loaded becomes 1.",
      expected: "inode metadata loaded=0",
      takeaway:
        "Finding an inode, retaining it and locking its metadata are separate steps.",
      reflection:
        "Why can namei return a usable reference before this inode's metadata has been loaded?",
    },
  ),
  "paths-start-at-root-or-the-current-directory": lesson({
    title: "A path starts at root or the current directory",
    goal: "Follow directory traversal from its selected starting inode.",
    editorHeight: 750,
    starter: () =>
      program(
        '  int fd = open("item", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  write(fd, "R", 1); close(fd);\n  if (mkdir("notes") < 0) exit(1);\n  fd = open("notes/item", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  write(fd, "S", 1); close(fd);\n  if (chdir("notes") < 0) exit(1);\n  char *selected = "item";\n  fd = open(selected, O_RDONLY);\n  if (fd < 0) exit(1);\n  char byte = 0;\n  read(fd, &byte, 1); close(fd);\n  printf("selected file byte=%c\\n", byte);',
        { headers: ["kernel/fcntl.h"] },
      ),
    reading:
      "<p>A directory is a file containing name-to-inode-number entries. Path traversal resolves one component at a time, locking each directory while checking its type and looking up the next entry.</p><p>namex starts at the root inode when a path begins with /. Otherwise it takes a reference to the process’s current directory. chdir changes that process reference; it does not move files or rewrite their names.</p><p>The program creates item at root containing R and notes/item containing S, then enters notes. Build to read the relative item and get S. Select /item to start at root and get R. Both final components have the same name, but traversal reaches different inodes.</p>",
    excerpt: {
      file: "kernel/fs.c",
      within: "namex(char *path",
      anchor: "if(*path == '/')",
      after: 20,
    },
    sourceNote:
      "dirlookup reads directory entries. namex releases each previous inode after obtaining the next, rather than retaining every directory lock for the whole path.",
    assignment:
      'Change selected = "item" to selected = "/item". Build and run; selected file byte changes from S to R.',
    expected: "selected file byte=S",
    takeaway:
      "A path is resolved relative to an explicit starting inode, not a globally unique filename.",
    reflection:
      "What changes when a process calls chdir: the file's directory entry or its own cwd reference?",
    contextTitle: "Read path traversal",
    contextFiles: ["kernel/fs.c", "kernel/sysfile.c"],
  }),
  "the-bitmap-tracks-block-ownership": k(
    {
      headers: cache,
      functions: ["begin_op", "end_op", "bread", "brelse"],
      globals:
        "extern struct superblock sb;\nuint balloc(uint);\nvoid bfree(int,uint);",
    },
    {
      title: "The bitmap tracks block ownership",
      goal: "Observe the bit changed by actual allocation and freeing.",
      starter: () =>
        hook(
          '  begin_op();\n  uint block = balloc(ROOTDEV);\n  uint bit = block % BPB;\n  struct buf *b = bread(ROOTDEV, BBLOCK(block, sb));\n  int before = (b->data[bit / 8] >> (bit % 8)) & 1;\n  brelse(b);\n  bfree(ROOTDEV, block);\n  b = bread(ROOTDEV, BBLOCK(block, sb));\n  int after = (b->data[bit / 8] >> (bit % 8)) & 1;\n  brelse(b);\n  end_op();\n  int observed = before;\n  printf("allocation bit=%d\\n", observed);',
        ),
      reading:
        "<p>The free-space bitmap uses one bit per block: 1 means allocated, 0 means free. balloc scans for zero, sets the bit, records that metadata change in the log and zeroes the newly allocated data block.</p><p>The probe runs a real allocation and free inside a filesystem operation. It reads the corresponding bitmap byte after each change. Build and observe the allocated bit as 1; select the after-free snapshot to observe 0.</p><p>The bitmap buffer is released before bfree, because bfree needs to lock that same buffer itself. This is another place where correct resource lifetime matters. Both metadata changes participate in the log protocol; the next chapter explains its commit boundary.</p>",
      excerpt: {
        file: "kernel/fs.c",
        within: "balloc(uint dev)",
        anchor: "if((bp->data[bi/8]",
        before: 2,
        after: 9,
      },
      sourceNote:
        "BBLOCK selects the bitmap block; BPB and the remainder select the bit inside it. Freeing changes ownership, not the file's logical block mapping by itself.",
      assignment:
        "Change observed = before to observed = after. Build and run; allocation bit becomes 0. Keep the balanced allocation/free sequence intact.",
      expected: "allocation bit=1",
      takeaway:
        "Allocation is a metadata update that must be coordinated with block contents and filesystem transactions.",
      reflection:
        "Why must the probe release its bitmap buffer before calling bfree?",
    },
  ),
  "direct-and-indirect-blocks-map-file-offsets": k(
    {
      headers: inode,
      functions: ["begin_op", "end_op", "namei", "ilock", "iunlockput"],
      globals: "uint bmap(struct inode*,uint);",
      probe: blocks,
    },
    {
      title: "An indirect block extends a file’s block map",
      goal: "Follow the transition from the last direct pointer to an indirect entry.",
      starter: () =>
        hook(
          '  begin_op();\n  struct inode *ip = namei("mapped");\n  if (!ip) { end_op(); return -1; }\n  ilock(ip);\n  uint logical = 11;\n  uint physical = bmap(ip, logical);\n  printf("maps last direct block=%d indirect table present=%d\\n", physical == ip->addrs[NDIRECT - 1], ip->addrs[NDIRECT] != 0);\n  iunlockput(ip);\n  end_op();',
        ),
      reading:
        "<p>A file byte offset first becomes a logical block index and an offset within that block. bmap translates the logical index to a physical disk block. The first twelve entries are direct pointers stored in the inode.</p><p>The next inode slot points to a block containing 256 more block numbers. For logical index 12, bmap subtracts NDIRECT and reads entry zero from that indirect block. With 1024-byte blocks, this version supports 268 data blocks per file; the indirect table itself also consumes disk space.</p><p>The supplied program prepares thirteen data blocks. Build with logical=11 to match the inode’s last direct pointer. Select 12 to obtain a different physical block through the actual indirect lookup. The table remains present in both runs. bmap can allocate missing blocks, but this fixture has already populated both paths.</p>",
      excerpt: {
        file: "kernel/fs.c",
        within: "bmap(struct inode",
        anchor: "if(bn < NDIRECT)",
        after: 26,
      },
      sourceNote:
        "The indirect table's block address is not the physical address of the first indirect data block. bmap reads that table to obtain the data-block address.",
      assignment:
        "Change logical = 11 to logical = 12. Build and run; maps last direct block becomes 0 while indirect table present remains 1.",
      expected: "maps last direct block=1 indirect table present=1",
      takeaway:
        "Logical file blocks are translated through a small tree of disk block numbers.",
      reflection:
        "Why does a thirteen-block file need a separate indirect-table block?",
    },
  ),
  "truncation-releases-a-files-block-map": lesson({
    title: "Truncation releases a file’s block map",
    goal: "Distinguish removing file data from removing a directory name.",
    editorHeight: 720,
    starter: () =>
      program(
        '  int fd = open("trim", O_CREATE | O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  char block[1024]; memset(block, \'T\', sizeof block);\n  for (int i = 0; i < 13; i++)\n    if (write(fd, block, sizeof block) != sizeof block) exit(1);\n  close(fd);\n  fd = open("trim", O_RDWR | O_TRUNC);\n  if (fd < 0) exit(1);\n  struct stat st;\n  if (fstat(fd, &st) < 0) exit(1);\n  printf("size after reopening=%d links=%d\\n", (int)st.size, st.nlink);\n  close(fd);',
        { headers: ["kernel/fcntl.h", "kernel/stat.h"] },
      ),
    reading:
      "<p>O_TRUNC keeps a file’s name and inode but discards its data. itrunc frees the direct data blocks, follows and frees every indirect entry, frees the indirect table, clears pointers and records a size of zero.</p><p>The program writes thirteen blocks, closes the file and reopens it with O_TRUNC. Build and observe size 0 with one directory link. Remove O_TRUNC only from the second open to retain all 13312 bytes.</p><p>This differs from unlink, which removes a name and decrements the link count. Unlink may defer reclamation while references remain; truncation deliberately changes the still-named file’s data. Both must coordinate inode locking, bitmap changes and logging.</p>",
    excerpt: {
      file: "kernel/fs.c",
      within: "itrunc(struct inode",
      anchor: "for(i = 0; i < NDIRECT",
      after: 28,
    },
    sourceNote:
      "itrunc clears the block pointers as it frees blocks, then sets size=0 and calls iupdate. An indirect table is freed only after its data entries.",
    assignment:
      "In the second open only, change O_RDWR | O_TRUNC to O_RDWR. Build and run; size after reopening becomes 13312 while links remains 1.",
    expected: "size after reopening=0 links=1",
    takeaway:
      "File data lifetime and directory-name lifetime are different operations on the same inode.",
    reflection:
      "Why must truncation free both indirect data blocks and the indirect table?",
    contextTitle: "Read data reclamation",
    contextFiles: ["kernel/fs.c", "kernel/sysfile.c"],
  }),
};
