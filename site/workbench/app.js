import { createEditor } from "./editor.js";
import { lessons, sourceExcerpt } from "./lessons.js?v=chapter5";
const $ = (id) => document.getElementById(id),
  say = (id, value) => {
    if ($(id).textContent !== value) $(id).textContent = value;
  };
const drafts = new Map(),
  builds = new Map();
let files,
  kind = document.body.dataset.lesson,
  editor,
  buildJob = null,
  machine = null,
  undoRestore = null,
  storageOK = true;
function activity(text) {
  say("activity-status", text);
}
function save() {
  try {
    localStorage.setItem("xv6-lesson:" + kind, drafts.get(kind));
    say("draft-status", "Draft saved in this browser");
  } catch {
    storageOK = false;
    say("draft-status", "Draft kept in this tab");
    $("storage-warning").hidden = false;
    say(
      "storage-warning",
      "Browser storage is unavailable. Download your source before leaving this page.",
    );
  }
}
function starter(id) {
  return lessons[id].starter(files);
}
function controls() {
  const build = builds.get(kind),
    same = build && build.source === drafts.get(kind);
  $("build-run").disabled = !files || !!buildJob;
  $("build-only").disabled = !files || !!buildJob;
  $("run-built").disabled = !same || !!buildJob;
  $("stop").disabled = !buildJob && !machine?.worker;
  say("stop", buildJob ? "Cancel build" : "Stop run");
  $("restore").disabled = !files || drafts.get(kind) === starter(kind);
  $("export-source").disabled = !files;
  $("undo-restore").hidden = !undoRestore || undoRestore.kind !== kind;
  say(
    "build-relation",
    build
      ? same
        ? "Built from this draft"
        : "Draft differs from the last valid build"
      : "No build for this source yet",
  );
}
function contextFile() {
  const path = $("context-file").value;
  const source = files[path];
  if (!source) {
    say("context-source", "Source unavailable.");
    return;
  }
  say("context-source", source);
}

