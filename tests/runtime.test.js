import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('vendored runtime assets retain the pinned upstream bytes', () => {
  const manifest = JSON.parse(readFileSync(new URL('../docs/assets.json', import.meta.url)));
  for (const asset of manifest.assets) {
    const bytes = readFileSync(new URL('../' + asset.path, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  }
});

test('real Wasm guest: shell, fork/write breakpoints, stepping, pipe, files, and error recovery', { timeout: 180000 }, async t => {
  const worker = new Worker(new URL('./node-worker.js', import.meta.url));
  t.after(() => worker.terminate());
  let output = '', messages = [], failure;
  worker.on('message', m => { messages.push(m); if (m.type === 'output') output += m.text; });
  worker.on('error', e => { failure = e; });
  function send(type, data = {}) { worker.postMessage({ type, ...data }); }
  async function until(predicate, description, timeout = 60000) {
    const start = Date.now();
    while (!predicate()) {
      if (failure) throw failure;
      const error = messages.find(m => m.type === 'error');
      if (error) throw new Error(error.message);
      if (Date.now() - start > timeout) throw new Error(`Timed out: ${description}\n${output.slice(-2000)}`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  async function command(text, expected) {
    const start = output.length;
    send('input', { text: text + '\n' });
    await until(() => output.slice(start).includes(expected) && output.slice(start).endsWith('$ '), text);
    return output.slice(start);
  }
  send('boot');
  await until(() => output.includes('init: starting sh') && output.endsWith('$ '), 'boot');
  assert.match(await command('echo hello', '\nhello\n'), /\nhello\n/);
  assert.match(await command('echo hello | wc', '1 1 6'), /1\s+1\s+6/);
  await command('echo hello > note', '$ ');
  assert.match(await command('cat note', '\nhello\n'), /\nhello\n/);
  await command('rm note', '$ ');
  assert.match(await command('cat note', 'cannot open'), /cannot open/);
  for (const symbol of ['sys_fork', 'sys_write']) {
    messages = []; send('pause');
    await until(() => messages.some(m => m.type === 'state' && m.reason === 'Paused'), 'pause');
    messages = []; send('break', { symbol }); send('input', { text: 'echo breakpoint\n' });
    await until(() => messages.some(m => m.reason === 'Stopped at ' + symbol), symbol);
    const state = messages.find(m => m.reason === 'Stopped at ' + symbol);
    assert.equal(state.running, false); assert.equal(state.registers.length, 32);
    assert.equal(state.registers[0], '0x0000000000000000'); assert.match(state.pc, /^0x000000008/);
    assert.ok(state.instruction.length > 0);
    messages = []; send('step');
    await until(() => messages.some(m => m.reason === 'Stepped one instruction'), 'single step');
    assert.notEqual(messages.find(m => m.type === 'state').pc, state.pc);
    send('memory', { address: state.pc });
    await until(() => messages.some(m => m.type === 'memory'), 'memory read');
    assert.match(messages.find(m => m.type === 'memory').value, /^0x[0-9a-f]{16}$/);
    const start = output.length; send('continue');
    await until(() => output.slice(start).includes('breakpoint') && output.endsWith('$ '), 'continue');
  }
  // Invalid input reports an error without killing the worker, then inspection recovers.
  send('pause'); messages = [];
  send('memory', { address: 'oops' });
  const start = Date.now();
  while (!messages.some(m => m.type === 'error')) {
    assert.ok(Date.now() - start < 5000); await new Promise(r => setTimeout(r, 10));
  }
  assert.match(messages.find(m => m.type === 'error').message, /hexadecimal/);
  messages = []; send('memory', { address: '0x80000000' });
  await until(() => messages.some(m => m.type === 'memory'), 'recovery after invalid address');
});
