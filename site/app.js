import { lessons } from "./lessons.js";
import { learning } from "./learning.js";
const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const names = [
  "zero",
  "ra",
  "sp",
  "gp",
  "tp",
  "t0",
  "t1",
  "t2",
  "s0",
  "s1",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
  "a7",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "s7",
  "s8",
  "s9",
  "s10",
  "s11",
  "t3",
  "t4",
  "t5",
  "t6",
];
let worker,
  ready = false,
  running = false,
  shellReady = false,
  selected,
  output = "",
  pending = null,
  storageAvailable = true;
const completed = new Set(),
  notes = new Map(),
  answers = new Map();
function read(key) {
  try {
    return localStorage.getItem("xv6-lab:" + key);
  } catch {
    storageAvailable = false;
    return null;
  }
}
function save(key, value) {
  try {
    localStorage.setItem("xv6-lab:" + key, value);
  } catch {
    storageAvailable = false;
  }
}
for (const lesson of lessons) {
  if (read("done:" + lesson.id) === "1") completed.add(lesson.id);
  notes.set(lesson.id, read("prediction:" + lesson.id) || "");
}
function navigation() {
  $("lessons").innerHTML = lessons
    .map(
      (lesson, i) =>
        `${{ 0: "Foundations", 6: "Process lifecycle", 9: "Files and names", 13: "Virtual memory", 16: "Traps and scheduling", 20: "Synchronization and storage", 24: "Capstone" }[i] ? `<span class="course-section">${{ 0: "Foundations", 6: "Process lifecycle", 9: "Files and names", 13: "Virtual memory", 16: "Traps and scheduling", 20: "Synchronization and storage", 24: "Capstone" }[i]}</span>` : ""}<a class="lesson-link ${lesson.id === selected.id ? "active" : ""}" ${lesson.id === selected.id ? 'aria-current="page"' : ""} href="#${lesson.id}"><span class="lesson-number">${completed.has(lesson.id) ? "✓" : String(i + 1).padStart(2, "0")}</span><span>${escape(lesson.title)}<small>${escape(lesson.tag)}</small></span></a>`,
    )
    .join("");
  $("progress").textContent =
    `${completed.size} / ${lessons.length} explored${storageAvailable ? "" : " · session only"}`;
  $("progress-fill").style.width =
    `${(completed.size / lessons.length) * 100}%`;
}
function view(machine) {
  document.body.classList.toggle("view-machine", machine);
  $("view-machine").setAttribute("aria-pressed", String(machine));
  $("view-lesson").setAttribute("aria-pressed", String(!machine));
}
$("view-machine").onclick = () => view(true);
$("view-lesson").onclick = () => view(false);
function render() {
  view(false);
  const previous = selected?.id;
  selected =
    lessons.find((lesson) => lesson.id === location.hash.slice(1)) ||
    lessons[0];
  if (pending && pending.id !== selected.id) pending = null;
  const l = selected,
    s = learning[l.id],
    index = lessons.indexOf(l);
  document.title = `${l.title} — xv6 Lab`;
  $("current-topic").textContent = l.title;
  navigation();
  $("lesson").innerHTML = `
    <div class="lesson-heading"><span class="tag">EXPERIMENT ${String(index + 1).padStart(2, "0")} / ${lessons.length}</span><span class="lesson-topic">${escape(l.tag)}</span></div>
    <h2>${escape(l.title)}</h2><p class="lead">${escape(l.intro)}</p>
    <div class="learning-goal"><span class="goal-icon" aria-hidden="true">◎</span><div><strong>By the end, you can…</strong><p>${escape(s.goal)}</p></div></div>
    <p class="prerequisite">${escape(s.needs)}</p>
    <section class="lesson-stage"><div class="stage-heading"><span class="stage-number">01</span><h3>Make a prediction</h3><span class="stage-label">THINK FIRST</span></div><p>${escape(l.predict)}</p><label class="sr-only" for="prediction">Your prediction</label><textarea id="prediction" rows="2" maxlength="2000" placeholder="I think… (a sentence is enough)">${escape(notes.get(l.id))}</textarea><p id="note-status" class="muted">${storageAvailable ? "Optional. Your notes stay in this browser." : "Optional. Notes are kept for this tab session only."}</p></section>
    <section class="lesson-stage experiment-stage"><div class="stage-heading"><span class="stage-number">02</span><h3>Run & notice</h3><span class="stage-label">TRY IT</span></div><ol class="experiment-steps">${s.steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol><div class="example"><div class="example-heading"><span>YOUR FIRST COMMAND</span>${l.breakpoint ? `<span>STOP AT ${escape(l.breakpoint)}</span>` : "<span>IN THE XV6 SHELL</span>"}</div><code>${escape(l.command)}</code><button id="run-experiment" class="primary">Run this experiment <span aria-hidden="true">↗</span></button><button id="load-command" class="text-button">Copy to command field</button></div><p id="experiment-status" class="experiment-status" role="status"></p><div class="notice"><strong>Look closely</strong><p>${escape(s.observe)}</p></div><details class="lesson-disclosure"><summary>Need a nudge?</summary><p>${escape(s.hint)}</p></details><details class="lesson-disclosure"><summary>Expected observation</summary><p>${escape(l.expected)}</p><p>Compare this with the real console. Seeing output is evidence to reason about, not an automatic pass.</p></details></section>
    <section class="lesson-stage"><div class="stage-heading"><span class="stage-number">03</span><h3>Connect the dots</h3><span class="stage-label">UNDERSTAND</span></div><div id="prediction-recall" class="prediction-recall" hidden><strong>You predicted</strong><blockquote id="prediction-text"></blockquote><p>What would you keep or revise after the experiment?</p></div><figure class="mechanism"><div class="flow">${s.flow.map(([label, caption], i) => `${i ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ""}<div class="flow-node"><strong>${escape(label)}</strong><span>${escape(caption)}</span></div>`).join("")}</div><figcaption>A map of the idea · not a live execution trace</figcaption></figure><p>${escape(l.concept)}</p><div class="takeaway"><span aria-hidden="true">↳</span><p>${escape(s.takeaway)}</p></div><h4>Change one thing</h4><p>${escape(l.experiment)}</p></section>
    <section class="lesson-stage quiz"><div class="stage-heading"><span class="stage-number">04</span><h3>Check your understanding</h3></div><p>${escape(l.question)}</p><div class="answers">${l.choices.map((choice, i) => `<button data-answer="${i}" aria-pressed="false"><span class="answer-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${escape(choice)}</span><span class="answer-mark" aria-hidden="true"></span></button>`).join("")}</div><p id="feedback" class="feedback" role="status"></p><details class="lesson-disclosure retrieval"><summary>One more thought, without looking back</summary><p>${escape(s.transfer)}</p><p class="muted">Explain it in your own words, then compare.</p><button id="reveal-transfer" class="text-button" aria-expanded="false" aria-controls="transfer-answer">Compare with an explanation</button><p id="transfer-answer" hidden>${escape(s.transferAnswer)}</p></details></section>
    <div class="completion-card"><label class="completion"><input id="complete" type="checkbox" ${completed.has(l.id) ? "checked" : ""}><span><strong>I can explain this idea</strong><small>I’ve tried the experiment and checked my understanding. Mark this lesson as explored.</small></span></label><p class="muted">This is your own learning record, not an automatic grade.</p></div>
    <div class="lesson-navigation">${index > 0 ? `<a href="#${lessons[index - 1].id}">← Previous</a>` : "<span>Keep the machine running as you explore.</span>"}${index < lessons.length - 1 ? `<a class="next-lesson" href="#${lessons[index + 1].id}">Next experiment <span aria-hidden="true">→</span></a>` : '<a class="next-lesson" href="#boot">Revisit the beginning →</a>'}</div>
    <details class="source-note" id="full-source"><summary>Read the matching source in this page</summary><pre id="full-source-code">Open to load the source file.</pre></details><details class="source-note"><summary>Go deeper: source & scope</summary><p>${escape(l.next)}</p><a href="https://github.com/snowch/xv6-lab/blob/main/guest/${l.source}" target="_blank" rel="noreferrer">Read ${escape(l.source)} ↗</a><p class="muted">This opens the matching source used to build this lab’s kernel and user programs.</p></details>`;
  function recallPrediction() {
    $("prediction-text").textContent = notes.get(l.id);
    $("prediction-recall").hidden = !notes.get(l.id)?.trim();
  }
  recallPrediction();
  $("reveal-transfer").onclick = () => {
    const hidden = !$("transfer-answer").hidden;
    $("transfer-answer").hidden = hidden;
    $("reveal-transfer").setAttribute("aria-expanded", String(!hidden));
    $("reveal-transfer").textContent = hidden
      ? "Compare with an explanation"
      : "Hide explanation";
  };
  $("prediction").oninput = (event) => {
    notes.set(l.id, event.target.value);
    save("prediction:" + l.id, event.target.value);
    recallPrediction();
    $("note-status").textContent = storageAvailable
      ? "Prediction saved in this browser."
      : "Kept for this tab session; browser storage is unavailable.";
    navigation();
  };
  $("full-source").ontoggle = async () => {
    if (!$("full-source")?.open) return;
    const target = $("full-source-code");
    try {
      const response = await fetch(new URL("./source.json", import.meta.url));
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      target.textContent = data.files[l.source]
        .split("\n")
        .map((line, i) => `${i + 1}: ${line}`)
        .join("\n");
    } catch (e) {
      target.textContent = "Could not load source: " + e.message;
    }
  };
  $("load-command").onclick = () => {
    $("command").value = l.command;
    $("experiment-status").textContent =
      "Command copied. Run the guided experiment, or send it yourself when the shell is ready.";
    if (shellReady && running) $("command").focus();
  };
  $("run-experiment").onclick = () => startExperiment(l);
  document
    .querySelectorAll("[data-answer]")
    .forEach(
      (button) =>
        (button.onclick = () => grade(l, Number(button.dataset.answer))),
    );
  if (answers.has(l.id)) grade(l, answers.get(l.id));
  $("complete").onchange = (event) => {
    if (event.target.checked) completed.add(l.id);
    else completed.delete(l.id);
    save("done:" + l.id, event.target.checked ? "1" : "0");
    navigation();
  };
  if (previous && previous !== selected.id) {
    $("lesson").focus({ preventScroll: true });
    $("lesson").scrollIntoView?.({behavior:"auto",block:"start"});
  }
  controls();
}
function grade(lesson, choice) {
  answers.set(lesson.id, choice);
  document.querySelectorAll("[data-answer]").forEach((button) => {
    const chosen = Number(button.dataset.answer) === choice;
    button.classList.toggle("correct", chosen && choice === lesson.answer);
    button.classList.toggle("wrong", chosen && choice !== lesson.answer);
    button.setAttribute("aria-pressed", String(chosen));
    button.querySelector(".answer-mark").textContent = chosen
      ? choice === lesson.answer
        ? "✓"
        : "↺"
      : "";
  });
  const correct = choice === lesson.answer;
  $("feedback").classList.toggle("success", correct);
  $("feedback").textContent = correct
    ? "That’s it. " + lesson.feedback
    : "Try again. " + learning[lesson.id].wrong[choice];
}
function controls() {
  $("boot").disabled = !!worker;
  $("reset").disabled = !worker;
  $("pause").disabled = !ready || !running;
  $("continue").disabled = !ready || running;
  $("step").disabled = !ready || running;
  $("inspect").disabled = !ready || running;
  $("arm").disabled = !ready;
  $("refresh-processes").disabled = !ready || running;
  $("walk-page").disabled =
    !ready || running || !$("process-pid").options.length;
  for (const id of ["command", "send"])
    $(id).disabled = !ready || !running || !shellReady;
  $("machine-dot").classList.toggle("active", running);
  if ($("run-experiment"))
    $("run-experiment").disabled =
      !!pending || (!!worker && (!ready || !running || !shellReady));
  $("command-help").textContent = !worker
    ? "Run an experiment to start the shell."
    : !ready
      ? "Loading the machine…"
      : !running
        ? "Machine paused. Continue before sending a command."
        : shellReady
          ? "Shell ready. Enter a command and press Run."
          : "Waiting for the shell prompt. Use the console directly for interactive programs.";
}
function guide(message) {
  $("machine-hint").textContent = message;
}
function error(message) {
  $("error").textContent = message;
  $("error").hidden = false;
  pending = null;
  controls();
}
function send(type, data = {}) {
  $("error").hidden = true;
  worker?.postMessage({ type, ...data });
}
function launchPending() {
  if (!pending || !ready || !running || !shellReady) return;
  const lesson = pending;
  pending = null;
  if (lesson.breakpoint) {
    $("breakpoint").value = lesson.breakpoint;
    send("break", { symbol: lesson.breakpoint });
  }
  submitCommand(lesson.command);
  if ($("experiment-status"))
    $("experiment-status").textContent = lesson.breakpoint
      ? `Command sent. xv6 will pause at ${lesson.breakpoint}. Follow the live machine on the right (below on small screens).`
      : "Command sent to the real shell. Compare its output with your prediction.";
}
function startExperiment(lesson) {
  view(true);
  if (worker && (!ready || !running || !shellReady)) return;
  pending = lesson;
  if (!worker) boot(true);
  else launchPending();
  if (pending)
    $("experiment-status").textContent =
      "Starting xv6 and waiting for the shell. Your command will run automatically when it is ready.";
  controls();
  $("machine").scrollIntoView?.({
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      ? "auto"
      : "smooth",
    block: "nearest",
  });
}
function submitCommand(text) {
  shellReady = false;
  $("status").textContent = "Command running";
  send("input", { text: text + "\n" });
  guide(
    "Your command is running. Watch the console; a new $ prompt means the shell is ready again.",
  );
  controls();
}
function appendOutput(text) {
  for (const char of text) {
    if (char === "\b") output = output.slice(0, -1);
    else if (char !== "\r") output += char;
  }
  output = output.slice(-100000);
  $("terminal").textContent = output;
  $("terminal").scrollTop = $("terminal").scrollHeight;
  shellReady = output.endsWith("$ ");
}
function boot(keepPending = false) {
  if (!keepPending) pending = null;
  worker?.terminate();
  ready = false;
  running = false;
  shellReady = false;
  output = "";
  $("terminal").textContent =
    "Loading the RISC-V machine and xv6 disk…\n\nThe kernel will initialize, then start its shell.\n";
  $("status").textContent = "Booting xv6";
  $("pc").textContent = "—";
  $("registers").replaceChildren();
  $("instruction").textContent = "Waiting for CPU snapshot.";
  $("memory-result").textContent = "";
  $("process-result").replaceChildren();
  $("page-result").replaceChildren();
  $("process-pid").replaceChildren();
  $("source-view").textContent = "Waiting for a kernel source snapshot.";
  guide(
    "Booting a real kernel. This can take a little while; you don’t need to type anything yet.",
  );
  worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  worker.onmessage = ({ data }) => {
    switch (data.type) {
      case "ready":
        ready = true;
        controls();
        break;
      case "output":
        appendOutput(data.text);
        if (shellReady && running) {
          $("status").textContent = "Shell ready";
          guide(
            "The $ prompt is the shell waiting for you. Try another command, or move to the next experiment.",
          );
        }
        controls();
        launchPending();
        break;
      case "state":
        $("process-result").replaceChildren();
        $("process-pid").replaceChildren();
        $("page-result").replaceChildren();
        running = data.running;
        $("status").textContent = data.reason;
        $("pc").textContent = data.pc;
        $("instruction").textContent = data.instruction;
        $("source-location").textContent = data.source
          ? `${data.source.path}:${data.source.line} (instruction-to-source mapping; optimized code may reorder lines)`
          : "No source mapping at this address.";
        $("source-view").textContent = data.source?.text || "—";
        $("registers").innerHTML = data.registers
          .map(
            (value, i) =>
              `<div class="register"><span>x${i} <strong>${names[i]}</strong></span><code>${escape(value.slice(2))}</code></div>`,
          )
          .join("");
        if (!running) {
          $("cpu-panel").open = true;
          guide(
            data.reason.startsWith("Stopped at")
              ? `${data.reason}. The machine is paused before this function’s body runs. Inspect the PC, take a Step, then Continue.`
              : "Execution is paused. Inspect the CPU, step one instruction, or Continue to return to the experiment.",
          );
        } else if (shellReady) {
          $("status").textContent = "Shell ready";
          guide("The shell is ready for your next command.");
        }
        controls();
        launchPending();
        break;
      case "processes":
        $("process-result").innerHTML =
          `<table><caption>Paused guest processes</caption><thead><tr><th>PID</th><th>Name</th><th>State</th><th>Bytes</th><th>FDs</th><th>Saved user registers</th></tr></thead><tbody>${data.rows.map((p) => `<tr><td>${p.pid}</td><td>${escape(p.name)}</td><td>${escape(p.state)}</td><td>${p.bytes}</td><td>${p.descriptors}</td><td>${p.trap ? `epc ${p.trap.epc}<br>a0 ${p.trap.a0}<br>a7 ${p.trap.a7}` : "—"}</td></tr>`).join("")}</tbody></table>`;
        $("process-pid").innerHTML = data.rows
          .map(
            (p) =>
              `<option value="${p.pid}" ${p.name === "lab" ? "selected" : ""}>${p.pid} ${escape(p.name)}</option>`,
          )
          .join("");
        controls();
        break;
      case "pagetable":
        $("page-result").innerHTML =
          `<p>${escape(data.result)}</p><table><caption>PID ${data.pid} · actual PTE reads</caption><thead><tr><th>Level</th><th>Index</th><th>PTE</th><th>Flags</th></tr></thead><tbody>${data.steps.map((s) => `<tr><td>${s.level}</td><td>${s.index}</td><td>${s.pte}</td><td>${s.flags || "—"}</td></tr>`).join("")}</tbody></table>`;
        break;
      case "memory":
        $("memory-result").textContent = data.address + " → " + data.value;
        break;
      case "error":
        if (data.fatal) stopWorker();
        error(data.message);
        break;
    }
  };
  worker.onerror = (event) => {
    stopWorker();
    error(
      event.message ||
        "The machine stopped unexpectedly. Boot xv6 to try again.",
    );
  };
  controls();
  send("boot");
}
function stopWorker() {
  worker?.terminate();
  worker = null;
  ready = false;
  running = false;
  shellReady = false;
  pending = null;
  $("status").textContent = "Machine stopped";
  guide(
    "The machine stopped. Boot xv6 for a fresh session. Your lesson notes are safe.",
  );
  controls();
}
$("boot").onclick = () => boot();
$("reset").onclick = () => boot();
$("pause").onclick = () => send("pause");
$("continue").onclick = () => send("continue");
$("step").onclick = () => send("step");
$("arm").onclick = () => send("break", { symbol: $("breakpoint").value });
$("command-form").onsubmit = (event) => {
  event.preventDefault();
  if (!ready || !running || !shellReady) return;
  const text = $("command").value;
  if (text.length > 120 || /[^\x20-\x7e]/.test(text)) {
    error(
      "Use up to 120 printable ASCII characters. This xv6 console does not support Unicode input.",
    );
    return;
  }
  submitCommand(text);
  $("command").value = "";
};
$("memory-form").onsubmit = (event) => {
  event.preventDefault();
  if (ready && !running) send("memory", { address: $("address").value.trim() });
};
$("terminal").onkeydown = (event) => {
  if (
    !ready ||
    !running ||
    event.altKey ||
    event.metaKey ||
    (event.ctrlKey && event.key.toLowerCase() !== "d")
  )
    return;
  let text;
  if (event.ctrlKey && event.key.toLowerCase() === "d") text = "\x04";
  else if (event.key === "Enter") text = "\n";
  else if (event.key === "Backspace") text = "\x7f";
  else if (event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key))
    text = event.key;
  if (text) {
    event.preventDefault();
    shellReady = false;
    send("input", { text });
    controls();
  }
};
window.addEventListener("hashchange", () => {
  if (lessons.some((lesson) => "#" + lesson.id === location.hash)) render();
});
for (const [id, target] of [
  ["jump-machine", "machine"],
  ["current-topic", "lesson"],
  ["back-lesson", "lesson"],
]) {
  $(id).onclick = (event) => {
    event.preventDefault();
    view(target === "machine");
    $(target).focus({ preventScroll: true });
    $(target).scrollIntoView?.({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };
}
window.addEventListener("storage", (event) => {
  if (event.key === null) {
    completed.clear();
    navigation();
    if ($("complete")) $("complete").checked = false;
    return;
  }
  const lesson = lessons.find((l) => event.key === "xv6-lab:done:" + l.id);
  if (lesson) {
    if (event.newValue === "1") completed.add(lesson.id);
    else completed.delete(lesson.id);
    navigation();
    if (selected.id === lesson.id)
      $("complete").checked = completed.has(lesson.id);
  }
});
if (window.matchMedia?.("(max-width: 1280px)")?.matches)
  $("course-menu").open = false;
render();

$("refresh-processes").onclick = () => {
  $("process-result").replaceChildren();
  $("process-pid").replaceChildren();
  $("page-result").replaceChildren();
  controls();
  send("processes");
};
$("page-form").onsubmit = (e) => {
  e.preventDefault();
  send("pagetable", {
    pid: $("process-pid").value,
    address: $("page-address").value.trim(),
  });
};

$("breakpoint").innerHTML = [
  ...new Set([
    ...lessons.map((l) => l.breakpoint).filter(Boolean),
    "usertrap",
    "sleep",
    "wakeup",
    "sys_read",
    "sys_open",
    "syscall",
  ]),
]
  .map((s) => `<option>${s}</option>`)
  .join("");
