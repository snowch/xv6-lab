import "../shared-course.mjs";
import {
  acquireRunner,
  releaseRunner,
  runnerPhase,
  runtimeRecovery,
} from "../runner-controls.mjs";
let preparingRunner = false,
  sourceLoadFailed = false;
import {
  renderConcept,
  enhanceConcepts,
} from "./concept-diagrams.js?v=learner-flow1";
import { createEditor } from "./editor.js";
import { lessons, sourceExcerpt } from "./lessons.js?v=learner-flow1";
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
  recoveryScope = "browser",
  draftScope = "starter";
const draftKey = "xv6-lesson:" + kind;
const recoveryKey = "xv6-lesson-restore:" + kind;
function activity(text) {
  $("activity-status").hidden = !text;
  say("activity-status", text);
}
function persistForTab(key, value) {
  try {
    sessionStorage.setItem(key, value);
    return "tab";
  } catch {
    return "page";
  }
}
function persist(key, value) {
  try {
    localStorage.setItem(key, value);
    try {
      sessionStorage.removeItem(key);
    } catch {}
    return "browser";
  } catch {
    return persistForTab(key, value);
  }
}
function persistDraft(source) {
  if (undoRestore !== null && recoveryScope !== "browser") {
    recoveryScope = persist(recoveryKey, JSON.stringify(undoRestore));
    // Retain the previous permanent draft if that is its only permanent copy.
    if (recoveryScope === "tab") return persistForTab(draftKey, source);
    if (recoveryScope === "page") return "page";
  }
  return persist(draftKey, source);
}
function load(key) {
  try {
    const value = sessionStorage.getItem(key);
    if (value !== null) return { value, scope: "tab" };
  } catch {}
  try {
    return { value: localStorage.getItem(key), scope: "browser" };
  } catch {
    return { value: null, scope: "page" };
  }
}
function showDraftStatus() {
  say(
    "draft-status",
    {
      starter: "Starter source",
      browser: "Draft saved in this browser",
      tab: "Draft saved for this tab",
      page: "Draft kept on this page",
    }[draftScope],
  );
  $("storage-warning").hidden = ["starter", "browser"].includes(draftScope);
  if (undoRestore !== null && recoveryScope !== "browser") {
    say(
      "storage-warning",
      draftScope === "tab"
        ? "The current source and Undo restore can reopen in this tab. Permanent storage still holds any previous saved draft. To keep the current source, download it under Build tools and source download."
        : "The current source and Undo restore are available on this page. Reloading opens your previous saved draft if you had one. To keep the current source, download it under Build tools and source download.",
    );
  } else if (draftScope === "tab")
    say(
      "storage-warning",
      "Permanent storage is unavailable. Your draft can reopen in this tab. Use Download source under Build tools and source download to keep a copy before closing the tab.",
    );
  else if (draftScope === "page")
    say(
      "storage-warning",
      "Browser storage is unavailable. Use Download source under Build tools and source download to keep your edit before reloading or leaving this page.",
    );
}
function starter(id) {
  return lessons[id].starter(files);
}
function controls() {
  const build = builds.get(kind),
    same = build && build.source === drafts.get(kind);
  $("build-run").disabled = !files || !!buildJob || preparingRunner;
  $("build-only").disabled = !files || !!buildJob || preparingRunner;
  $("run-built").disabled = !same || !!buildJob;
  $("stop").disabled = !buildJob && !machine?.worker;
  $("stop").hidden = $("stop").disabled;
  say("stop", buildJob ? "Cancel build" : "Stop run");
  $("restore").disabled = !files || drafts.get(kind) === starter(kind);
  $("export-source").disabled = !files;
  $("undo-restore").hidden = undoRestore === null;
  say(
    "build-relation",
    build
      ? same
        ? "Built from this draft"
        : "Last build used earlier source"
      : "No build yet",
  );
  if (machine) {
    const failed = document.body.dataset.buildState === "error";
    const earlier = machine.source !== drafts.get(kind);
    $("run-owner").hidden = !failed && !earlier;
    say(
      "run-owner",
      failed
        ? "Latest build failed. The console and kernel evidence show the last run."
        : earlier
          ? "The console and kernel evidence show an earlier draft. Choose Build & run to run your current source."
          : "",
    );
  }
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
    lesson.mode === "kernel"
      ? Array.isArray(lesson.build?.target)
        ? "Kernel functions"
        : "Function only"
      : "Editable C",
  );
  say("reflection", lesson.reflection);
  $("test-program-details").hidden = !lesson.build?.probe;
  say("test-program-source", lesson.build?.probe || "");
  $("reading-content").innerHTML = lesson.reading;
  $("concept-slot").innerHTML = renderConcept(kind);
  enhanceConcepts($("concept-slot"));
  say("context-title", lesson.contextTitle);
  const excerpt = sourceExcerpt(files, lesson);
  say("source-location", `${excerpt.file} · line ${excerpt.first} · read-only`);
  say("source-excerpt", excerpt.text);
  $("pid-evidence").hidden = !lesson.observePid || !!lesson.observeProcesses;
  $("process-evidence").hidden = !lesson.observeProcesses;
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
      editor?.clearDiagnostics();
      draftScope = persistDraft(source);
      showDraftStatus();
      if (!buildJob) {
        document.body.dataset.buildState = "idle";
        $("build-diagnostics").hidden = true;
      }
      controls();
      if (!buildJob && !machine?.worker) activity("");
    },
    onRun: () => build(true),
  });
  document.querySelectorAll("[data-focus]").forEach(
    (button) =>
      (button.onclick = () => {
        if (!editor.focusText(button.dataset.focus))
          activity(
            "The editor no longer contains that expression. Restore starter brings it back and keeps this edit under Undo restore.",
          );
      }),
  );
  showDraftStatus();
  say(
    "build-method",
    lesson.mode === "user"
      ? "This builds the editable user program and links it with the matching xv6 user library."
      : `This compiles ${[lesson.build?.target || "sys_getpid"].flat().join(" and ")} into the real kernel. The supplied user program runs after boot; all other functions come from the matching native build.`,
  );
  document.title = lesson.title + " — xv6 Lab";
  activity("");
  controls();
}
async function build(runAfter) {
  if (buildJob || !files || preparingRunner) return;
  preparingRunner = true;
  controls();
  let assets;
  try {
    assets = await acquireRunner();
  } catch (error) {
    activity(
      error.name === "AbortError"
        ? "Runner preparation cancelled. Your draft and previous result are kept."
        : error.message,
    );
    return;
  } finally {
    preparingRunner = false;
    controls();
  }

  const exercise = kind,
    source = drafts.get(kind),
    worker = new Worker(
      new URL("./build-worker.js?v=guest4", import.meta.url),
      {
        type: "module",
      },
    ),
    job = { worker, exercise, source, runAfter };
  buildJob = job;
  document.body.dataset.buildState = "building";
  $("build-diagnostics").hidden = true;
  editor.clearDiagnostics();
  activity("Loading the compiler…");
  controls();
  const fail = (message, category = "compile") => {
    if (buildJob !== job) return;
    clearTimeout(job.timer);
    worker.terminate();
    buildJob = null;
    document.body.dataset.buildState = "error";
    $("build-diagnostics").hidden = false;
    $("build-diagnostics").querySelector("h3").textContent = "Build error";
    if (lessons[exercise].file === "user/workbench.c")
      message = message.replaceAll(
        "user/user/workbench.c:",
        "user/workbench.c:",
      );
    say(
      "build-messages",
      message + "\nFix the source, then choose Build & run.",
    );
    if (category === "asset") {
      $("build-diagnostics").querySelector("h3").textContent =
        "Code runner files unavailable";
      say(
        "build-messages",
        message +
          " Your source and previous result are kept. Reload the lesson online, then choose Build & run.",
      );
      runtimeRecovery.open();
    } else editor.diagnostic(message);
    void releaseRunner();
    activity("Build failed. See Build error below the editor.");
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
      "asset",
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
        activity("Building " + lessons[exercise].file + "…");
      }
      return;
    }
    if (data.type === "error") {
      fail(data.message, data.category);
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
    $("build-size").hidden = false;
    say(
      "build-size",
      `Edited code and data use ${data.used} bytes in the space reserved for this lesson.`,
    );
    activity(
      current
        ? "Build ready for this draft."
        : "The source changed during the build. Choose Build & run to test this draft.",
    );
    controls();
    if (runAfter && current) runBuild(record, assets);
    else void releaseRunner();
  };
  worker.postMessage({
    kind: lessons[exercise].mode,
    source,
    context: lessons[exercise].build,
    assets,
  });
}
function processEvidence() {
  if (!lessons[kind].observeProcesses || !machine) return;
  const rows =
    machine.processSnapshot?.filter((row) => row.name === "workbench") || [];
  $("process-rows").replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement("tr");
      tr.dataset.pid = String(row.pid);
      tr.dataset.state = row.state;
      for (const value of [row.pid, row.parent ?? "—", row.state]) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.append(td);
      }
      return tr;
    }),
  );
  say(
    "process-note",
    machine.processSnapshot
      ? "Workbench processes captured at the first getpid. This saved snapshot stays visible after the run."
      : machine.complete
        ? "No getpid snapshot was captured. Your edit may have removed or changed the probe."
        : machine.worker
          ? "Waiting for the first getpid call to capture the kernel records."
          : "The run stopped before a getpid snapshot was captured.",
  );
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
  if (machine.complete && !machine.processSnapshot) processEvidence();
}
function stopRun(
  message = "Run stopped. Source and the last valid build are kept.",
) {
  if (!machine?.worker) return;
  machine.worker.terminate();
  machine.worker = null;
  void releaseRunner();
  say("run-status", "Stopped");
  say("run-message", message);
  activity(message);
  processEvidence();
  controls();
}
async function runBuild(record, assets) {
  if (!record || record.source !== drafts.get(record.exercise)) {
    activity("Build the current draft before running.");
    return;
  }
  if (!assets) {
    try {
      assets = await acquireRunner();
    } catch (error) {
      activity(error.message);
      return;
    }
  }
  void runnerPhase("Running");
  machine?.worker?.terminate();
  const worker = new Worker(new URL("../worker.js?v=guest4", import.meta.url), {
    type: "module",
  });
  const run = {
    worker,
    exercise: record.exercise,
    source: record.source,
    output: "",
    started: false,
    trace: "entry",
    observePid: lessons[record.exercise].observePid,
    processSnapshot: null,
    entry: null,
    exit: null,
    reported: null,
    complete: false,
  };
  machine = run;
  $("run-status").hidden = false;
  $("run-message").hidden = false;
  $("view-result").hidden = false;
  $("console-empty").hidden = true;
  say("terminal", "");
  say("run-status", "Booting…");
  say(
    "run-message",
    "The lab will start your program as soon as the xv6 shell is ready.",
  );
  activity("Booting your built image…");
  processEvidence();
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
      const panic = run.output.match(/(?:^|\n)(panic:[^\n]*)\n/)?.[1];
      if (panic) {
        run.complete = true;
        run.worker.terminate();
        run.worker = null;
        void releaseRunner();
        say("run-status", "Kernel panic");
        say(
          "run-message",
          lessons[run.exercise].teachesKernelPanic === panic
            ? "The kernel panicked, as this experiment explores. This stops the whole virtual machine. Restore the starter and build again to boot a fresh machine."
            : "The kernel reported a panic. We stopped this virtual machine. Inspect your edit, then build and run a fresh machine.",
        );
        activity(
          "Kernel panic. Your source and build are kept; restore or edit to try again.",
        );
        controls();
        return;
      }
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
          void releaseRunner();
          say("run-status", "Run complete");
          const userFault = /(?:^|\n)usertrap\(\)/.test(run.output);
          say(
            "run-message",
            userFault
              ? lessons[run.exercise].expectedFault
                ? "A user process faulted. Check the console for which process continued."
                : "The guest reported a fault. Check the console for the error, then inspect your edit."
              : "The shell returned to its prompt.",
          );
          activity(userFault ? "Guest reported a fault." : "");
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
        if (lessons[run.exercise].observeProcesses) {
          run.processSnapshot = data.rows;
          processEvidence();
        }
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
  send("boot", { kernel: record.kernel, disk: record.disk, assets });
}
$("build-run").onclick = () => build(true);
$("build-only").onclick = () => build(false);
$("run-built").onclick = () => runBuild(builds.get(kind));
$("stop").onclick = () => {
  if (!buildJob) return stopRun();
  buildJob.worker.terminate();
  clearTimeout(buildJob.timer);
  buildJob = null;
  void releaseRunner();
  document.body.dataset.buildState = "idle";
  $("build-diagnostics").hidden = false;
  $("build-diagnostics").querySelector("h3").textContent = "Build cancelled";
  say(
    "build-messages",
    "Build cancelled. Your draft and the last valid build are kept.",
  );
  activity("Build cancelled.");
  controls();
};
$("restore").onclick = () => {
  undoRestore = drafts.get(kind);
  recoveryScope = "page";
  editor.replace(starter(kind));
  controls();
  activity("Starter restored. Undo restore is available beside the file.");
};
$("undo-restore").onclick = () => {
  if (undoRestore === null) return;
  const source = undoRestore;
  const savedRecovery = recoveryScope === "browser";
  undoRestore = null;
  editor.replace(source);
  // Undo can load a larger draft than storage can currently write.
  if (draftScope === "browser") {
    try {
      localStorage.removeItem(recoveryKey);
    } catch {}
    try {
      sessionStorage.removeItem(recoveryKey);
    } catch {}
  }
  controls();
  activity(
    draftScope !== "browser" && savedRecovery
      ? "Your previous draft is open. Its permanent recovery copy is still saved."
      : "Your previous draft is restored.",
  );
};
$("export-source").onclick = () => {
  const url = URL.createObjectURL(
      new Blob([drafts.get(kind)], { type: "text/x-csrc" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download =
    lessons[kind].mode === "user"
      ? "workbench.c"
      : [lessons[kind].build?.target || "sys_getpid"].flat()[0] + ".c";
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
    activity("Build cancelled when you left this lesson.");
    controls();
  }
  stopRun("Background run stopped when you left this lesson.");
});
try {
  const response = await fetch(
    new URL("../source.json?v=guest4", import.meta.url),
  );
  if (!response.ok) throw new Error("HTTP " + response.status);
  files = (await response.json()).files;
  let saved = load(draftKey);
  // Retain drafts made in the original two-exercise preview.
  if (
    saved.value === null &&
    ["a-system-call-result", "changing-the-answer"].includes(kind)
  )
    saved = load(
      "xv6-workbench:" + (kind === "a-system-call-result" ? "user" : "kernel"),
    );
  draftScope =
    saved.value === null && saved.scope === "browser" ? "starter" : saved.scope;
  drafts.set(kind, saved.value ?? starter(kind));
  const recovery = load(recoveryKey);
  let previous = null;
  try {
    previous = JSON.parse(recovery.value);
  } catch {}
  undoRestore =
    typeof previous === "string" && previous !== drafts.get(kind)
      ? previous
      : null;
  recoveryScope = recovery.scope;
  render();
} catch (error) {
  sourceLoadFailed = true;
  runtimeRecovery.open();
  $("build-diagnostics").hidden = false;
  $("build-diagnostics").querySelector("h3").textContent =
    "Source loading error";
  say(
    "build-messages",
    "Could not load the matching xv6 source: " +
      error.message +
      ". Reload this page to retry.",
  );
  activity("Source loading failed. Reload to retry.");
}

window.addEventListener("runner-free", () => {
  if (buildJob) {
    buildJob.worker.terminate();
    clearTimeout(buildJob.timer);
    buildJob = null;
    document.body.dataset.buildState = "idle";
    activity("Build cancelled. Your source and previous result are kept.");
    void releaseRunner();
  }
  stopRun("Runner memory released. Your code and recorded output are kept.");
  controls();
});
window.labWorkbench = {
  isBusy: () =>
    Boolean(
      (!files && !sourceLoadFailed) ||
      preparingRunner ||
      buildJob ||
      machine?.worker ||
      window.xv6Runner?.status().busy ||
      window.xv6Runner?.status().phase === "Starting",
    ),
  async saveReading() {
    return {
      source: drafts.get(kind) ?? load(draftKey).value,
      undoRestore,
      complete: $("lesson-complete").checked,
      machine: machine ? { ...machine, worker: null } : null,
    };
  },
  async restoreReading(saved) {
    if (!saved) return;
    if (!editor)
      throw Error(
        "The matching source is still unavailable. This window’s saved snapshot is kept; reload online to restore it.",
      );
    undoRestore = saved.undoRestore ?? null;
    if (undoRestore !== null)
      recoveryScope = persist(recoveryKey, JSON.stringify(undoRestore));
    if (typeof saved.source === "string") editor.replace(saved.source);
    if (typeof saved.complete === "boolean") {
      $("lesson-complete").checked = saved.complete;
      $("lesson-complete").dispatchEvent(new window.Event("change"));
    }
    if (saved.machine) {
      machine = { ...saved.machine, worker: null };
      say("terminal", machine.output);
      $("console-empty").hidden = true;
      $("run-status").hidden = false;
      say("run-status", "Saved earlier result");
      $("run-message").hidden = false;
      say(
        "run-message",
        "This result was recorded before reloading. Build & run tests your current source in a fresh machine.",
      );
      processEvidence();
      evidence();
    }
    controls();
  },
};
window.dispatchEvent(new window.Event("lab-workbench-ready"));
