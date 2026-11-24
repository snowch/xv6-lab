// Copyright © 2026 Christopher Snow
import { mountRuntimeRecovery } from "./runtime-recovery.mjs";
import { saveReadingState } from "./experiment-state.mjs";
const choices = [5, 15, 30, 60],
  key = "xv6-lab:runner-idle",
  introKey = "xv6-lab:runner-intro:1";
let port,
  host,
  sequence = 0,
  phase = "Stopped",
  ready = false,
  busy = false,
  origin,
  lastInitiator,
  minutes = 30;
const requests = new Map();
try {
  const saved = Number(localStorage.getItem(key));
  if (choices.includes(saved)) minutes = saved;
} catch {}
const button = document.querySelector("#code-runner-open"),
  summary = document.querySelector("#runner-summary");
document.addEventListener(
  "click",
  (event) => {
    const control = event.target.closest("button");
    if (
      control &&
      (control.closest("#workbench") ||
        control.id === "run" ||
        control === button)
    )
      lastInitiator = control;
  },
  true,
);
document.addEventListener(
  "keydown",
  (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter")
      lastInitiator = document.querySelector("#run");
  },
  true,
);
const dialog = document.createElement("dialog");
dialog.id = "code-runner-dialog";
dialog.setAttribute("aria-labelledby", "runner-title");
dialog.innerHTML = `<div class="status-heading"><h2 id="runner-title">Code runner</h2><button type="button" data-close>Close</button></div><p data-state role="status">Stopped</p><p>The C compiler and xv6 emulator use this device’s CPU and memory. Prepared tools make later runs faster. Each source lesson run starts a fresh machine. The explorer keeps its machine until you stop it or leave the page.</p><label for="runner-idle">Stop after this long without a run</label><select id="runner-idle">${choices.map((n) => `<option value="${n}">${n} minutes</option>`).join("")}</select><p>Free memory keeps your code, predictions and recorded results. Explorer files and paused machine state are discarded only after you explicitly stop that machine. Browsers do not provide reliable per-runner CPU percentages or total memory measurements.</p><div class="status-actions"><button type="button" class="primary" data-start>Start runner</button><button type="button" data-stop hidden>Free memory</button></div>`;
document.body.append(dialog);
const intro = document.createElement("dialog");
intro.id = "runner-intro";
intro.setAttribute("aria-labelledby", "runner-intro-title");
intro.innerHTML =
  '<h2 id="runner-intro-title">Code runs on your device</h2><p>The C compiler and xv6 emulator use this device’s CPU and memory. Preparing the tools once makes later runs faster. Each source lesson run starts a fresh machine. The explorer keeps its machine until you stop it or leave the page.</p><p data-time></p><p>Use Code runner in the header to change the time or free memory sooner. Your code, predictions and recorded results are kept.</p><button type="button" class="primary" data-continue>Continue run</button><button type="button" data-settings>Runner settings</button>';
