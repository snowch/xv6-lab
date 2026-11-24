// Copyright © 2026 Christopher Snow. Verified per-window snapshots veto unsafe restarts.
const slug = location.pathname.split("/").filter(Boolean)[0] || "linux-lab";
const marker = slug + ":reading-snapshot";
const readingURL = () => {
  const url = new URL(location.href);
  url.searchParams.delete("gpu-release");
  url.searchParams.delete("download");
  return url.pathname + url.search + url.hash;
};
let composing = false,
  saving = false,
  restoring = false,
  lock,
  timer;
const scope = () => [...document.querySelectorAll("body>header,main")];
const result = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
async function database() {
  const open = indexedDB.open("xv6-reading-v1", 1);
  open.onupgradeneeded = () => open.result.createObjectStore("snapshots");
  return result(open);
}
async function discard(token) {
  if (!token) return;
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").delete(token);
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function saveReadingState() {
  if (
    saving ||
    restoring ||
    composing ||
    !window.labWorkbench ||
    window.labWorkbench.isBusy()
  )
    throw Error(
      "Finish typing and stop or finish the current experiment before restarting.",
    );
  saving = true;
  const nodes = scope(),
    prior = nodes.map((n) => n.inert);
  nodes.forEach((n) => (n.inert = true));
  let token;
  try {
    const work = await window.labWorkbench.saveReading();
    token = crypto.randomUUID();
    const record = {
      token,
      url: readingURL(),
      work,
      scroll: [scrollX, scrollY],
      details: [...document.querySelectorAll("main details[id]")].map((n) => [
        n.id,
        n.open,
      ]),
    };
    const db = await database();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("snapshots", "readwrite");
        tx.objectStore("snapshots").put(record, token);
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () =>
          reject(tx.error || Error("This window’s work could not be saved."));
      });
      const check = await result(
        db.transaction("snapshots").objectStore("snapshots").get(token),
      );
      if (check?.token !== token)
        throw Error("This window’s saved snapshot could not be verified.");
    } finally {
      db.close();
    }
    sessionStorage.setItem(marker, token);
    if (sessionStorage.getItem(marker) !== token)
      throw Error(
        "Allow browser storage or export your work before restarting.",
      );
    return token;
  } catch (error) {
    if (token) await discard(token).catch(() => {});
    throw error;
  } finally {
    saving = false;
    nodes.forEach((n, i) => (n.inert = prior[i]));
  }
}
async function restore() {
  let token;
  try {
    token = sessionStorage.getItem(marker);
  } catch {
    return;
  }
  if (!token) return;
  restoring = true;
  try {
    const db = await database();
    let record;
    try {
      record = await result(
        db.transaction("snapshots").objectStore("snapshots").get(token),
      );
    } finally {
      db.close();
    }
    if (record?.url === readingURL()) {
      await window.labWorkbench.restoreReading(record.work);
      for (const [id, open] of record.details || []) {
        const n = document.getElementById(id);
        if (n) n.open = open;
      }
      requestAnimationFrame(() => scrollTo(...record.scroll));
    }
    sessionStorage.removeItem(marker);
    await discard(token);
  } catch (error) {
    document
      .querySelector("#app-status-error")
      ?.replaceChildren(
        document.createTextNode(
          "Could not restore saved work: " + error.message,
        ),
      );
  } finally {
    restoring = false;
  }
}
function unlock(remove = false) {
  if (remove) {
    let token;
    try {
      token = sessionStorage.getItem(marker);
      sessionStorage.removeItem(marker);
    } catch {}
    discard(token).catch(() => {});
  }
  clearTimeout(timer);
  lock = null;
  scope().forEach((n) => (n.inert = false));
}
document.addEventListener("compositionstart", () => (composing = true));
document.addEventListener("compositionend", () => (composing = false));
navigator.serviceWorker?.addEventListener(
  "message",
  async ({ data, ports }) => {
    if (data?.type === "PREPARE_RESTART")
      try {
        if (lock) throw Error("This window is already restarting.");
        lock = data.token;
        const token = await saveReadingState();
        if (lock !== data.token) {
          discard(token).catch(() => {});
          throw Error("The restart request expired. Try again.");
        }
        scope().forEach((n) => (n.inert = true));
        timer = setTimeout(() => unlock(true), 12000);
        ports[0].postMessage({ ready: true });
      } catch (error) {
        unlock(true);
        ports[0].postMessage({ ready: false, error: error.message });
      }
    if (data?.type === "ABORT_RESTART" && data.token === lock) unlock(true);
    if (data?.type === "COMMIT_RESTART" && data.token === lock)
      location.reload();
  },
);
window.addEventListener("lab-workbench-ready", restore, { once: true });
