import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import init, { WasmRiscv } from "../site/vendor/riscv_emu_rust_wasm.js";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url));
export const assets = {
  compiler: read("site/workbench/compiler/tcc.wasm"),
  kernel: read("site/images/kernel"),
  disk: read("site/images/fs.img"),
  user: read("site/workbench/assets/user-base.elf"),
  files: JSON.parse(read("site/source.json")).files,
};
export async function run(images, observePid = true) {
  await init(read("site/vendor/riscv_emu_rust_wasm_bg.wasm"));
  const vm = WasmRiscv.new();
  vm.setup_program(new Uint8Array(images.kernel));
  vm.setup_filesystem(new Uint8Array(images.disk));
  let output = "";
  const tick = () => {
    vm.run_cycles(100000);
    let c;
    while ((c = vm.get_output())) output += String.fromCharCode(c);
  };
  for (let i = 0; i < 1500 && !output.endsWith("$ "); i++) tick();
  assert.match(output, /init: starting sh/);
  const error = new Uint8Array(1),
    address = vm.get_address_of_symbol("sys_getpid", error);
  assert.equal(error[0], 0);
  for (const char of "workbench\n") vm.put_input(char.charCodeAt(0));
  if (!observePid) {
    const start = output.length;
    for (
      let i = 0;
      i < 1500 &&
      (!output.slice(start).includes("workbench\n") || !output.endsWith("$ "));
      i++
    )
      tick();
    assert.ok(output.endsWith("$ "), output);
    vm.free();
    return { output };
  }
  let hit = false;
  for (let i = 0; i < 1000 && !hit; i++) {
    hit = vm.run_until_breakpoints(new BigUint64Array([address]), 100000);
    let c;
    while ((c = vm.get_output())) output += String.fromCharCode(c);
  }
  assert.equal(hit, true);
  const sources = JSON.parse(read("site/source.json")),
    layout = JSON.parse(read("site/layout.json")),
    base = BigInt(sources.symbols.proc);
  function runningPID() {
    for (let i = 0; i < layout.count; i++) {
      const at = base + BigInt(i * layout.size),
        state =
          vm.load_doubleword(at + BigInt(layout.state), error) & 0xffffffffn;
      if (state === 3n) {
        return Number(
          vm.load_doubleword(at + BigInt(layout.pid), error) & 0xffffffffn,
        );
      }
    }
  }
  const stateSnapshot = [];
  for (let i = 0; i < layout.count; i++) {
    const at = base + BigInt(i * layout.size),
      state = Number(
        vm.load_doubleword(at + BigInt(layout.state), error) & 0xffffffffn,
      );
    if (!state) continue;
    const pid = Number(
        vm.load_doubleword(at + BigInt(layout.pid), error) & 0xffffffffn,
      ),
      parentAddress = vm.load_doubleword(at + BigInt(layout.parent), error);
    const parent = parentAddress
      ? Number(
          vm.load_doubleword(parentAddress + BigInt(layout.pid), error) &
            0xffffffffn,
        )
      : null;
    stateSnapshot.push({ pid, state, parent });
  }
  const actualPID = runningPID();
  assert.ok(actualPID > 0);
  const exitAddress = vm.get_address_of_symbol("sys_exit", error);
  assert.equal(error[0], 0);
  let exitHit = false;
  for (let i = 0; i < 1500 && !exitHit; i++) {
    exitHit = vm.run_until_breakpoints(
      new BigUint64Array([exitAddress]),
      100000,
    );
    let c;
    while ((c = vm.get_output())) output += String.fromCharCode(c);
  }
  assert.equal(exitHit, true, output);
  const exitPID = runningPID();
  assert.ok(exitPID > 0);
  for (let i = 0; i < 1500 && !output.endsWith("$ "); i++) tick();
  assert.ok(output.endsWith("$ "), output);
  vm.free();
  return { output, actualPID, exitPID, stateSnapshot };
}
