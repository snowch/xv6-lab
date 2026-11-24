// Copyright © 2026 Christopher Snow. Small real releases exercise the update protocol.
const { chromium, expect } = require("playwright/test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  { createServer } = require("node:http");
(async () => {
  const { buildOffline } = await import("../tools/offline/build.mjs"),
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), "linux-updates-"));
  const roots = {},
    releases = {};
  for (const version of ["a", "b"]) {
    const root = path.join(temporary, version);
    roots[version] = root;
    await fs.mkdir(root);
    for (const file of [
      "offline.mjs",
      "release-contract.mjs",
      "release-metadata.mjs",
      "experiment-state.mjs",
    ])
      await fs.copyFile("site/" + file, path.join(root, file));
    await fs.writeFile(
      path.join(root, "index.html"),
      '<html><head><script type="module" src="./fixture.mjs"></script></head><body><header><!-- app-status-control --><button id="theme">Theme</button></header><main><textarea id="source">starter</textarea><pre id="output">recorded output</pre><details id="notes"><summary>Notes</summary>Reading</details></main></body></html>',
    );
    await fs.writeFile(
      path.join(root, "fixture.mjs"),
      `import './experiment-state.mjs';document.body.dataset.version='${version}';window.veto=false;window.labWorkbench={isBusy:()=>window.veto,saveReading:async()=>({code:document.querySelector('#source').value,output:document.querySelector('#output').textContent}),restoreReading:async saved=>{document.querySelector('#source').value=saved.code;document.querySelector('#output').textContent=saved.output;}};dispatchEvent(new Event('lab-workbench-ready'));`,
    );
    releases[version] = await buildOffline(root);
  }
  let phase = "a";
  const legacyWorker = "",
    legacyHTML = "";
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://local"),
        name = url.pathname.replace(/^\/lab\//, "") || "index.html";
      if (phase === "legacy") {
        const body =
          name === "offline.js"
            ? legacyWorker
            : name === "index.html"
              ? legacyHTML
              : name === "lab.mjs"
                ? "export const oldLesson=1;"
                : name === "runtime/libv86.mjs"
                  ? "export const originalRuntime=1;"
                  : null;
        if (body === null) throw Error();
        res
          .writeHead(200, {
            "Content-Type": name.endsWith(".html")
              ? "text/html"
              : "text/javascript",
          })
          .end(body);
        return;
      }
      let root = roots[phase];
      const pin = name.match(/^releases\/([a-f0-9]{64})\//);
      if (pin)
        root =
          roots[Object.keys(releases).find((v) => releases[v].id === pin[1])];
      const body = await fs.readFile(path.join(root, name));
      res
        .writeHead(200, {
          "Content-Type": name.endsWith(".html")
            ? "text/html"
            : name.endsWith(".json")
              ? "application/json"
              : "text/javascript",
          "Cache-Control": "no-store",
        })
        .end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port + "/lab/";
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
  });
  const rpc = async (page, data) =>
    page.evaluate(
      (data) =>
        new Promise((resolve, reject) => {
          const c = new MessageChannel(),
            timer = setTimeout(
              () => reject(Error("Worker RPC timeout")),
              20000,
            );
          c.port1.onmessage = ({ data: r }) => {
            if (
              r.done ||
              Object.hasOwn(r, "result") ||
              Object.hasOwn(r, "error")
            ) {
              clearTimeout(timer);
              resolve(r);
            }
          };
          navigator.serviceWorker.controller.postMessage(data, [c.port2]);
        }),
      data,
    );
  try {
    const context = await browser.newContext();
    const p = await context.newPage();
    await p.goto(base + "#one");
    await expect(p.locator("body")).toHaveAttribute("data-version", "a");
    await p.locator("#source").fill("first window edit");
    await p.locator("#notes").evaluate((n) => (n.open = true));
    await p.locator("#app-status-open").click();
    await expect(p.locator("#download-update")).toBeVisible({ timeout: 30000 });
    await p.locator("#download-update").click();
    await expect(p.locator("#offline-status")).toContainText(
      "Downloaded and ready to use offline",
      { timeout: 30000 },
    );
    await p.locator("#app-status-close").click();
    const q = await context.newPage();
    await q.goto(base + "#two");
    await expect(q.locator("body")).toHaveAttribute("data-version", "a");
    await q.locator("#source").fill("second window edit");
    phase = "b";
    await p.locator("#app-status-open").click();
    await p.locator("#app-status-details").evaluate((n) => (n.open = true));
    await p.locator("#check-update").click();
    await expect(p.locator("#download-update")).toHaveText(
      "Update offline copy",
      { timeout: 30000 },
    );
    await p.locator("#download-update").click();
    await expect(p.locator("#restart-update")).toBeVisible({ timeout: 30000 });
    await q.evaluate(() => (window.veto = true));
    await p.locator("#restart-update").click();
    await expect(p.locator("#app-status-error")).not.toBeEmpty({
      timeout: 20000,
    });
    await expect(q.locator("body")).toHaveAttribute("data-version", "a");
    await expect(p.locator("body")).toHaveAttribute("data-version", "a");
    await q.evaluate(() => (window.veto = false));
    await q.evaluate(() => {
      window.originalOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = () => {
        throw Error("Storage deliberately blocked");
      };
    });
    await p.locator("#restart-update").click();
    await expect(p.locator("#app-status-error")).toContainText(
      /storage|save/i,
      { timeout: 20000 },
    );
    await expect(q.locator("#source")).toHaveValue("second window edit");
    await q.evaluate(() => (indexedDB.open = window.originalOpen));
    await p.locator("#restart-update").click();
    await expect(p.locator("body")).toHaveAttribute("data-version", "b", {
      timeout: 30000,
    });
    await expect(q.locator("body")).toHaveAttribute("data-version", "b", {
      timeout: 30000,
    });
    await expect(p.locator("#source")).toHaveValue("first window edit");
    await expect(q.locator("#source")).toHaveValue("second window edit");
    assert.equal(await p.locator("#notes").evaluate((n) => n.open), true);
    await expect(p.locator("#output")).toHaveText("recorded output");
    await expect(q.locator("#output")).toHaveText("recorded output");
    // Recovery removes operational URL parameters before reloading; keep that window's snapshot reachable.
    await p.locator("#source").fill("query recovery edit");
    await p.evaluate(async () => {
      const url = new URL(location.href);
      url.searchParams.set("download", "1");
      url.searchParams.set(
        "gpu-release",
        document.querySelector('meta[name="gpu-release"]').content,
      );
      history.replaceState(null, "", url);
      const script = document.querySelector('script[src*="/fixture.mjs"]').src;
      await (
        await import(new URL("./experiment-state.mjs", script))
      ).saveReadingState();
      url.searchParams.delete("download");
      url.searchParams.delete("gpu-release");
      history.replaceState(null, "", url);
    });
    await p.reload();
    await expect(p.locator("#source")).toHaveValue("query recovery edit");
    await context.setOffline(true);
    await p.reload();
    await expect(p.locator("body")).toHaveAttribute("data-version", "b");
    await context.close();
    const empty = await browser.newContext(),
      e = await empty.newPage();
    await e.goto(base);
    await e.evaluate(async () => {
      const scope = new URL("./", location.href).href;
      await caches.open("xv6-course:" + scope + ":empty-old-cache");
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => e.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    const state = await rpc(e, { type: "STATUS", running: releases.b.id });
    assert.equal(
      state.result?.legacy ?? state.legacy,
      false,
      "An empty old cache is not an offline copy",
    );
    await empty.close();
    console.log(
      "PASS empty cache never ready; two-window busy/storage veto; atomic exact-release restart; drafts, output, disclosures and routes restored; updated copy opens offline.",
    );
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
