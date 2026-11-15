import init, { WasmRiscv } from "./vendor/riscv_emu_rust_wasm.js?v=mmu2";
let layout,
  source,
  vm,
  timer,
  running = false,
  breakpoint = null;
const hex = (value) => "0x" + value.toString(16).padStart(16, "0");
const send = (type, data = {}) => postMessage({ type, ...data });
function output() {
  let text = "",
    byte;
  while ((byte = vm.get_output()) !== 0) text += String.fromCharCode(byte);
  if (text) send("output", { text });
}
function snapshot(reason) {
  let location = null;
  if (source) {
    const pc = Number(vm.read_pc());
    for (const entry of source.lines) {
      if (entry[0] > pc) break;
      location = entry;
    }
  }
  output();
  vm.disassemble_next_instruction();
  let instruction = "",
    byte;
  while ((byte = vm.get_output()) !== 0)
    instruction += String.fromCharCode(byte);
  send("state", {
    running,
    reason,
    pc: hex(vm.read_pc()),
    registers: Array.from({ length: 32 }, (_, i) => hex(vm.read_register(i))),
    instruction,
    source:
      location && vm.read_pc() >= 0x80000000n && vm.read_pc() < 0x88000000n
        ? {
            path: location[1],
            line: location[2],
            text: source.files[location[1]]
              .split("\n")
              .slice(Math.max(0, location[2] - 4), location[2] + 3)
              .map((s, i) => `${Math.max(1, location[2] - 3) + i}: ${s}`)
              .join("\n"),
          }
        : null,
  });
}
function pause(reason = "Paused") {
  running = false;
  clearTimeout(timer);
  snapshot(reason);
}
function tick() {
  if (!running) return;
  try {
    const hit = breakpoint
      ? vm.run_until_breakpoints(
          new BigUint64Array([breakpoint.address]),
          100000,
        )
      : (vm.run_cycles(100000), false);
    output();
    if (hit) {
      const name = breakpoint.name;
      breakpoint = null;
      pause("Stopped at " + name);
    } else timer = setTimeout(tick, 0);
  } catch (error) {
    running = false;
    send("error", { message: error.message, fatal: true });
  }
}
function resume() {
  if (running) return;
  running = true;
  snapshot(breakpoint ? "Running to " + breakpoint.name : "Running");
  tick();
}
async function asset(path) {
  const response = await fetch(new URL(path + "?v=guest4", import.meta.url));
  if (!response.ok)
    throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
onmessage = async ({ data }) => {
  try {
    if (data.type === "boot") {
      await init({
        module_or_path: await asset("./vendor/riscv_emu_rust_wasm_bg.wasm"),
      });
      const [kernel, disk] = await Promise.all([
        data.kernel
          ? Promise.resolve(new Uint8Array(data.kernel))
          : asset("./images/kernel"),
        data.disk
          ? Promise.resolve(new Uint8Array(data.disk))
          : asset("./images/fs.img"),
      ]);
      layout = JSON.parse(
        new TextDecoder().decode(await asset("./layout.json")),
      );
      source = JSON.parse(
        new TextDecoder().decode(await asset("./source.json")),
      );
      vm = WasmRiscv.new();
      vm.setup_program(kernel);
      vm.setup_filesystem(disk);
      send("ready");
      resume();
      return;
    }
    if (!vm) throw new Error("Boot xv6 first.");
    switch (data.type) {
      case "pause":
        pause();
        break;
      case "continue":
        resume();
        break;
      case "step":
        if (running) throw new Error("Pause before stepping.");
        vm.run_cycles(1);
        snapshot("Stepped one instruction");
        break;
      case "input":
        for (const byte of new TextEncoder().encode(data.text))
          vm.put_input(byte);
        break;
      case "break": {
        if (
          ![
            "sys_write",
            "sys_fork",
            "sys_exec",
            "usertrap",
            "sys_getpid",
            "sys_wait",
            "sys_exit",
            "sys_dup",
            "sys_unlink",
            "sys_link",
            "sys_mkdir",
            "sys_sbrk",
            "sys_sleep",
            "scheduler",
            "sched",
            "piperead",
            "acquire",
            "bread",
            "bmap",
            "writei",
            "begin_op",
            "commit",
            "sys_open",
            "sys_read",
            "sleep",
            "wakeup",
            "syscall",
          ].includes(data.symbol)
        )
          throw new Error("Unsupported breakpoint.");
        const error = new Uint8Array(1);
        const address = vm.get_address_of_symbol(data.symbol, error);
        if (error[0]) throw new Error("Symbol not found: " + data.symbol);
        breakpoint = { address, name: data.symbol };
        if (running) snapshot("Running to " + breakpoint.name);
        else resume();
        break;
      }
      case "processes": {
        if (data.auto && !kernelInspectable()) break;
        requireKernel();
        send("processes", { rows: processes(), auto: data.auto });
        break;
      }
      case "pagetable": {
        if (data.auto && !kernelInspectable()) break;
        requireKernel();
        if (!/^0x[0-9a-f]{1,16}$/i.test(data.address))
          throw new Error("Use a hexadecimal user address.");
        const va = BigInt(data.address);
        if (va >= 1n << 38n)
          throw new Error("User address must be below xv6 MAXVA (2^38).");
        const proc = processes().find((p) => p.pid === Number(data.pid));
        if (!proc && data.auto) break;
        if (!proc) throw new Error("Select a live process first.");
        let table = BigInt(proc.pagetable),
          steps = [],
          result = "Unmapped";
        for (let level = 2; level >= 0; level--) {
          const index = Number((va >> BigInt(12 + 9 * level)) & 511n),
            address = table + BigInt(index * 8),
            pte = word(address);
          const flags = "VRWXUGAD"
            .split("")
            .filter((_, i) => pte & (1n << BigInt(i)))
            .join("");
          steps.push({
            level,
            index,
            address: hex(address),
            pte: hex(pte),
            flags,
          });
          if (!(pte & 1n)) break;
          if (pte & 14n) {
            const bits = BigInt(12 + 9 * level),
              base = (pte >> 10n) << 12n;
            result =
              "Physical address " +
              hex(base + (va & ((1n << bits) - 1n))) +
              "; flags " +
              flags;
            break;
          }
          table = (pte >> 10n) << 12n;
        }
        send("pagetable", { steps, result, pid: proc.pid });
        break;
      }
      case "memory": {
        if (running) throw new Error("Pause before inspecting memory.");
        if (!/^0x[0-9a-f]{1,16}$/i.test(data.address))
          throw new Error(
            "Enter a hexadecimal address, for example 0x80000000.",
          );
        const error = new Uint8Array(1);
        const value = vm.load_doubleword(BigInt(data.address), error);
        send("memory", {
          address: data.address,
          value: error[0]
            ? error[0] === 1
              ? "Page fault: address is not mapped for this context."
              : "Address outside emulated memory."
            : hex(value),
        });
        break;
      }
    }
  } catch (error) {
    send("error", { message: error.message, fatal: data.type === "boot" });
  }
};

function requireKernel() {
  if (running)
    throw new Error(
      "Pause at a kernel breakpoint before inspecting processes or page tables.",
    );
  const pc = vm.read_pc();
  if (pc < 0x80000000n || pc >= 0x88000000n)
    throw new Error(
      "Stop inside a kernel function such as sys_getpid so kernel data is mapped.",
    );
}
function word(address) {
  const error = new Uint8Array(1),
    value = vm.load_doubleword(address, error);
  if (error[0])
    throw new Error(
      "Kernel memory unavailable at " +
        hex(address) +
        " (inspection error " +
        error[0] +
        ")",
    );
  return value;
}
function processes() {
  const base = BigInt(source.symbols.proc);
  const rows = [];
  for (let i = 0; i < layout.count; i++) {
    const p = base + BigInt(i * layout.size),
      state = Number(word(p + BigInt(layout.state)) & 0xffffffffn);
    if (!state) continue;
    const get = (key) => word(p + BigInt(layout[key]));
    let name = "";
    for (let j = 0; j < 16; j++) {
      const byte = Number(
        (word(p + BigInt(layout.name + (j & ~7))) >> BigInt((j % 8) * 8)) &
          255n,
      );
      if (!byte) break;
      name += String.fromCharCode(byte);
    }
    const parentAddress = get("parent"),
      trapframe = get("trapframe"),
      trap = trapframe
        ? {
            epc: hex(word(trapframe + 24n)),
            a0: hex(word(trapframe + 112n)),
            a7: hex(word(trapframe + 168n)),
          }
        : null;
    let descriptors = 0;
    for (let fd = 0; fd < layout.nofile; fd++)
      if (word(p + BigInt(layout.ofile + fd * 8))) descriptors++;
    rows.push({
      pid: Number(get("pid") & 0xffffffffn),
      parent: parentAddress
        ? Number(word(parentAddress + BigInt(layout.pid)) & 0xffffffffn)
        : null,
      name,
      state:
        ["unused", "sleeping", "runnable", "running", "zombie"][state] ||
        String(state),
      bytes: Number(get("sz")),
      pagetable: hex(get("pagetable")),
      channel: hex(get("chan")),
      descriptors,
      trap,
    });
  }
  return rows;
}

function kernelInspectable() {
  return !running && vm.read_pc() >= 0x80000000n && vm.read_pc() < 0x88000000n;
}
