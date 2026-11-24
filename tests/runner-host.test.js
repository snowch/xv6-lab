import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
test("prepared host protects busy/paused ownership and expires only unused prepared tools", async () => {
  let now = 0,
    closed = false;
  const timers = [];
  // A minimal real empty WASM module tests lifecycle only; no learner output is modelled here.
  const moduleBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  const context = vm.createContext({
    console,
    URL,
    Uint8Array,
    DOMException,
    AbortController,
    WebAssembly,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    setTimeout: (fn, delay) => {
      const item = { fn, delay };
      timers.push(item);
      return item;
    },
    clearTimeout: (item) => {
      if (item) item.cancelled = true;
    },
    fetch: async () => ({
      ok: true,
      arrayBuffer: async () => moduleBytes.buffer,
      text: async () => '{"files":{}}',
    }),
  });
  context.self = {
    location: { href: "https://example.test/xv6-lab/runner-host.js" },
    close: () => {
      closed = true;
    },
    onconnect: null,
  };
  await vm.runInContext(
    await readFile(new URL("../site/runner-host.js", import.meta.url), "utf8"),
    context,
  );
  const port = () => ({
      messages: [],
      postMessage(data) {
        this.messages.push(data);
      },
      start() {},
    }),
    a = port(),
    b = port();
  context.onconnect({ ports: [a] });
  context.onconnect({ ports: [b] });
  let sequence = 0;
  async function ask(port, action, data = {}) {
    const id = ++sequence;
    await port.onmessage({ data: { id, action, ...data } });
    return port.messages.find((x) => x.id === id);
  }
  await ask(a, "acquire");
  await ask(a, "phase", { phase: "Paused" });
  now = 60 * 60000;
  assert.equal((await ask(a, "status")).result.phase, "Paused");
  assert.match(
    (await ask(b, "acquire")).error.message,
    /another course window/i,
  );
  await ask(a, "release");
  assert.equal((await ask(a, "status")).result.phase, "Ready");
  now += 31 * 60000;
  assert.match((await ask(a, "status")).result.phase, /Stopped/);
  assert.equal((await ask(a, "status")).result.ready, false);
  for (const timer of timers)
    if (!timer.cancelled && timer.delay === 0) timer.fn();
  assert.equal(closed, true);
});
