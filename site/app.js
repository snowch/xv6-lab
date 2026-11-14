import { lessons } from './lessons.js';
const $ = id => document.getElementById(id);
const names = ['zero','ra','sp','gp','tp','t0','t1','t2','s0','s1','a0','a1','a2','a3','a4','a5','a6','a7','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','t3','t4','t5','t6'];
let worker, ready = false, running = false, selected, output = '', storageAvailable = true;
const completed = new Set();
for (const lesson of lessons) {
  try { if (localStorage.getItem('xv6-lab:done:' + lesson.id) === '1') completed.add(lesson.id); }
  catch { storageAvailable = false; }
}
function navigation() {
  $('lessons').innerHTML = lessons.map((lesson, i) => `<a class="lesson-link ${lesson.id === selected.id ? 'active' : ''}" ${lesson.id === selected.id ? 'aria-current="page"' : ''} href="#${lesson.id}"><span class="lesson-number">${completed.has(lesson.id) ? '✓' : String(i + 1).padStart(2, '0')}</span><span>${lesson.title}</span></a>`).join('');
  $('progress').textContent = `${completed.size} / ${lessons.length} lessons marked done${storageAvailable ? '' : ' · progress is session-only'}`;
}
function render() {
  selected = lessons.find(lesson => lesson.id === location.hash.slice(1)) || lessons[0];
  const l = selected, index = lessons.indexOf(l);
  document.title = `${l.title} — xv6 Lab`;
  navigation();
  $('lesson').innerHTML = `<span class="tag">Experiment ${String(index + 1).padStart(2, '0')} / ${l.tag}</span><h2>${l.title}</h2><p class="lead">${l.intro}</p><div class="predict"><strong>Before you run</strong><p>${l.predict}</p></div><h3>The mechanism</h3><p>${l.concept}</p><h3>Try it, one step at a time</h3><ol>${l.steps.map(s => `<li>${s}</li>`).join('')}</ol><div class="example"><code>${l.command.replaceAll('>', '&gt;').replaceAll('<', '&lt;')}</code><button id="load-command">Use this command →</button>${l.breakpoint ? '<button id="choose-breakpoint">Select lesson breakpoint</button>' : ''}<details><summary>What to look for</summary><p>${l.expected}</p></details></div><h3>Change one thing</h3><p>${l.experiment}</p><div class="quiz"><h3>Check your understanding</h3><p>${l.question}</p><div class="answers">${l.choices.map((choice, i) => `<button data-answer="${i}">${choice}</button>`).join('')}</div><p id="feedback" class="feedback" role="status"></p></div><label class="completion"><input id="complete" type="checkbox" ${completed.has(l.id) ? 'checked' : ''}> I’ve explored this lesson. Mark it as done.</label><div class="lesson-footer"><p>${l.next}</p><a href="https://github.com/mit-pdos/xv6-riscv/blob/riscv/${l.source}" target="_blank" rel="noreferrer">Read ${l.source} ↗</a><p class="muted">Source link opens current upstream xv6. This lab runs an older bundled image; exact lines may differ.</p><div class="lesson-navigation">${index > 0 ? `<a href="#${lessons[index - 1].id}">← Previous</a>` : '<span></span>'}${index < lessons.length - 1 ? `<a href="#${lessons[index + 1].id}">Next experiment →</a>` : '<a href="#boot">Back to the beginning ↑</a>'}</div></div>`;
  $('load-command').onclick = () => { $('command').value = l.command; if (ready) $('command').focus(); };
  if (l.breakpoint) $('choose-breakpoint').onclick = () => { $('breakpoint').value = l.breakpoint; $('arm').focus(); };
  document.querySelectorAll('[data-answer]').forEach(button => button.onclick = () => {
    const correct = Number(button.dataset.answer) === l.answer;
    document.querySelectorAll('[data-answer]').forEach(b => b.classList.remove('correct', 'wrong'));
    button.classList.add(correct ? 'correct' : 'wrong');
    $('feedback').textContent = correct ? l.feedback : 'Try again. Return to the mechanism above and compare the roles of the shell, kernel and emulator.';
  });
  $('complete').onchange = event => {
    if (event.target.checked) completed.add(l.id); else completed.delete(l.id);
    try { localStorage.setItem('xv6-lab:done:' + l.id, event.target.checked ? '1' : '0'); }
    catch { storageAvailable = false; }
    navigation();
  };
}
function controls() {
  $('boot').disabled = !!worker;
  $('reset').disabled = !worker;
  $('pause').disabled = !ready || !running;
  $('continue').disabled = !ready || running;
  $('step').disabled = !ready || running;
  $('inspect').disabled = !ready || running;
  for (const id of ['command', 'send', 'arm']) $(id).disabled = !ready;
  $('machine-dot').classList.toggle('active', running);
}
function error(message) { $('error').textContent = message; $('error').hidden = false; }
function send(type, data = {}) { $('error').hidden = true; worker?.postMessage({ type, ...data }); }
function boot() {
  worker?.terminate(); ready = false; running = false; output = '';
  $('terminal').textContent = 'Loading RISC-V emulator and xv6 disk…\nBoot can take a little while. Wait for “init: starting sh” and the $ prompt.\n';
  $('status').textContent = 'Loading'; $('pc').textContent = '—'; $('registers').replaceChildren(); $('instruction').textContent = 'Waiting for CPU snapshot.'; $('memory-result').textContent = '';
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    switch (data.type) {
      case 'ready': ready = true; controls(); break;
      case 'output':
        output = (output + data.text).slice(-100000); $('terminal').textContent = output; $('terminal').scrollTop = $('terminal').scrollHeight; break;
      case 'state':
        running = data.running; $('status').textContent = data.reason; $('pc').textContent = data.pc; $('instruction').textContent = data.instruction;
        $('registers').innerHTML = data.registers.map((value, i) => `<div class="register"><span>x${i} ${names[i]}</span><code>${value.slice(2)}</code></div>`).join('');
        controls(); break;
      case 'memory': $('memory-result').textContent = data.address + ' → ' + data.value; break;
      case 'error': error(data.message); break;
    }
  };
  worker.onerror = event => {
    error(event.message || 'The emulator worker stopped unexpectedly. Reset to try again.');
    worker.terminate(); worker = null; ready = false; running = false; $('status').textContent = 'Stopped'; controls();
  };
  controls(); send('boot');
}
$('boot').onclick = boot;
$('reset').onclick = boot;
$('pause').onclick = () => send('pause');
$('continue').onclick = () => send('continue');
$('step').onclick = () => send('step');
$('arm').onclick = () => send('break', { symbol: $('breakpoint').value });
$('command-form').onsubmit = event => {
  event.preventDefault(); if (!ready) return;
  const text = $('command').value;
  if (text.length > 120 || /[^\x20-\x7e]/.test(text)) { error('Use up to 120 printable ASCII characters. This guest console does not support Unicode input.'); return; }
  send('input', { text: text + '\n' }); $('command').value = '';
};
$('memory-form').onsubmit = event => { event.preventDefault(); if (ready && !running) send('memory', { address: $('address').value.trim() }); };
// Interactive programs such as cat can read input and Ctrl-D directly from the console.
$('terminal').onkeydown = event => {
  if (!ready || event.altKey || event.metaKey || (event.ctrlKey && event.key.toLowerCase() !== 'd')) return;
  let text;
  if (event.ctrlKey && event.key.toLowerCase() === 'd') text = '\x04';
  else if (event.key === 'Enter') text = '\n';
  else if (event.key === 'Backspace') text = '\x7f';
  else if (event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key)) text = event.key;
  if (text) { event.preventDefault(); send('input', { text }); }
};
window.addEventListener('hashchange', render);
window.addEventListener('storage', event => {
  const lesson = lessons.find(l => event.key === 'xv6-lab:done:' + l.id);
  if (lesson) { if (event.newValue === '1') completed.add(lesson.id); else completed.delete(lesson.id); render(); }
});
render(); controls();