document.body.append(intro);
export const runtimeRecovery = mountRuntimeRecovery({
  save: saveReadingState,
  beforeOpen() {
    const focus = intro.open
      ? origin
      : dialog.open
        ? button
        : document.activeElement;
    if (intro.open) intro.close("cancel");
    if (dialog.open) dialog.close();
    return lastInitiator?.isConnected ? lastInitiator : focus;
  },
  runLabel: "Build & run",
});
function render(state = { phase, ready, busy }) {
  const wasActive = ready || busy || phase === "Starting";
  ({ phase, ready, busy } = state);
  summary.textContent = phase;
  dialog.querySelector("[data-state]").textContent = phase;
  dialog.querySelector("[data-start]").hidden = ready;
  dialog.querySelector("[data-start]").disabled = busy || phase === "Starting";
  dialog.querySelector("[data-stop]").hidden =
    !ready && phase !== "Starting" && !busy;
  dialog.querySelector("[data-stop]").textContent = busy
    ? "Stop code and free memory"
    : "Free memory";
  window.dispatchEvent(
    new window.CustomEvent("code-runner-state", { detail: state }),
  );
  if (!ready && phase.startsWith("Stopped") && wasActive)
    window.dispatchEvent(new window.Event("runner-free"));
}
function connect() {
  if (port) return;
  const url = new URL("./runner-host.js", import.meta.url);
  try {
    if (typeof SharedWorker === "function") {
      host = new SharedWorker(url, { name: "xv6-tools:" + url.href });
      port = host.port;
      port.start();
    } else {
      host = new Worker(url);
      port = host;
    }
  } catch (error) {
    render({ phase: "Could not start", ready: false, busy: false });
    throw Object.assign(error, { runtimeLoad: true });
  }
  port.onmessage = ({ data }) => {
    if (data.closed) {
      for (const job of requests.values()) {
        clearTimeout(job.timer);
        job.reject(new DOMException("Runner stopped", "AbortError"));
      }
      requests.clear();
      port?.close?.();
      host?.terminate?.();
      port = undefined;
      host = undefined;
      return;
    }
    if (data.state) {
      render(data.state);
      return;
    }
    const job = requests.get(data.id);
    if (!job) return;
    clearTimeout(job.timer);
    requests.delete(data.id);
    if (data.error) {
      const error = Object.assign(Error(data.error.message), data.error);
      job.reject(error);
    } else job.resolve(data.result);
  };
  port.onmessageerror = () => {
    for (const job of requests.values()) {
      clearTimeout(job.timer);
      job.reject(
        Object.assign(
          Error("The browser could not read the prepared runner files."),
          { runtimeLoad: true },
        ),
      );
    }
    requests.clear();
    runtimeRecovery.open();
  };
  host.onerror = (event) => {
    const required = [...requests.values()].some((job) =>
      ["prepare", "acquire"].includes(job.action),
    );
    event.preventDefault?.();
    for (const job of requests.values()) {
      clearTimeout(job.timer);
      job.reject(
        Object.assign(Error("The runner files could not be loaded."), {
          runtimeLoad: true,
        }),
      );
    }
    requests.clear();
    port = undefined;
    render({ phase: "Could not start", ready: false, busy: false });
    if (required) runtimeRecovery.open();
  };
  request("idle", { minutes }).catch(() => {});
}
function request(action, data = {}) {
  connect();
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      requests.delete(id);
      reject(
        Object.assign(
          Error("Runner preparation timed out. Reconnect and try again."),
          { runtimeLoad: true },
        ),
      );
    }, 120000);
    requests.set(id, { action, resolve, reject, timer });
    port.postMessage({ id, action, ...data });
  });
}
let sessionAcknowledged = false;
function acknowledge() {
  sessionAcknowledged = true;
  try {
    localStorage.setItem(introKey, "1");
  } catch {}
}
async function firstUse() {
  let acknowledged = false;
  try {
    acknowledged = localStorage.getItem(introKey) === "1";
  } catch {}
  if (acknowledged || sessionAcknowledged || ready) return;
  origin = lastInitiator?.isConnected ? lastInitiator : document.activeElement;
  intro.querySelector("[data-time]").textContent =
    `The prepared tools are released after ${minutes} minutes without a run.`;
  intro.returnValue = "";
  intro.showModal();
  await new Promise((resolve, reject) =>
    intro.addEventListener(
      "close",
      () => {
        if (intro.returnValue === "continue") {
          acknowledge();
          resolve();
        } else reject(new DOMException("Run cancelled", "AbortError"));
      },
      { once: true },
    ),
  );
}
export async function acquireRunner() {
  await firstUse();
  try {
    return await request("acquire");
  } catch (error) {
    if (error.runtimeLoad && error.name !== "AbortError")
      runtimeRecovery.open();
    throw error;
  }
}
export const releaseRunner = () =>
  port ? request("release").catch(() => {}) : Promise.resolve();
export const runnerPhase = (value) =>
  port && request("phase", { phase: value }).catch(() => {});
export const runnerStatus = () => ({ phase, ready, busy });
export async function freeRunner() {
  if (
    (busy || window.xv6Explorer?.hasMachine()) &&
    !window.confirm(
      "Stop code and free memory in open xv6 Lab windows? Explorer files and paused machine state will be discarded. Saved source, predictions and recorded results are kept.",
    )
  )
    return;
  window.dispatchEvent(new window.Event("runner-free"));
  if (port) await request("free");
  else render({ phase: "Stopped", ready: false, busy: false });
}
button.onclick = () => {
  origin = button;
  dialog.showModal();
  if (port) request("status").catch(() => {});
};
dialog.querySelector("[data-close]").onclick = () => dialog.close();
dialog.addEventListener(
  "close",
  () => origin?.isConnected && origin.focus({ preventScroll: true }),
);
dialog.querySelector("[data-start]").onclick = async () => {
  acknowledge();
  try {
    await request("prepare");
  } catch (error) {
    if (error.name !== "AbortError") runtimeRecovery.open();
  }
};
dialog.querySelector("[data-stop]").onclick = () =>
  freeRunner().catch(
    (error) =>
      (dialog.querySelector("[data-state]").textContent = error.message),
  );
dialog.querySelector("#runner-idle").value = String(minutes);
dialog.querySelector("#runner-idle").onchange = (event) => {
  minutes = Number(event.target.value);
  try {
    localStorage.setItem(key, String(minutes));
  } catch {}
  if (port) request("idle", { minutes }).catch(() => {});
};
intro.querySelector("[data-continue]").onclick = () => intro.close("continue");
intro.querySelector("[data-settings]").onclick = () => {
  intro.close("cancel");
  dialog.showModal();
};
intro.addEventListener("cancel", (event) => {
  event.preventDefault();
  intro.close("cancel");
  origin?.focus();
});
window.addEventListener("pagehide", () => releaseRunner());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && port)
    request("status").catch(() => {});
});
window.xv6Runner = {
  status: runnerStatus,
  free: freeRunner,
  prepare: () => request("prepare"),
};

// A light status connection can attach to tools kept by another lesson. It downloads no WASM.
request("status").catch(() => {});

intro.addEventListener("close", () =>
  setTimeout(() => {
    if (origin?.isConnected && !origin.disabled)
      origin.focus({ preventScroll: true });
    else {
      const status = document.getElementById("run-status");
      if (status) {
        status.tabIndex = -1;
        status.focus({ preventScroll: true });
      }
    }
  }, 0),
);
