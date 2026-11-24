// Copyright © 2026 Christopher Snow
// A release-scoped tool cache. Every execution still gets a disposable xv6 worker.
const clients = new Set();
let controller,
  prepared,
  pending,
  phase = "Stopped",
  generation = 0,
  preparations = 0,
  minutes = 30,
  lastUse = 0,
  timer,
  owner;
const root = new URL("./", self.location.href);
const notify = () => {
  const state = {
    phase,
    generation,
    preparations,
    ready: !!prepared,
    busy: !!owner,
  };
  for (const port of clients)
    try {
      port.postMessage({ state });
    } catch {
      clients.delete(port);
    }
};
function setPhase(value) {
  phase = value;
  notify();
}
function touch() {
  lastUse = Date.now();
  clearTimeout(timer);
  if (prepared && !owner) timer = setTimeout(expire, minutes * 60000);
}
function expire() {
  if (prepared && !owner && Date.now() - lastUse >= minutes * 60000)
    free("Stopped after inactivity");
  else if (prepared && !owner)
    timer = setTimeout(
      expire,
      Math.max(20, minutes * 60000 - (Date.now() - lastUse)),
    );
}
function free(message = "Stopped") {
  controller?.abort();
  generation++;
  pending = undefined;
  prepared = undefined;
  owner = undefined;
  clearTimeout(timer);
  setPhase(message);
  setTimeout(() => {
    for (const port of clients) port.postMessage({ closed: true });
    self.close();
  }, 0);
}
async function bytes(path, plain = false) {
  const response = await fetch(new URL(path, root), {
    signal: controller?.signal,
  });
  if (!response.ok)
    throw Error(
      `Could not load runner files (HTTP ${response.status}): ${path}`,
    );
  return plain ? response.text() : new Uint8Array(await response.arrayBuffer());
}
async function cache(value) {
  if (!/releases\/[a-f0-9]{64}\//.test(root.href)) return undefined;
  try {
    const db = await new Promise((yes, no) => {
      const request = indexedDB.open("xv6-tool-modules-v1", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("modules");
      request.onsuccess = () => yes(request.result);
      request.onerror = () => no(request.error);
    });
    try {
      if (value) {
        await new Promise((yes, no) => {
          const tx = db.transaction("modules", "readwrite");
          tx.objectStore("modules").put(value, root.href);
          tx.oncomplete = yes;
          tx.onerror = tx.onabort = () => no(tx.error);
        });
        return value;
      }
      return await new Promise((yes, no) => {
        const request = db
          .transaction("modules")
          .objectStore("modules")
          .get(root.href);
        request.onsuccess = () => yes(request.result);
        request.onerror = () => no(request.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}
async function prepare() {
  if (prepared) return prepared;
  if (pending) return pending;
  const epoch = generation;
  controller = new AbortController();
  setPhase("Starting");
  const work = (async () => {
    let value = await cache();
    if (!value) {
      const paths = {
        compiler: "workbench/compiler/tcc.wasm",
        runtime: "vendor/riscv_emu_rust_wasm_bg.wasm",
      };
      const modules = {};
      const entries = await Promise.all(
        Object.entries(paths).map(async ([name, path]) => {
          const binary = await bytes(path);
          modules[name] = await WebAssembly.compile(binary);
          return [name, binary];
        }),
      );
      value = {
        ...Object.fromEntries(entries),
        modules,
        user: await bytes("workbench/assets/user-base.elf"),
        source: await bytes("source.json", true),
        layout: await bytes("layout.json", true),
        kernel: await bytes("images/kernel"),
        disk: await bytes("images/fs.img"),
      };
      await cache(value);
    }
    if (epoch !== generation)
      throw new DOMException("Preparation cancelled", "AbortError");
    prepared = value;
    preparations++;
    setPhase("Ready");
    touch();
    return value;
  })();
  pending = work;
  try {
    return await work;
  } catch (error) {
    if (epoch === generation) {
      prepared = undefined;
      setPhase(error.name === "AbortError" ? "Stopped" : "Could not start");
    }
    throw error;
  } finally {
    if (pending === work) pending = undefined;
  }
}
function attach(port) {
  clients.add(port);
  port.onmessage = async ({ data }) => {
    const { id, action } = data;
    try {
      let result;
      if (action === "status") {
        expire();
        result = {
          phase,
          generation,
          preparations,
          ready: !!prepared,
          busy: !!owner,
        };
      } else if (action === "prepare") {
        await prepare();
        result = true;
      } else if (action === "acquire") {
        if (owner && owner !== port)
          throw Error(
            "Another course window is running code. Stop it before starting here.",
          );
        await prepare();
        if (owner && owner !== port)
          throw Error("Another course window is running code.");
        owner = port;
        clearTimeout(timer);
        setPhase("Building");
        const { modules, ...binary } = prepared;
        result = { ...binary, cacheKey: root.href };
      } else if (action === "phase") {
        if (owner === port) setPhase(data.phase);
        result = true;
      } else if (action === "release") {
        if (owner === port) {
          owner = undefined;
          setPhase(prepared ? "Ready" : "Stopped");
          touch();
        }
        result = true;
      } else if (action === "free") {
        free();
        result = true;
      } else if (action === "idle") {
        if ([5, 15, 30, 60].includes(data.minutes)) minutes = data.minutes;
        expire();
        result = true;
      } else throw Error("Unknown runner request");
      port.postMessage({ id, result });
    } catch (error) {
      port.postMessage({
        id,
        error: {
          message: error.message,
          name: error.name,
          runtimeLoad: action === "prepare" || phase === "Could not start",
        },
      });
    }
  };
  port.start?.();
  notify();
}
if ("onconnect" in self) onconnect = (event) => attach(event.ports[0]);
else
  attach({
    postMessage: (value) => postMessage(value),
    set onmessage(fn) {
      self.onmessage = fn;
    },
  });