function render() {
  const lesson = lessons[kind];
  if (buildJob) {
    buildJob.worker.terminate();
    clearTimeout(buildJob.timer);
    buildJob = null;
    document.body.dataset.buildState = "idle";
  }
  editor?.destroy();
  $("source-editor").replaceChildren();
  say("lesson-title", lesson.title);
  say("lesson-subtitle", lesson.goal);
  say("file-name", lesson.file);
  say(
    "editable-label",
    lesson.mode === "kernel" ? "Function only" : "Editable C",
  );
  say("reflection", lesson.reflection);
  $("reading-content").innerHTML = lesson.reading;
  say("context-title", lesson.contextTitle);
  const excerpt = sourceExcerpt(files, lesson);
  say("source-location", `${excerpt.file} · line ${excerpt.first}`);
  say("source-excerpt", excerpt.text);
  $("pid-evidence").hidden = !lesson.observePid;
  try {
    localStorage.setItem("xv6-last-lesson", kind);
  } catch {}
  $("context-file").replaceChildren(
    ...lesson.contextFiles.map((file) => {
      const option = document.createElement("option");
      option.value = file;
      option.textContent = file;
      return option;
    }),
  );
  contextFile();
  document.querySelectorAll("a[data-lesson]").forEach((link) => {
    if (link.dataset.lesson === kind) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  editor = createEditor($("source-editor"), {
    source: drafts.get(kind),
    lineOffset: lesson.offset,
    file: lesson.file,
    onChange(source) {
      drafts.set(kind, source);
      undoRestore = null;
      editor?.clearDiagnostics();
      save();
      if (!buildJob) {
        document.body.dataset.buildState = "idle";
        say("build-messages", "Draft changed. Build to check these changes.");
      }
      controls();
      if (!buildJob && !machine?.worker)
        activity("Draft saved. Build to test these changes.");
    },
    onRun: () => build(true),
  });
  document.querySelectorAll("[data-focus]").forEach(
    (button) =>
      (button.onclick = () => {
        if (!editor.focusText(button.dataset.focus))
          activity(
            "That expression is no longer in this draft. Restore the starter to follow the original walkthrough.",
          );
      }),
  );
  say(
    "draft-status",
    storageOK ? "Draft saved in this browser" : "Draft kept in this tab",
  );
  say(
    "build-messages",
    builds.has(kind)
      ? "A valid build is available for this exercise."
      : "Ready. Edit the source, or build the starter unchanged.",
  );
  say(
    "build-method",
    lesson.mode === "user"
      ? "This builds the editable user program and links it with the matching xv6 user library."
      : "This builds the editable sys_getpid function. A fixed user program probes its return value; all other kernel code comes from the matching native build.",
  );
  document.title = lesson.title + " — xv6 Lab";
  activity("Ready to edit " + lesson.file);
  controls();
}
async function build(runAfter) {
  if (buildJob || !files) return;
  const exercise = kind,
    source = drafts.get(kind),
    worker = new Worker(
      new URL("./build-worker.js?v=source1", import.meta.url),
      { type: "module" },
    ),
    job = { worker, exercise, source, runAfter };
  buildJob = job;
  document.body.dataset.buildState = "building";
  editor.clearDiagnostics();
  say(
    "build-messages",
    "Loading the compiler, compiling C to RISC-V, and linking the edited object…",
  );
  activity("Building " + lessons[exercise].file + "…");
  controls();
  const fail = (message) => {
    if (buildJob !== job) return;
    clearTimeout(job.timer);
    worker.terminate();
    buildJob = null;
    document.body.dataset.buildState = "error";
    say(
      "build-messages",
      message +
        "\nThe last valid build and existing run are kept. Fix the source and build again.",
    );
    editor.diagnostic(message);
    activity("Build failed. See the message under the source.");
    controls();
  };
  job.timer = setTimeout(
    () =>
      fail(
        "Compiler assets took too long to download. Check your connection and try again.",
      ),
    120000,
  );
  worker.onerror = (event) =>
    fail(
      event.message ||
        "The compiler worker stopped unexpectedly. Try building again.",
    );
  worker.onmessage = async ({ data }) => {
    if (buildJob !== job) return;
    if (data.type === "progress") {
      if (data.phase === "compile") {
        clearTimeout(job.timer);
        job.timer = setTimeout(
          () =>
            fail(
              "Compilation exceeded the 15-second limit. Simplify the edit or restore the starter.",
            ),
          15000,
        );
        say(
          "build-messages",
          "Compiling C to RISC-V and linking the edited object…",
        );
      }
      return;
    }
    if (data.type === "error") {
      fail(data.message);
      return;
    }
    if (data.type !== "built") return;
    clearTimeout(job.timer);
    worker.terminate();
    buildJob = null;
    const record = { ...data, exercise, source };
    builds.set(exercise, record);
    document.body.dataset.buildState = "ready";
    const current = kind === exercise && drafts.get(kind) === source;
    say(
      "build-messages",
      `Build succeeded. A real RISC-V ELF image was created.\nEdited code/data: ${data.used} bytes in the exercise link area.` +
        (current
          ? ""
          : "\nThis build belongs to an earlier draft. Build the current source before running."),
    );
    activity(
      current
        ? "Build ready for this draft."
        : "Source changed during the build. Build your latest changes.",
    );
    controls();
    if (runAfter && current) runBuild(record);
  };
  worker.postMessage({ kind: lessons[exercise].mode, source });
}
function evidence() {
  if (!machine) return;
  say("pid-entry", machine.entry ?? "—");
  say("pid-exit", machine.exit ?? "—");
  say("pid-reported", machine.reported ?? "—");
  let note =
    "Snapshots are captured at the real getpid handler and process-exit handler.";
  if (machine.reported !== null && machine.exit !== null)
    note =
      machine.reported === machine.exit
        ? "The reported PID agrees with the kernel record in this run."
        : "The returned value differs from the PID in the kernel at exit. Look at the expression you compiled.";
  else if (machine.complete)
    note =
      "No complete getpid comparison was observed. Your program may have changed or removed the probe.";
  say("evidence-note", note);
}
function stopRun(
  message = "Run stopped. Source and the last valid build are kept.",
) {
  if (!machine?.worker) return;
  machine.worker.terminate();
  machine.worker = null;
  say("run-status", "Stopped");
  say("run-message", message);
  activity(message);
  controls();
}
function runBuild(record) {
  if (!record || record.source !== drafts.get(record.exercise)) {
    activity("Build the current draft before running.");
    return;
  }
  machine?.worker?.terminate();
  const worker = new Worker(
    new URL("../worker.js?v=source-workbench1", import.meta.url),
    { type: "module" },
  );
  const run = {
    worker,
    exercise: record.exercise,
    source: record.source,
    output: "",
    started: false,
    trace: "entry",
    observePid: lessons[record.exercise].observePid,
    entry: null,
    exit: null,
    reported: null,
    complete: false,
  };
  machine = run;
  $("view-result").hidden = false;
  $("console-empty").hidden = true;
  say("terminal", "");
  say("run-status", "Booting…");
  say("run-owner", "Running build: " + lessons[record.exercise].file);
  say(
    "run-message",
    "A fresh xv6 machine is booting. The workbench program will launch when the shell is ready.",
  );
  activity("Booting your built image…");
  evidence();
  controls();
  const send = (type, data = {}) => worker.postMessage({ type, ...data });
  worker.onerror = (event) => {
    if (machine === run)
      stopRun(
        "The emulator stopped: " +
          event.message +
          ". Restore or edit the source, then build again.",
      );
  };
  worker.onmessage = ({ data }) => {
    if (machine !== run || !run.worker) return;
    if (data.type === "error") {
      stopRun(
        "The emulator reported: " +
          data.message +
          ". Inspect the output, edit the source, and build again.",
      );
      return;
    }
    if (data.type === "output") {
      for (const char of data.text) {
        if (char === "\b") run.output = run.output.slice(0, -1);
        else if (char !== "\r") run.output += char;
      }
      run.output = run.output.slice(-100000);
      say("terminal", run.output);
      const area = $("terminal").parentElement;
      area.scrollTop = area.scrollHeight;
      const match = run.output.match(/reported pid=(-?\d+)/);
      if (match) run.reported = Number(match[1]);
      evidence();
      if (run.output.endsWith("$ ")) {
        if (!run.started) {
          run.started = true;
          say("run-status", "Running…");
          say(
            "run-message",
            "The built workbench program is running. Stop run interrupts a loop or a waiting program.",
          );
          activity("Running your compiled code…");
          if (run.observePid) send("break", { symbol: "sys_getpid" });
          send("input", { text: "workbench\n" });
        } else {
          run.complete = true;
          run.worker.terminate();
          run.worker = null;
          say("run-status", "Run complete");
          const problem = /usertrap\(\)|panic:|exec .*failed/.test(run.output);
          say(
            "run-message",
            problem
              ? lessons[run.exercise].expectedFault
                ? "The guest reported a fault, as this lesson explores. Check which process continued in the console."
                : "The guest reported a fault. Read the console, then inspect your edit."
              : "The program returned to the shell. Compare the output and kernel evidence with your source.",
          );
          activity(
            problem
              ? "The guest reported a fault. Your build is kept."
              : "Run complete. Edit the source to investigate another change.",
          );
          evidence();
          controls();
        }
      }
    }
    if (data.type === "state" && data.reason?.startsWith("Stopped at")) {
      say("run-status", "Inspecting…");
      send("processes");
    }
    if (data.type === "processes") {
      const process = data.rows.find((p) => p.state === "running");
      if (run.trace === "entry") {
        run.entry = process?.pid ?? null;
        run.trace = "exit";
        evidence();
        send("break", { symbol: "sys_exit" });
      } else {
        run.exit = process?.pid ?? null;
        run.trace = "done";
        evidence();
        send("continue");
      }
      say("run-status", "Running…");
    }
  };
  send("boot", { kernel: record.kernel, disk: record.disk });
}
$("build-run").onclick = () => build(true);
$("build-only").onclick = () => build(false);
$("run-built").onclick = () => runBuild(builds.get(kind));
$("stop").onclick = () => {
  if (!buildJob) return stopRun();
  buildJob.worker.terminate();
  clearTimeout(buildJob.timer);
  buildJob = null;
  document.body.dataset.buildState = "idle";
  say(
    "build-messages",
    "Build cancelled. Your draft and the last valid build are kept.",
  );
  activity("Build cancelled.");
  controls();
};
$("restore").onclick = () => {
  const old = drafts.get(kind);
  editor.replace(starter(kind));
  undoRestore = { kind, source: old };
  controls();
  activity("Starter restored. Undo restore is available beside the file.");
};
$("undo-restore").onclick = () => {
  const restore = undoRestore;
  if (!restore) return;
  editor.replace(restore.source);
  undoRestore = null;
  controls();
  activity("Your previous draft is restored.");
};
$("export-source").onclick = () => {
  const url = URL.createObjectURL(
      new Blob([drafts.get(kind)], { type: "text/x-csrc" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download =
    lessons[kind].mode === "user" ? "workbench.c" : "sys_getpid.c";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("context-file").onchange = contextFile;
for (const link of document.querySelectorAll(
  'a[href="#machine-pane"], a[href="#source-editor"]',
)) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const target = document.querySelector(link.getAttribute("href"));
    target.scrollIntoView({ block: "start" });
    target.focus({ preventScroll: true });
  });
}
window.addEventListener("pagehide", () => {
  if (buildJob) {
    buildJob.worker.terminate();
    clearTimeout(buildJob.timer);
    buildJob = null;
    document.body.dataset.buildState = "idle";
    say(
      "build-messages",
      "Build cancelled when you left this lesson. Build again to continue.",
    );
    controls();
  }
  stopRun("Background run stopped when you left this lesson.");
});
try {
  const response = await fetch(
    new URL("../source.json?v=source-workbench1", import.meta.url),
  );
  if (!response.ok) throw new Error("HTTP " + response.status);
  files = (await response.json()).files;
  for (const id of Object.keys(lessons)) {
    let saved;
    try {
      saved = localStorage.getItem("xv6-lesson:" + id);
      // Retain drafts made in the original two-exercise preview.
      if (
        saved === null &&
        ["a-system-call-result", "changing-the-answer"].includes(id)
      )
        saved = localStorage.getItem(
          "xv6-workbench:" +
            (id === "a-system-call-result" ? "user" : "kernel"),
        );
    } catch {
      storageOK = false;
    }
    drafts.set(id, saved ?? starter(id));
  }
  if (!storageOK) {
    $("storage-warning").hidden = false;
    say(
      "storage-warning",
      "Source can be edited, but local storage is unavailable. Download drafts before leaving.",
    );
  }
  render();
} catch (error) {
  say(
    "build-messages",
    "Could not load the matching xv6 source: " +
      error.message +
      ". Reload this page to retry.",
  );
  activity("Source loading failed. Reload to retry.");
}
