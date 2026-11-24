// The DOM-only/Node-guest suites isolate header transport. Real browser suites test the actual host.
export function fixtureRunner(dom) {
  dom.window.localStorage.setItem("xv6-lab:runner-intro:1", "1");
  const ExecutionWorker = globalThis.Worker;
  globalThis.Worker = class {
    constructor(url, ...args) {
      if (!String(url).includes("runner-host.js"))
        return new ExecutionWorker(url, ...args);
    }
    postMessage({ id, action, phase }) {
      queueMicrotask(() =>
        this.onmessage?.({
          data: { id, result: action === "acquire" ? {} : true },
        }),
      );
    }
    terminate() {}
  };
}
export const runnerTick = () => new Promise((resolve) => setImmediate(resolve));
