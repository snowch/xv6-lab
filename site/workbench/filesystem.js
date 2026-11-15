// Offline edit of one existing regular file in a disposable xv6 filesystem image.
export function replaceGuestFile(baseBytes, name, payload) {
  const disk = new Uint8Array(baseBytes),
    v = new DataView(disk.buffer),
    B = 1024,
    u32 = (o) => v.getUint32(o, true),
    put = (o, n) => v.setUint32(o, n, true);
  if (u32(B) !== 0x10203040) throw new Error("Invalid xv6 filesystem image.");
  const blocks = u32(B + 4),
    inodeStart = u32(B + 24),
    bitmapStart = u32(B + 28),
    inode = (i) => inodeStart * B + i * 64;
  const dataStart = bitmapStart + Math.ceil(blocks / (B * 8));
  const fileBlocks = (ino) => {
    const at = inode(ino),
      count = Math.ceil(u32(at + 8) / B),
      result = [];
    for (let i = 0; i < count; i++) {
      const b =
        i < 12 ? u32(at + 12 + i * 4) : u32(u32(at + 60) * B + (i - 12) * 4);
      if (!b) throw new Error("Missing filesystem data block.");
      result.push(b);
    }
    return result;
  };
  const root = inode(1),
    rootBlocks = fileBlocks(1);
  let number = 0;
  for (let i = 0; i < u32(root + 8); i += 16) {
    const at = rootBlocks[Math.floor(i / B)] * B + (i % B);
    let end = at + 2;
    while (end < at + 16 && disk[end]) end++;
    const entry = new TextDecoder().decode(disk.subarray(at + 2, end));
    if (entry === name) {
      number = v.getUint16(at, true);
      break;
    }
  }
  if (!number) throw new Error("Guest starter file not found: " + name);
  const at = inode(number);
  if (v.getUint16(at, true) !== 2)
    throw new Error("Exercise target must be a regular file.");
  const bitmap = (b) => bitmapStart * B + Math.floor(b / 8);
  const release = (b) => {
    if (b < dataStart || b >= blocks)
      throw new Error("Invalid file allocation.");
    disk[bitmap(b)] &= ~(1 << b % 8);
  };
  for (const b of fileBlocks(number)) release(b);
  const oldIndirect = u32(at + 60);
  if (oldIndirect) release(oldIndirect);
  disk.fill(0, at + 12, at + 64);
  const allocate = () => {
    for (let b = dataStart; b < blocks; b++)
      if (!(disk[bitmap(b)] & (1 << b % 8))) {
        disk[bitmap(b)] |= 1 << b % 8;
        disk.fill(0, b * B, (b + 1) * B);
        return b;
      }
    throw new Error("The exercise filesystem is full.");
  };
  const count = Math.ceil(payload.length / B);
  if (count > 268)
    throw new Error("Program exceeds xv6’s direct/indirect file capacity.");
  let indirect = 0;
  for (let i = 0; i < count; i++) {
    const block = allocate();
    if (i < 12) put(at + 12 + i * 4, block);
    else {
      if (!indirect) {
        indirect = allocate();
        put(at + 60, indirect);
      }
      put(indirect * B + (i - 12) * 4, block);
    }
    disk.set(payload.subarray(i * B, (i + 1) * B), block * B);
  }
  put(at + 8, payload.length);
  return disk;
}
