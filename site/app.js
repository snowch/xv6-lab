import { stages, processLessons, observations, guidedChanges, commandChanges } from "./guide-content.js?v=learner-flow1";
import { lessons } from "./lessons.js?v=learner-flow1";
import { learning } from "./learning.js?v=learner-flow1";
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
const chapters = {
  0: "Foundations",
  6: "Process lifecycle",
  9: "Files and names",
  13: "Virtual memory",
  16: "Traps and scheduling",
  20: "Synchronization and storage",
  24: "Capstone",
};
let query = (new URLSearchParams(location.search).get("q") || "").slice(0, 80);
function setParam(key, value) {
  const url = new URL(location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(null, "", url);
}
function navigation() {
  const needle = query.trim().toLowerCase();
  let count = 0;
  $("lessons").innerHTML =
    lessons
      .map((lesson, i) => {
        if (
          needle &&
          !`${lesson.title} ${lesson.tag}`.toLowerCase().includes(needle)
        )
          return "";
        count++;
        return `${!needle && chapters[i] ? `<span class="course-section">${chapters[i]}</span>` : ""}<a class="lesson-link ${lesson.id === selected.id ? "active" : ""}" ${lesson.id === selected.id ? 'aria-current="page"' : ""} href="#${lesson.id}"><span class="lesson-number">${completed.has(lesson.id) ? "✓" : String(i + 1).padStart(2, "0")}</span><span>${escape(lesson.title)}<small>${escape(lesson.tag)}</small></span></a>`;
      })
      .join("") ||
    '<p class="empty-search">No lessons match. Try “memory”, “files” or “pipes”, or clear the search.</p>';
  $("search-results").textContent = needle
    ? `${count} matching ${count === 1 ? "lesson" : "lessons"}`
    : `${lessons.length} lessons in 7 chapters`;
  $("progress").textContent =
    `${completed.size} / ${lessons.length} explored${storageAvailable ? "" : " · session only"}`;
  $("progress-fill").style.width =
    `${(completed.size / lessons.length) * 100}%`;
}
$("lesson-search").value = query;
$("lesson-search").oninput = (e) => {
  query = e.target.value.slice(0, 80);
  setParam("q", query);
  navigation();
};
const stageByLesson = new Map(),
  launched = new Set(),
  finished = new Set(),
  evidence = new Map(),
  pageWalks = new Map();
let stage = 0,
  activeExperiment = null,
  outputStart = 0,
  lastSnapshot = null,
  processSnapshot = null;
function hasGuidedInspection() {
  return stage === 1 || (stage === 3 && Object.hasOwn(guidedChanges, selected.id));
}
window.addEventListener("popstate", () => {
  query = new URLSearchParams(location.search).get("q") || "";
  $("lesson-search").value = query;
  navigation();
  const value = new URLSearchParams(location.search).get("step");
  if (value && stages.some((s) => s[0] === value))
    setStage(
      stages.findIndex((s) => s[0] === value),
      false,
    );
});
function setStage(value, persist = true, focus = false) {
  stage = Math.max(0, Math.min(stages.length - 1, value));
  stageByLesson.set(selected.id, stage);
  if (persist) setParam("step", stages[stage][0]);
  $("guide-task").scrollTop = 0;
  document.querySelectorAll("[data-flow-stage]").forEach((el) => {
    el.hidden = Number(el.dataset.flowStage) !== stage;
  });
  document.querySelectorAll("[data-flow-link]").forEach((el) => {
    el.setAttribute(
      "aria-current",
      Number(el.dataset.flowLink) === stage ? "step" : "false",
    );
  });
  controls();
  if (focus) $("guide-task").focus({ preventScroll: true });
}
function updateGuide() {
  if (!$("flow-next")) return;
  $("flow-back").disabled = stage === 0;
  $("flow-position").textContent =
    `Step ${stage + 1} of ${stages.length}: ${stages[stage][1]}`;
  const next = $("flow-next");
  next.disabled = false;
  if (stage === 0) next.textContent = "Run experiment";
  else if (stage === 1) {
    next.textContent =
      ready && !running
        ? "Continue execution"
        : !launched.has(selected.id)
          ? "Run experiment"
          : finished.has(selected.id)
            ? "Explain this result"
            : "Waiting for the experiment…";
    next.disabled = !!worker && (!ready || (running && !shellReady));
  } else if (stage === 3 && ready && !running && guidedChanges[selected.id])
    next.textContent = "Continue execution";
  else
    next.textContent =
      stage === 2
        ? "Try a change"
        : stage === 3
          ? "Check understanding"
          : lessons.indexOf(selected) < lessons.length - 1
            ? "Next lesson"
            : "Review the course";
  const inspect = $(stage === 3 ? "guide-variant-inspection" : "guide-inspection");
  if (inspect) {
    const refocus = document.activeElement?.id === "guided-step";
    inspect.replaceChildren();
    if (hasGuidedInspection() && ready && !running && lastSnapshot) {
      const title = document.createElement("h4");
      title.textContent = lastSnapshot.reason;
      inspect.append(title);
      const cpu = document.createElement("pre");
      cpu.textContent = processLessons.has(selected.id)
        ? `PC ${lastSnapshot.pc}`
        : `PC ${lastSnapshot.pc}\n${lastSnapshot.instruction}`;
      inspect.append(cpu);
      if (processLessons.has(selected.id)) {
        if (!processSnapshot) {
          const loading = document.createElement("p");
          loading.textContent = "Reading the paused process snapshot…";
          inspect.append(loading);
        } else if (selected.id === "pagetables") {
          const walks = document.createElement("div");
          walks.className = "guide-walks";
          for (const address of stage === 3 ? ["0x0", "0x40000000"] : ["0x0"]) {
            const walk = document.createElement("pre");
            const snapshot = pageWalks.get(address);
            walk.textContent = snapshot
              ? `lab · ${address}\n${snapshot.steps.map(s => `L${s.level} [${s.index}] ${s.pte} ${s.flags}`).join("\n")}\n${snapshot.result}`
              : `Reading lab’s page table at ${address}…`;
            walks.append(walk);
          }
          inspect.append(walks);
        } else {
          const focus =
            processSnapshot.find(
              (p) => p.name === "lab" && p.state === "running",
            ) ||
            processSnapshot.find((p) => p.name === "lab") ||
            processSnapshot.find((p) => p.state === "running");
          const table = document.createElement("div");
          table.className = "guide-processes";
          table.innerHTML = `<table><caption>Paused processes</caption><thead><tr><th scope="col">PID</th><th scope="col">Name</th><th scope="col">State</th><th scope="col">Open descriptors</th></tr></thead><tbody>${processSnapshot.map((p) => `<tr><td>${p.pid}</td><td>${escape(p.name)}</td><td>${escape(p.state)}</td><td>${p.descriptors}</td></tr>`).join("")}</tbody></table>`;
          if (["identity", "traps", "heap"].includes(selected.id) && focus) {
            const detail = document.createElement("pre");
            detail.textContent =
              selected.id === "heap"
                ? `${focus.name} PID ${focus.pid}\nVirtual size: ${focus.bytes} bytes`
                : selected.id === "identity"
                  ? `${focus.name} PID ${focus.pid} (${focus.state})\nSaved user a7: ${focus.trap?.a7 || "—"}`
                  : `Saved user epc: ${focus.trap?.epc || "—"}\na0: ${focus.trap?.a0 || "—"}\na7: ${focus.trap?.a7 || "—"}`;
            inspect.append(detail);
            const others = document.createElement("details");
            others.innerHTML = "<summary>All paused processes</summary>";
            others.append(table);
            inspect.append(others);
          } else inspect.append(table);
        }
      }
      if (selected.id === "step") {
        const button = document.createElement("button");
        button.textContent = "Step one instruction";
        button.id = "guided-step";
        button.onclick = () => send("step");
        inspect.append(button);
        if (refocus) button.focus({ preventScroll: true });
      }
      if (!processLessons.has(selected.id) && lastSnapshot.source) {
        const details = document.createElement("details");
        details.innerHTML = "<summary>Source at this stop</summary>";
        const code = document.createElement("pre");
        code.textContent =
          lastSnapshot.source.path +
          ":" +
          lastSnapshot.source.line +
          "\n" +
          lastSnapshot.source.text;
        details.append(code);
        inspect.append(details);
      }
    }
  }
  const saved = $("recent-output");
  if (saved) {
    saved.textContent =
      evidence.get(selected.id) ||
      "Run the experiment to collect guest output here.";
  }
  const note = $("flow-cue");
  if (note)
    note.textContent =
      stage !== 1
        ? ""
        : ready && !running
          ? "After inspecting the snapshot, choose Continue execution."
          : pending
            ? "The kernel is booting. The command will run when the shell is ready."
            : finished.has(selected.id)
              ? "Compare the console with your prediction."
              : "";
}
$("flow-back").onclick = () => setStage(stage - 1, true, true);
$("flow-next").onclick = () => {
  if (stage === 0) {
    setStage(1, true, true);
    if (!finished.has(selected.id)) startExperiment(selected);
  } else if (stage === 1) {
    if (ready && !running) {
      send("continue");
    } else if (!launched.has(selected.id) || !worker) {
      startExperiment(selected);
    } else setStage(2, true, true);
  } else if (stage === 3 && ready && !running && guidedChanges[selected.id]) {
    send("continue");
  } else if (stage < 4) setStage(stage + 1, true, true);
  else {
    const index = lessons.indexOf(selected);
    location.hash = lessons[index + 1]?.id || "boot";
  }
};
function render() {
  const previous = selected?.id;
  selected =
    lessons.find((lesson) => lesson.id === location.hash.slice(1)) ||
    lessons[0];
  if (pending && pending.id !== selected.id) {
    launched.delete(pending.id);
    finished.delete(pending.id);
    if (activeExperiment === pending.id) activeExperiment = null;
    pending = null;
  }
  const l = selected,
    s = learning[l.id],
    index = lessons.indexOf(l);
  setParam("view", null);
  document.title = `${l.title} — xv6 Lab`;
  $("current-topic").textContent = l.title;
  navigation();
  const followUp = {
    wait: "waiting-for-a-child",
    traps: "a-trapframe-saves-user-registers",
    locks: "a-sleeping-lock-does-not-spin-through-io",
    blocks: "direct-and-indirect-blocks-map-file-offsets",
    transactions: "the-header-is-the-commit-point",
  }[l.id];
  const changeAction = guidedChanges[l.id]
    ? `<button id="run-variant">${l.id === "pagetables" ? "Compare two addresses" : "Run changed command"}</button><div id="guide-variant-inspection"></div>`
    : commandChanges[l.id]
      ? '<button id="load-command">Load command</button><p id="variation-status" role="status"></p>'
      : `<a href="../lessons/${followUp}/">Open the editable source lesson →</a>`;
  $("lesson").innerHTML = `
    <p class="lesson-topic">${escape(l.tag)}</p>
    <h2>${escape(l.title)}</h2><p class="lead">${escape(s.goal)}</p>
    <ol class="flow-steps" aria-label="Learning sequence">${stages.map(([key, title], i) => `<li><button data-flow-link="${i}" aria-controls="guide-task">${i + 1}. ${title}</button></li>`).join("")}</ol>
    <div id="guide-task" class="guide-task" role="region" aria-label="Current learning task" tabindex="0">
    <section class="lesson-stage" data-flow-stage="0"><h3>Make a prediction</h3><p>${escape(l.predict)}</p><label class="sr-only" for="prediction">Your prediction</label><textarea id="prediction" name="prediction" autocomplete="off" rows="2" maxlength="2000" placeholder="Optional prediction">${escape(notes.get(l.id))}</textarea><p id="note-status" class="muted">${storageAvailable ? "Optional. Your notes stay in this browser." : "Optional. Notes are kept for this tab session only."}</p></section>
    <section class="lesson-stage experiment-stage" data-flow-stage="1"><h3>Run and inspect</h3><p>The lab boots xv6 if needed and enters <code>${escape(l.command)}</code>.${l.breakpoint ? ` It pauses at <code>${escape(l.breakpoint)}</code>.` : ""}</p><p>${escape(observations[l.id] || s.observe)}</p><div id="guide-inspection"></div><p id="flow-cue" role="status"></p><p><strong>Starter evidence.</strong> ${escape(l.expected)}</p><button id="run-experiment" aria-describedby="run-help" hidden>Run starter again</button><p id="run-help" class="muted"></p><p id="experiment-status" class="experiment-status" role="status"></p><details class="lesson-disclosure"><summary>Hint for reading the result</summary><p>${escape(s.hint)}</p></details></section>
    <section class="lesson-stage" data-flow-stage="2"><h3>Explain the result</h3><div id="prediction-recall" class="prediction-recall" hidden><strong>You predicted</strong><blockquote id="prediction-text"></blockquote><p>What would you keep or revise after the experiment?</p></div><figure class="mechanism"><div class="flow">${s.flow.map(([label, caption], i) => `${i ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ""}<div class="flow-node"><strong>${escape(label)}</strong><span>${escape(caption)}</span></div>`).join("")}</div><figcaption>Diagram of the mechanism</figcaption></figure><p>${escape(l.concept)}</p><div class="takeaway"><span aria-hidden="true">↳</span><p>${escape(s.takeaway)}</p></div></section><section class="lesson-stage" data-flow-stage="3"><h3>Try a variation</h3><p>${escape(l.experiment)}</p>${changeAction}</section>
    <section class="lesson-stage quiz" data-flow-stage="4"><h3>Check your understanding</h3><p>${escape(l.question)}</p><div class="answers">${l.choices.map((choice, i) => `<button data-answer="${i}" aria-pressed="false"><span class="answer-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${escape(choice)}</span><span class="answer-mark" aria-hidden="true"></span></button>`).join("")}</div><p id="feedback" class="feedback" role="status"></p><details class="lesson-disclosure retrieval"><summary>Apply the idea to another question</summary><p>${escape(s.transfer)}</p><p class="muted">Explain it in your own words, then compare.</p><button id="reveal-transfer" class="text-button" aria-expanded="false" aria-controls="transfer-answer">Compare with an explanation</button><p id="transfer-answer" hidden>${escape(s.transferAnswer)}</p></details>
    <div class="completion-card"><label class="completion"><input id="complete" name="complete" type="checkbox" ${completed.has(l.id) ? "checked" : ""}><span><strong>Mark this lesson as explored</strong></span></label></div>
    </section></div><div id="resource-content"><details class="recent-evidence"><summary>Your prediction & recent output</summary><blockquote id="prediction-summary"></blockquote><pre id="recent-output"></pre></details><details class="lesson-navigation-details"><summary>Other lessons</summary><div class="lesson-navigation">${index > 0 ? `<a href="#${lessons[index - 1].id}">← Previous</a>` : "<span>Keep the machine running as you explore.</span>"}${index < lessons.length - 1 ? `<a class="next-lesson" href="#${lessons[index + 1].id}">${escape(lessons[index + 1].title)} <span aria-hidden="true">→</span></a>` : '<a class="next-lesson" href="#boot">Revisit the beginning →</a>'}</div>
    </details><details class="source-note" id="full-source"><summary>Read the matching source in this page</summary><pre id="full-source-code">Open to load the source file.</pre></details><details class="source-note"><summary>Go deeper: source & scope</summary><p>${escape(l.next)}</p><a href="https://github.com/snowch/xv6-lab/blob/main/guest/${l.source}" target="_blank" rel="noreferrer">Read ${escape(l.source)} ↗</a><p class="muted">This opens the matching source used to build this lab’s kernel and user programs.</p></details></div>`;
  $("lesson-resources").replaceChildren($("resource-content"));
  function recallPrediction() {
    $("prediction-summary").textContent =
      notes.get(l.id) ||
      "No prediction recorded. You can return to step 1 at any time.";
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
    target.textContent = "Loading matching source…";
    try {
      const response = await fetch(
        new URL("./source.json?v=guest4", import.meta.url),
      );
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      target.textContent = data.files[l.source]
        .split("\n")
        .map((line, i) => `${i + 1}: ${line}`)
        .join("\n");
    } catch (e) {
      target.textContent =
        "Could not load source: " +
        e.message +
        ". Close and reopen this panel to retry, or use the source link below.";
    }
  };
  if ($("load-command")) $("load-command").onclick = () => {
    $("command").value = commandChanges[l.id];
    $("variation-status").textContent =
      shellReady && running ? "The command is loaded. Choose Run in the xv6 command field." : "The command is loaded. Use Run and inspect to start or continue xv6, then choose Run when the $ prompt returns.";
    if (shellReady && running) $("command").focus();
  };
  if ($("run-variant")) $("run-variant").onclick = () => {
    startExperiment({ ...l, command: guidedChanges[l.id] });
  };
  $("run-experiment").onclick = () => {
    setStage(1);
    startExperiment(l);
  };
  document
    .querySelectorAll("[data-flow-link]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          setStage(Number(button.dataset.flowLink), true, true)),
    );
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
    $("lesson").scrollIntoView?.({ behavior: "auto", block: "start" });
  }
  const initial = previous
    ? 0
    : Math.max(
        0,
        stages.findIndex(
          (s) => s[0] === new URLSearchParams(location.search).get("step"),
        ),
      );
  setStage(stageByLesson.get(l.id) ?? initial);
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
  $("status").dataset.mode = !worker
    ? "idle"
    : !ready
      ? "busy"
      : !running
        ? "paused"
        : shellReady
          ? "ready"
          : "busy";
  document.body.dataset.machineMode = $("status").dataset.mode;
  if ($("run-help"))
    $("run-help").textContent = pending
      ? "Your experiment will start as soon as the shell is ready."
      : worker && !ready
        ? "The kernel is booting. Please wait for the shell."
        : ready && !running
          ? "Machine paused. Choose Continue execution in the step bar, then run this experiment."
          : ready && running && !shellReady
            ? "A command is running. Wait for the next shell prompt, or use the console for interactive input."
            : "Boots xv6 if needed and prepares this lesson’s command and breakpoint.";
  if ($("run-experiment")) {
    $("run-experiment").hidden = !finished.has(selected.id);
    if ($("run-variant"))
      $("run-variant").disabled = !!pending || (!!worker && (!ready || !running || !shellReady));
    $("run-experiment").disabled =
      !!pending || (!!worker && (!ready || !running || !shellReady));
    updateGuide();
  }
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
  $("error").focus({ preventScroll: true });
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
      ? `Command sent. xv6 will pause at ${lesson.breakpoint}. Inspect the snapshot in this task, then choose Continue execution below.`
      : "Command sent to the real shell. Compare its output with your prediction.";
}
function startExperiment(lesson) {
  if (worker && (!ready || !running || !shellReady)) return;
  launched.add(lesson.id);
  finished.delete(lesson.id);
  activeExperiment = lesson.id;
  outputStart = output.length;
  pending = lesson;
  if (!worker) boot(true);
  else launchPending();
  if (pending)
    $("experiment-status").textContent =
      "Starting xv6 and waiting for the shell. Your command will run automatically when it is ready.";
  controls();
}
function submitCommand(text) {
  activeExperiment = selected.id;
  outputStart = output.length;
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
  outputStart = 0;
  lastSnapshot = null;
  processSnapshot = null;
  pageWalks.clear();
  if (!keepPending) {
    launched.clear();
    finished.clear();
    activeExperiment = null;
  }
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
  worker = new Worker(new URL("./worker.js?v=learner-flow1", import.meta.url), {
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
        if (activeExperiment)
          evidence.set(
            activeExperiment,
            output.slice(outputStart).slice(-2000),
          );
        if (shellReady && activeExperiment && !pending)
          finished.add(activeExperiment);
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
        lastSnapshot = data;
        processSnapshot = null;
        pageWalks.clear();
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
          if (
            hasGuidedInspection() &&
            processLessons.has(selected.id) &&
            BigInt(data.pc) >= 0x80000000n &&
            BigInt(data.pc) < 0x88000000n
          )
            send("processes", { auto: true });
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
        processSnapshot = data.rows;
        $("process-result").innerHTML =
          `<table><caption>Paused guest processes</caption><thead><tr><th>PID</th><th>Name</th><th>State</th><th>Bytes</th><th>FDs</th><th>Saved user registers</th></tr></thead><tbody>${data.rows.map((p) => `<tr><td>${p.pid}</td><td>${escape(p.name)}</td><td>${escape(p.state)}</td><td>${p.bytes}</td><td>${p.descriptors}</td><td>${p.trap ? `epc ${p.trap.epc}<br>a0 ${p.trap.a0}<br>a7 ${p.trap.a7}` : "—"}</td></tr>`).join("")}</tbody></table>`;
        $("process-pid").innerHTML = data.rows
          .map(
            (p) =>
              `<option value="${p.pid}" ${p.name === "lab" ? "selected" : ""}>${p.pid} ${escape(p.name)}</option>`,
          )
          .join("");
        if (hasGuidedInspection() && selected.id === "pagetables" && !running) {
          const proc = data.rows.find((p) => p.name === "lab");
          if (proc) {
            send("pagetable", { pid: proc.pid, address: "0x0", auto: true });
            if (stage === 3)
              send("pagetable", { pid: proc.pid, address: "0x40000000", auto: true });
          }
        }
        controls();
        break;
      case "pagetable":
        pageWalks.set(data.address, data);
        $("page-result").innerHTML =
          `<p>${escape(data.result)}</p><table><caption>PID ${data.pid} · actual PTE reads</caption><thead><tr><th>Level</th><th>Index</th><th>PTE</th><th>Flags</th></tr></thead><tbody>${data.steps.map((s) => `<tr><td>${s.level}</td><td>${s.index}</td><td>${s.pte}</td><td>${s.flags || "—"}</td></tr>`).join("")}</tbody></table>`;
        updateGuide();
        break;
      case "memory":
        $("memory-result").textContent = data.address + " → " + data.value;
        break;
      case "error":
        if (data.fatal) {
          stopWorker();
          error(
            "The emulator stopped: " +
              data.message +
              ". Choose Boot xv6 to start a fresh session. Saved predictions and lesson progress are kept.",
          );
        } else error(data.message);
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
$("reset").onclick = () => {
  if (
    window.confirm(
      "Reset this machine? Files created in this xv6 session will be discarded. Your saved predictions and lesson progress will stay.",
    )
  )
    boot();
};
$("pause").onclick = () => send("pause");
$("continue").onclick = () => send("continue");
$("step").onclick = () => send("step");
$("arm").onclick = () => send("break", { symbol: $("breakpoint").value });
$("command-form").onsubmit = (event) => {
  event.preventDefault();
  if (!ready || !running || !shellReady) return;
  const text = $("command").value;
  if (text.length > 120 || /[^\x20-\x7e]/.test(text)) {
    $("command").setAttribute("aria-invalid", "true");
    $("command").setAttribute("aria-errormessage", "error");
    error(
      "Use up to 120 printable ASCII characters. Replace any Unicode characters, then run the command again.",
    );
    $("command").focus();
    return;
  }
  $("command").removeAttribute("aria-invalid");
  $("command").removeAttribute("aria-errormessage");
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
  ["skip-lesson", "lesson"],
  ["current-topic", "lesson"],
  ["back-lesson", "lesson"],
]) {
  $(id).onclick = (event) => {
    event.preventDefault();
    if (target === "lesson") $("lesson").focus({ preventScroll: true });
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

$("terminal").onpaste = (event) => {
  if (!ready || !running) return;
  const text = event.clipboardData?.getData("text").replace(/\r\n?/g, "\n");
  if (!text) return;
  if (text.length > 4096 || /[^\x20-\x7e\n]/.test(text)) {
    error(
      "Paste up to 4096 ASCII characters or lines. Use the command field for a single shell command.",
    );
    return;
  }
  shellReady = false;
  send("input", { text });
  controls();
};
