import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { lessons } from '../site/lessons.js';

test('all lessons navigate, grade answers, save explicit completion, and operate machine controls', async () => {
  const dom = new JSDOM(readFileSync(new URL('../site/index.html', import.meta.url), 'utf8'), { url: 'https://example.test/xv6-lab/#boot' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, localStorage: dom.window.localStorage });
  let worker;
  globalThis.Worker = class {
    constructor() { worker = this; this.messages = []; }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    receive(data) { this.onmessage({ data }); }
  };
  await import('../site/app.js');
  const $ = id => document.getElementById(id);
  for (const lesson of lessons) {
    dom.window.location.hash = lesson.id;
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    assert.equal(document.querySelector('h2').textContent, lesson.title);
    document.querySelector(`[data-answer="${(lesson.answer + 1) % lesson.choices.length}"]`).click();
    assert.match($('feedback').textContent, /Try again/);
    document.querySelector(`[data-answer="${lesson.answer}"]`).click();
    assert.equal($('feedback').textContent, lesson.feedback);
    assert.equal($('complete').checked, false);
    $('complete').click();
    assert.equal(localStorage.getItem('xv6-lab:done:' + lesson.id), '1');
    $('load-command').click();
    assert.equal($('command').value, lesson.command);
  }
  assert.match($('progress').textContent, /6 \/ 6/);
  $('boot').click(); assert.deepEqual(worker.messages[0], { type: 'boot' });
  worker.receive({ type: 'ready' });
  worker.receive({ type: 'state', running: true, reason: 'Running', pc: '0x80000000', instruction: 'instruction', registers: Array(32).fill('0x0000000000000000') });
  assert.equal($('pause').disabled, false); assert.equal($('step').disabled, true);
  $('command').value = 'echo hello';
  $('command-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  assert.deepEqual(worker.messages.at(-1), { type: 'input', text: 'echo hello\n' });
  worker.receive({ type: 'output', text: '<script>guest output</script>\n$ ' });
  assert.equal($('terminal').querySelector('script'), null);
  assert.match($('terminal').textContent, /<script>/);
  worker.receive({ type: 'state', running: false, reason: 'Stopped at sys_write', pc: '0x80007524', instruction: 'addi sp,sp,-16', registers: Array(32).fill('0x0000000000000000') });
  assert.equal($('step').disabled, false); assert.equal(document.querySelectorAll('.register').length, 32);
  $('step').click(); assert.equal(worker.messages.at(-1).type, 'step');
  $('address').value = '0x80000000';
  $('memory-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  assert.equal(worker.messages.at(-1).type, 'memory');
  const original = worker; $('reset').click(); assert.equal(original.terminated, true); assert.notEqual(worker, original);
  assert.equal($('terminal').textContent.includes('guest output'), false);
  dom.window.close();
});
