import init, { WasmRiscv } from './vendor/riscv_emu_rust_wasm.js';
let vm, timer, running = false, breakpoint = null;
const hex = value => '0x' + value.toString(16).padStart(16, '0');
const send = (type, data = {}) => postMessage({ type, ...data });
function output() {
  let text = '', byte;
  while ((byte = vm.get_output()) !== 0) text += String.fromCharCode(byte);
  if (text) send('output', { text });
}
function snapshot(reason) {
  output();
  vm.disassemble_next_instruction();
  let instruction = '', byte;
  while ((byte = vm.get_output()) !== 0) instruction += String.fromCharCode(byte);
  send('state', { running, reason, pc: hex(vm.read_pc()), registers: Array.from({ length: 32 }, (_, i) => hex(vm.read_register(i))), instruction });
}
function pause(reason = 'Paused') {
  running = false; clearTimeout(timer); snapshot(reason);
}
function tick() {
  if (!running) return;
  try {
    const hit = breakpoint ? vm.run_until_breakpoints(new BigUint64Array([breakpoint.address]), 100000) : (vm.run_cycles(100000), false);
    output();
    if (hit) { const name = breakpoint.name; breakpoint = null; pause('Stopped at ' + name); }
    else timer = setTimeout(tick, 0);
  } catch (error) { running = false; send('error', { message: error.message }); }
}
function resume() {
  if (running) return;
  running = true; snapshot(breakpoint ? 'Running to ' + breakpoint.name : 'Running'); tick();
}
async function asset(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
onmessage = async ({ data }) => {
  try {
    if (data.type === 'boot') {
      await init(await asset('./vendor/riscv_emu_rust_wasm_bg.wasm'));
      const [kernel, disk] = await Promise.all([asset('./images/kernel'), asset('./images/fs.img')]);
      vm = WasmRiscv.new(); vm.setup_program(kernel); vm.setup_filesystem(disk);
      send('ready'); resume(); return;
    }
    if (!vm) throw new Error('Boot xv6 first.');
    switch (data.type) {
      case 'pause': pause(); break;
      case 'continue': resume(); break;
      case 'step':
        if (running) throw new Error('Pause before stepping.');
        vm.run_cycles(1); snapshot('Stepped one instruction'); break;
      case 'input':
        for (const byte of new TextEncoder().encode(data.text)) vm.put_input(byte);
        break;
      case 'break': {
        if (!['sys_write', 'sys_fork', 'sys_exec', 'usertrap', 'sys_getpid'].includes(data.symbol)) throw new Error('Unsupported breakpoint.');
        const error = new Uint8Array(1);
        const address = vm.get_address_of_symbol(data.symbol, error);
        if (error[0]) throw new Error('Symbol not found: ' + data.symbol);
        breakpoint = { address, name: data.symbol };
        if (running) snapshot('Running to ' + breakpoint.name); else resume();
        break;
      }
      case 'memory': {
        if (running) throw new Error('Pause before inspecting memory.');
        if (!/^0x[0-9a-f]{1,16}$/i.test(data.address)) throw new Error('Enter a hexadecimal address, for example 0x80000000.');
        const error = new Uint8Array(1);
        const value = vm.load_doubleword(BigInt(data.address), error);
        send('memory', { address: data.address, value: error[0] ? (error[0] === 1 ? 'Page fault: address is not mapped for this context.' : 'Address outside emulated memory.') : hex(value) });
        break;
      }
    }
  } catch (error) { send('error', { message: error.message }); }
};
