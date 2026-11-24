// Copyright © 2026 Christopher Snow. Real compiler/guest after browser close and server shutdown.
const { chromium, expect } = require("playwright/test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  { createServer } = require("node:http"),
  { createReadStream } = require("node:fs");
(async () => {
  const root = path.resolve(".build/site"),
    profile = await fs.mkdtemp(path.join(os.tmpdir(), "xv6-offline-"));
  let context,
    online = true;
  const server = createServer(async (req, res) => {
    try {
      let name = new URL(req.url, "http://local").pathname;
      if (!name.startsWith("/xv6-lab/")) throw Error();
      name = name.slice("/xv6-lab/".length);
      if (!name || name.endsWith("/")) name += "index.html";
      const file = path.resolve(root, name);
      if (!file.startsWith(root + path.sep)) throw Error();
      const info = await fs.stat(file);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".mjs": "text/javascript",
            ".js": "text/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".wasm": "application/wasm",
            ".svg": "image/svg+xml",
          }[path.extname(file)] || "application/octet-stream",
        "Content-Length": info.size,
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port + "/xv6-lab/";
  const errors = [];
  const options = {
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    viewport: { width: 390, height: 950 },
  };
  async function open() {
    context = await chromium.launchPersistentContext(profile, options);
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    return p;
  }
  try {
    let p = await open();
    await p.goto(base + "lessons/running-a-program/");
    await expect(p.locator("#build-run")).toBeEnabled();
    let wasmRequests = 0;
    p.on("request", (r) => {
      if (/tcc\.wasm|_bg\.wasm|images\/kernel/.test(r.url())) wasmRequests++;
    });
    await p.locator("#build-run").click();
    await expect(p.locator("#runner-intro")).toBeVisible();
    await p.keyboard.press("Escape");
    assert.equal(wasmRequests, 0);
    for (const width of [320, 390, 820, 1440])
      for (const theme of ["light", "dark"]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        for (const id of ["code-runner-open", "app-status-open", "theme"])
          await expect(p.locator("#" + id)).toBeVisible();
        const contrast = await p.evaluate(() => {
          const rgb = (value) => (value.match(/[\d.]+/g) || []).map(Number);
          const luminance = (values) =>
            values
              .slice(0, 3)
              .map((x) => x / 255)
              .map((x) =>
                x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
              )
              .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
          return [
            ...document.querySelectorAll(
              ".pane-header h2,.editable-label,.cm-gutters,.resource-row summary strong",
            ),
          ].map((node) => {
            let parent = node,
              bg;
            while (parent) {
              bg = rgb(getComputedStyle(parent).backgroundColor);
              if (bg.length === 3 || bg[3] === 1) break;
              parent = parent.parentElement;
            }
            const fg = luminance(rgb(getComputedStyle(node).color)),
              background = luminance(bg || [255, 255, 255]);
            return {
              label: node.className || node.textContent,
              ratio:
                (Math.max(fg, background) + 0.05) /
                (Math.min(fg, background) + 0.05),
            };
          });
        });
        for (const item of contrast)
          assert.ok(
            item.ratio >= 4.5,
            theme + ": " + item.label + " contrast " + item.ratio,
          );
      }
    await p.setViewportSize({ width: 390, height: 950 });
    await p.locator("#lesson-complete").check();
    await p.locator("#app-status-open").click();
    await expect(p.locator("#download-update")).toHaveText(
      "Save offline copy",
      { timeout: 30000 },
    );
    await p.locator("#download-update").click();
    await expect(p.locator("#offline-status")).toContainText(
      "Downloaded and ready to use offline",
      { timeout: 120000 },
    );
    await context.close();
    context = null;
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    online = false;
    p = await open();
    await context.setOffline(true);
    await p.goto(base + "lessons/running-a-program/");
    await expect(p.locator("#build-run")).toBeEnabled();
    await expect(p.locator("#lesson-complete")).toBeChecked();
    await p.locator("#code-runner-open").click();
    await p.locator("[data-start]").click();
    await expect(p.locator("#runner-summary")).toHaveText("Ready", {
      timeout: 60000,
    });
    await p.locator("#code-runner-dialog [data-close]").click();
    await p.locator("#build-run").click();
    await expect(p.locator("#terminal")).toContainText(
      "Hello from my xv6 program!",
      { timeout: 60000 },
    );
    await expect(p.locator("#runner-summary")).toHaveText("Ready", {
      timeout: 60000,
    });
    await expect(p.locator("#runner-intro")).toBeHidden();
    const source = await p
      .evaluate(() => window.labWorkbench.saveReading())
      .then((s) => s.source);
    await p.locator(".cm-content").click();
    await p.keyboard.press("ControlOrMeta+a");
    await p.keyboard.insertText(
      source.replace(
        "Hello from my xv6 program!",
        "Hello from my offline edit!",
      ),
    );
    await p.locator("#build-run").click();
    await expect(p.locator("#terminal")).toContainText(
      "Hello from my offline edit!",
      { timeout: 60000 },
    );
    await expect(p.locator("#runner-summary")).toHaveText("Ready", {
      timeout: 60000,
    });
    const output = await p.locator("#terminal").textContent();
    await p.evaluate(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("xv6-source-complete:"))
          throw new DOMException("Test quota", "QuotaExceededError");
        return set.call(this, key, value);
      };
    });
    await p.locator("#lesson-complete").uncheck();
    await p.evaluate(async () => {
      const app = document.querySelector(
        'script[src*="/workbench/app.js"]',
      ).src;
      await (
        await import(new URL("../experiment-state.mjs", app))
      ).saveReadingState();
    });
    await p.reload();
    await expect(p.locator("#build-run")).toBeEnabled();
    await expect(p.locator("#terminal")).toHaveText(output);
    await expect(p.locator("#run-status")).toHaveText("Saved earlier result");
    await expect(p.locator("#lesson-complete")).not.toBeChecked();
    assert.match(await p.locator(".cm-content").innerText(), /offline edit/);
    await p.goto(base + "lessons/changing-the-answer/");
    await expect(p.locator("#build-run")).toBeEnabled();
    await p.locator("#build-run").click();
    await expect(p.locator("#terminal")).toContainText("reported pid=", {
      timeout: 60000,
    });
    await expect(p.locator("#runner-summary")).toHaveText("Ready", {
      timeout: 60000,
    });
    await p.goto(base + "explorer/#console");
    await p.locator("#flow-next").click();
    await expect(p.locator("#status")).toHaveText("Stopped at sys_write", {
      timeout: 60000,
    });
    await expect(p.locator("#runner-summary")).toHaveText("Paused");
    await p.locator("#code-runner-open").click();
    p.once("dialog", (d) => d.dismiss());
    await p.locator("[data-stop]").click();
    await expect(p.locator("#status")).toHaveText("Stopped at sys_write");
    await expect(p.locator("#runner-summary")).toHaveText("Paused");
    p.once("dialog", (d) => d.accept());
    await p.locator("[data-stop]").click();
    await expect(p.locator("#runner-summary")).toHaveText("Stopped", {
      timeout: 15000,
    });
    await expect(p.locator("#status")).toHaveText("Machine stopped");
    assert.deepEqual(errors, []);
    console.log(
      "PASS first-use no-fetch cancellation; 4 widths × 2 themes; cold closed-browser/server offline user+kernel compilation; real edited output and restored code/evidence/completion; unvisited pages; real paused explorer retained until confirmed stop.",
    );
  } finally {
    await context?.close();
    if (online) {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
