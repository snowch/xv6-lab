const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../site");
const artifacts = path.resolve(__dirname, "../.artifacts");
fs.mkdirSync(artifacts, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
};
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  const file = path.resolve(root, "." + (name === "/" ? "/index.html" : name));
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, bytes) => {
    if (error) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.end(bytes);
  });
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    for (const [name, width, height] of [
      ["desktop", 1680, 1050],
      ["tablet", 1024, 1000],
      ["phone", 390, 844],
      ["small-phone", 320, 760],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        reducedMotion: "reduce",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.locator("#lesson > h2").textContent(),
        "Meet a running kernel",
      );
      const metrics = await page.locator(".lead").evaluate((el) => ({
        size: parseFloat(getComputedStyle(el).fontSize),
        family: getComputedStyle(el).fontFamily,
      }));
      assert.ok(metrics.size >= 18, name + ": reading text");
      assert.match(metrics.family, /Source Sans/);
      assert.ok(
        await page.evaluate(() => document.fonts.check('18px "Source Sans 3"')),
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        name + ": no page overflow",
      );
      if (width > 1280) {
        const nav = await page.locator("#lessons").boundingBox(),
          footer = await page.locator(".sidebar-bottom").boundingBox();
        assert.ok(
          nav.y + nav.height <= footer.y,
          "lesson list does not overlap footer",
        );
      }
      await page.screenshot({
        path: path.join(artifacts, name + "-lesson.png"),
        fullPage: false,
      });
      if (width < 1281) await page.locator("#course-menu summary").click();
      await page.locator("#lesson-search").fill("pipe");
      assert.ok((await page.locator(".lesson-link").count()) < 25);
      assert.match(page.url(), /q=pipe/);
      await page.locator("#lesson-search").fill("zzzzzz");
      await page.getByText("No lessons match.", { exact: false }).waitFor();
      await page.locator("#lesson-search").fill("");
      if (width < 1281) await page.locator("#course-menu summary").click();
      await page.locator("#run-experiment").click();
      await page.waitForFunction(
        () =>
          document
            .querySelector("#terminal")
            .textContent.includes("\nhello\n") &&
          document.querySelector("#status").textContent === "Shell ready",
        {},
        { timeout: 60000 },
      );
      assert.equal(await page.locator("#send").isDisabled(), false);
      await page.locator("#terminal").evaluate((el) => {
        const data = new DataTransfer();
        data.setData("text/plain", "echo pasted\n");
        el.dispatchEvent(
          new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
        );
      });
      await page.waitForFunction(
        () =>
          document
            .querySelector("#terminal")
            .textContent.includes("\npasted\n") &&
          !document.querySelector("#send").disabled,
      );
      if (width <= 1450) {
        assert.match(page.url(), /view=machine/);
        assert.equal(await page.locator("#lesson").isVisible(), false);
      }
      await page.locator("#pause").click();
      await page.waitForFunction(
        () => document.querySelector("#status").textContent === "Paused",
      );
      await page.screenshot({
        path: path.join(artifacts, name + "-machine.png"),
        fullPage: false,
      });
      // A cancelled reset must leave the paused machine intact.
      await page.locator(".machine-help").evaluate((el) => (el.open = true));
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.locator("#reset").click();
      assert.equal(await page.locator("#status").textContent(), "Paused");
      assert.deepEqual(errors, [], name + ": no runtime errors");
      console.log(name, "passed");
      await page.close();
    }
    const page = await browser.newPage({
      viewport: { width: 1024, height: 900 },
    });
    await page.goto(base + "?view=machine&q=memory#pagetables");
    assert.equal(await page.locator("#machine").isVisible(), true);
    assert.equal(
      await page.locator("#view-machine").getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await page.locator("#lesson-search").inputValue(), "memory");
    await page.locator("#back-lesson").click();
    assert.match(await page.locator("#lesson > h2").textContent(), /Sv39/);
    await page.close();
    console.log("deep link passed");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
