// Incremental ELF64/RISC-V linker for the workbench's reserved code slots.
// Existing xv6 code and data remain linked by GNU ld; this links the edited C object.
const align = (n, a) => Math.ceil(n / Math.max(1, a)) * Math.max(1, a);
export function readElf(input) {
  const bytes = new Uint8Array(input),
    view = new DataView(bytes.buffer),
    u16 = (o) => view.getUint16(o, true),
    u32 = (o) => view.getUint32(o, true),
    u64 = (o) => Number(view.getBigUint64(o, true));
  if (
    bytes[0] !== 127 ||
    bytes[1] !== 69 ||
    bytes[2] !== 76 ||
    bytes[3] !== 70 ||
    bytes[4] !== 2 ||
    bytes[5] !== 1 ||
    u16(18) !== 243
  )
    throw new Error("Expected a little-endian ELF64 RISC-V image.");
  const string = (offset, index) => {
    let end = offset + index;
    while (end < bytes.length && bytes[end]) end++;
    return new TextDecoder().decode(bytes.subarray(offset + index, end));
  };
  const sections = [];
  for (let i = 0; i < u16(60); i++) {
    const o = u64(40) + i * u16(58);
    sections.push({
      index: i,
      nameIndex: u32(o),
      type: u32(o + 4),
      flags: u64(o + 8),
      address: u64(o + 16),
      offset: u64(o + 24),
      size: u64(o + 32),
      link: u32(o + 40),
      info: u32(o + 44),
      alignment: u64(o + 48),
      entrySize: u64(o + 56),
    });
  }
  const names = sections[u16(62)];
  for (const section of sections)
    section.name = string(names.offset, section.nameIndex);
  const symbols = new Map(),
    tables = new Map();
  for (const section of sections.filter((s) => s.type === 2)) {
    const entries = [];
    for (
      let o = section.offset;
      o < section.offset + section.size;
      o += section.entrySize
    ) {
      const symbol = {
        index: entries.length,
        name: string(sections[section.link].offset, u32(o)),
        info: bytes[o + 4],
        section: u16(o + 6),
        value: u64(o + 8),
        size: u64(o + 16),
      };
      entries.push(symbol);
      if (symbol.name) symbols.set(symbol.name, symbol);
    }
    tables.set(section.index, entries);
  }
  return {
    bytes,
    view,
    sections,
    symbols,
    tables,
    offset(address) {
      const s = sections.find(
        (s) =>
          s.type === 1 &&
          s.flags & 2 &&
          address >= s.address &&
          address < s.address + s.size,
      );
      if (!s)
        throw new Error(
          "Address outside the linked image: 0x" + address.toString(16),
        );
      return s.offset + address - s.address;
    },
  };
}
export function linkEditedObject(baseBytes, objectBytes, target) {
  const base = readElf(baseBytes),
    object = readElf(objectBytes),
    start = base.symbols.get("workbench_patch_start")?.value,
    end = base.symbols.get("workbench_patch_end")?.value;
  if (!start || !end || end <= start)
    throw new Error("The base image has no workbench link slot.");
  const dataStart = base.symbols.get("workbench_data_start")?.value,
    dataEnd = base.symbols.get("workbench_data_end")?.value;
  let cursor = start,
    dataCursor = dataStart;
  for (const s of object.sections) {
    if (!(s.flags & 2) || ![1, 8].includes(s.type)) continue;
    if (dataStart && s.flags & 1) {
      dataCursor = align(dataCursor, s.alignment);
      s.loaded = dataCursor;
      dataCursor += s.size;
    } else {
      cursor = align(cursor, s.alignment);
      s.loaded = cursor;
      cursor += s.size;
    }
  }
  const common = new Map();
  for (const entries of object.tables.values())
    for (const symbol of entries)
      if (symbol.section === 0xfff2) {
        if (dataStart) {
          dataCursor = align(dataCursor, symbol.value);
          common.set(symbol, dataCursor);
          dataCursor += symbol.size;
        } else {
          cursor = align(cursor, symbol.value);
          common.set(symbol, cursor);
          cursor += symbol.size;
        }
      }
  if (dataStart && dataCursor > dataEnd)
    throw new Error("Edited global data exceeds the 16 KiB kernel data slot.");
  if (cursor > end)
    throw new Error("Edited object exceeds the 64 KiB exercise link slot.");
  const result = base.bytes.slice(),
    data = new DataView(result.buffer);
  for (const s of object.sections)
    if (s.loaded !== undefined && s.type !== 8)
      result.set(
        object.bytes.subarray(s.offset, s.offset + s.size),
        base.offset(s.loaded),
      );
  function resolve(symbol) {
    if (symbol.section === 0xfff1) return symbol.value;
    if (symbol.section === 0xfff2) return common.get(symbol);
    if (symbol.section) {
      const s = object.sections[symbol.section];
      if (s?.loaded === undefined)
        throw new Error("Symbol in unsupported section: " + symbol.name);
      return s.loaded + symbol.value;
    }
    if (!symbol.name) return 0;
    const external = base.symbols.get(symbol.name);
    if (external) return external.value;
    if (symbol.info >> 4 === 2) return 0;
    throw new Error(
      "Undefined symbol: " +
        symbol.name +
        ". Use the xv6 functions declared in user/user.h or the documented kernel context.",
    );
  }
  const relocations = [];
  for (const s of object.sections.filter((s) => s.type === 4)) {
    const section = object.sections[s.info];
    if (section.loaded === undefined) continue;
    const entries = object.tables.get(s.link);
    for (let o = s.offset; o < s.offset + s.size; o += s.entrySize) {
      const info = object.view.getBigUint64(o + 8, true),
        type = Number(info & 0xffffffffn),
        symbol = entries[Number(info >> 32n)],
        addend = Number(object.view.getBigInt64(o + 16, true)),
        place = section.loaded + Number(object.view.getBigUint64(o, true));
      relocations.push({ type, symbol, addend, place });
    }
  }
  // GOT_HI20 addresses a pointer cell, followed by a paired PCREL_LO12 load.
  // Keep these cells in the reserved data area alongside edited kernel globals.
  const got = new Map();
  for (const r of relocations.filter((r) => r.type === 20)) {
    const value = resolve(r.symbol) + r.addend;
    if (got.has(value)) continue;
    const address = align(dataStart ? dataCursor : cursor, 8);
    if (dataStart) dataCursor = address + 8;
    else cursor = address + 8;
    if ((dataStart && dataCursor > dataEnd) || cursor > end)
      throw new Error("Global address table exceeds the exercise link slot.");
    got.set(value, address);
    data.setBigUint64(base.offset(address), BigInt(value), true);
  }
  const hi = new Map();
  for (const r of relocations)
    if (r.type === 23) hi.set(r.place, resolve(r.symbol) + r.addend - r.place);
    else if (r.type === 20)
      hi.set(r.place, got.get(resolve(r.symbol) + r.addend) - r.place);
  function upper(where, value) {
    const at = base.offset(where),
      old = data.getUint32(at, true),
      high = Math.floor((value + 2048) / 4096);
    data.setUint32(at, (old & 4095) | ((high & 0xfffff) << 12), true);
    return value - high * 4096;
  }
  function lowI(where, value) {
    const at = base.offset(where);
    data.setUint32(
      at,
      (data.getUint32(at, true) & 0xfffff) | ((value & 4095) << 20),
      true,
    );
  }
  function lowS(where, value) {
    const at = base.offset(where),
      old = data.getUint32(at, true);
    data.setUint32(
      at,
      (old & 0x01fff07f) | ((value & 31) << 7) | ((value & 0xfe0) << 20),
      true,
    );
  }
  for (const r of relocations) {
    if ([0, 43, 51].includes(r.type)) continue;
    const value = resolve(r.symbol) + r.addend,
      relative = value - r.place,
      at = base.offset(r.place);
    if (r.type === 1) data.setUint32(at, value, true);
    else if (r.type === 2)
      data.setBigUint64(at, BigInt.asUintN(64, BigInt(value)), true);
    else if ([18, 19].includes(r.type)) {
      const low = upper(r.place, relative);
      lowI(r.place + 4, low);
    } else if (r.type === 23) upper(r.place, relative);
    else if (r.type === 20) upper(r.place, hi.get(r.place));
    else if ([24, 25].includes(r.type)) {
      const delta = hi.get(value);
      if (delta === undefined)
        throw new Error("Unpaired RISC-V PC-relative relocation.");
      const low = delta - Math.floor((delta + 2048) / 4096) * 4096;
      (r.type === 24 ? lowI : lowS)(r.place, low);
    } else if (r.type === 26) upper(r.place, value);
    else if (r.type === 27) lowI(r.place, value);
    else if (r.type === 28) lowS(r.place, value);
    else if (r.type === 17) {
      if (relative % 2 || relative < -(1 << 20) || relative >= 1 << 20)
        throw new Error("RISC-V jump outside range.");
      const old = data.getUint32(at, true),
        v = relative;
      data.setUint32(
        at,
        (old & 0xfff) |
          ((v & 0x100000) << 11) |
          ((v & 0x7fe) << 20) |
          ((v & 0x800) << 9) |
          (v & 0xff000),
        true,
      );
    } else if (r.type === 16) {
      const old = data.getUint32(at, true),
        v = relative;
      if (v % 2 || v < -4096 || v >= 4096)
        throw new Error("RISC-V branch outside range.");
      data.setUint32(
        at,
        (old & 0x01fff07f) |
          ((v & 0x1000) << 19) |
          ((v & 0x7e0) << 20) |
          ((v & 0x1e) << 7) |
          ((v & 0x800) >> 4),
        true,
      );
    } else
      throw new Error(
        "This first workbench does not support RISC-V relocation " +
          r.type +
          ". Restore the starter or simplify this edit.",
      );
  }
  const edited = object.symbols.get(target),
    original = base.symbols.get(target);
  if (!edited || !edited.section)
    throw new Error("The edited source must define " + target + ".");
  if (!original || original.size < 8)
    throw new Error("The original function has no safe redirect slot.");
  const destination = resolve(edited),
    at = base.offset(original.value),
    delta = destination - original.value;
  // AUIPC t0; JALR zero,t0 preserves the original return address and argument registers.
  data.setUint32(at, 0x00000297, true);
  data.setUint32(at + 4, 0x00028067, true);
  const low = upper(original.value, delta);
  lowI(original.value + 4, low);
  return {
    bytes: result,
    entry: destination,
    used: cursor - start + (dataStart ? dataCursor - dataStart : 0),
    capacity: end - start + (dataStart ? dataEnd - dataStart : 0),
  };
}
