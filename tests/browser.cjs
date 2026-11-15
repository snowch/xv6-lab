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
  const file = path.resolve(
    root,
    "." + (name.endsWith("/") ? name + "index.html" : name),
  );
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
    // The course starts at a contents page and progresses through one concept per URL.
    const {
      lessons: chapter,
      lessonIds,
      chapters,
    } = await import("../site/workbench/lessons.js");
    for (const [name, width, height] of [
      ["desktop", 1680, 1050],
      ["tablet", 1024, 1000],
      ["phone", 390, 844],
      ["small-phone", 320, 760],
    ]) {
      const page = await browser.newPage({ viewport: { width, height } }),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // The earlier preview may remain cached at this unversioned URL.
      await page.route("**/workbench/lessons.js", (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: "export const lessons = {user:{},kernel:{}};",
        }),
      );
      await page.goto(base);
      assert.equal(
        await page.locator(".course-lessons li").count(),
        lessonIds.length,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: path.join(artifacts, "course-contents-" + name + ".png"),
        fullPage: true,
      });
      await page.locator(".course-actions .primary").click();
      for (const [index, id] of lessonIds.entries()) {
        await page.locator(".cm-content").waitFor();
        await page.waitForFunction(
          () => !document.querySelector("#build-run").disabled,
        );
        await page.evaluate(() => document.fonts.ready);
        assert.equal(new URL(page.url()).pathname, "/lessons/" + id + "/");
        assert.equal(await page.locator("h1").textContent(), chapter[id].title);
        assert.ok(
          (await page.locator("#source-excerpt").textContent()).trim().length >
            10,
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          id + ": no page overflow",
        );
        assert.match(
          await page.locator(".lesson-menu summary").textContent(),
          new RegExp("Chapter " + chapter[id].chapter),
        );
        const mobileEdit =
          name !== "desktop" &&
          ["a-childs-exit-status", "exec-replaces-the-program"].includes(id);
        let expected = chapter[id].expected;
        if (mobileEdit) {
          const source = await page.locator(".cm-content").innerText();
          await page.locator(".cm-content").click();
          await page.keyboard.press("ControlOrMeta+a");
          await page.keyboard.insertText(
            id === "a-childs-exit-status"
              ? source.replace("exit(7)", "exit(23)")
              : source.replace(
                  "The new program is echo",
                  "EDITED EXEC ARGUMENT",
                ),
          );
          expected =
            id === "a-childs-exit-status"
              ? "exited with status 23"
              : "EDITED EXEC ARGUMENT";
        }
        if (name === "desktop" || mobileEdit) {
          await page.locator("#build-run").click();
          await page.waitForFunction(
            () =>
              document.querySelector("#run-status").textContent ===
              "Run complete",
            null,
            { timeout: 60000 },
          );
          assert.ok(
            (await page.locator("#terminal").textContent()).includes(expected),
            id + ": real output",
          );
          assert.equal(
            await page.locator("#pid-evidence").isVisible(),
            chapter[id].observePid,
          );
          if (id === "exec-replaces-the-program") {
            const before = Number(
              await page.locator("#pid-entry").textContent(),
            );
            assert.ok(before > 0);
            assert.equal(
              Number(await page.locator("#pid-exit").textContent()),
              before,
            );
            assert.ok(
              !(await page.locator("#terminal").textContent()).includes(
                "exec returned to the old program",
              ),
            );
          }
        }
        await page.locator(".cm-content").scrollIntoViewIfNeeded();
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: path.join(
            artifacts,
            "chapter" +
              chapter[id].chapter +
              "-" +
              name +
              "-" +
              (chapters[chapter[id].chapter - 1].lessonIds.indexOf(id) + 1) +
              ".png",
          ),
          fullPage: true,
        });
        await page
          .locator('.lesson-navigation [data-direction="next"]')
          .click();
      }
      await page.locator("#resume-lesson").waitFor();
      assert.match(
        await page.locator("#resume-lesson").getAttribute("href"),
        /when-exec-fails/,
      );
      await page.locator("#resume-lesson").click();
      await page
        .locator('.lesson-navigation [data-direction="previous"]')
        .click();
      assert.equal(
        new URL(page.url()).pathname,
        "/lessons/exec-replaces-the-program/",
      );
      await page.goBack();
      await page.locator(".cm-content").waitFor();
      assert.equal(await page.locator("#build-run").isDisabled(), false);
      assert.deepEqual(errors, [], "chapter runtime errors");
      await page.close();
      console.log("Chapters 1–2 " + name + " passed");
    }
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
      await page.goto(base + "explorer/");
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
      await page.locator("#flow-next").click();
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
      assert.equal(await page.locator("#lesson").isVisible(), true);
      assert.equal(await page.locator("#machine").isVisible(), true);
      await page.screenshot({
        path: path.join(artifacts, name + "-run-inspect.png"),
        fullPage: false,
      });
      const terminalIdentity = await page
        .locator("#terminal")
        .evaluate((el) => {
          el.dataset.testIdentity = "same-machine";
          return el.dataset.testIdentity;
        });
      const y = await page.locator("#machine").evaluate((el) => el.offsetTop);
      await page.locator("#flow-next").click();
      await page.locator('[data-flow-stage="2"]').waitFor({ state: "visible" });
      assert.equal(
        await page.locator("#machine").evaluate((el) => el.offsetTop),
        y,
        "machine stays in place",
      );
      assert.equal(
        await page.locator("#terminal").getAttribute("data-test-identity"),
        terminalIdentity,
      );
      await page.locator("#flow-next").click();
      await page.locator('[data-flow-stage="3"]').waitFor({ state: "visible" });
      await page.locator("#flow-next").click();
      await page.locator('[data-flow-stage="4"]').waitFor({ state: "visible" });
      assert.equal(await page.locator("[data-flow-stage]:visible").count(), 1);
      await page.locator('[data-answer="1"]').click();
      await page.locator("#complete").check();
      assert.match(await page.locator("#progress").textContent(), /1 \/ 25/);
      await page.locator(".advanced-tools").evaluate((el) => (el.open = true));
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
    await page.goto(base + "?step=observe&q=memory#pagetables");
    assert.equal(await page.locator("#machine").isVisible(), true);
    assert.equal(await page.locator('[data-flow-stage="1"]').isVisible(), true);
    await page.locator("#flow-next").click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#guide-inspection")
          .textContent.includes("Physical address"),
      null,
      { timeout: 60000 },
    );
    await page.screenshot({
      path: path.join(artifacts, "inline-pagetable.png"),
      fullPage: false,
    });
    assert.equal(
      await page.locator(".advanced-tools").getAttribute("open"),
      null,
      "required inspection needs no advanced panel",
    );
    assert.match(
      await page.locator("#flow-next").textContent(),
      /Continue execution/,
    );
    await page.locator("#flow-next").click();
    await page.waitForFunction(
      () => document.querySelector("#status").textContent === "Shell ready",
    );
    await page.locator("#flow-next").click();
    assert.equal(await page.locator('[data-flow-stage="2"]').isVisible(), true);
    assert.equal(await page.locator("#lesson-search").inputValue(), "memory");

    assert.match(await page.locator("#lesson > h2").textContent(), /Sv39/);
    await page.close();
    console.log("deep link passed");
    // Source workbench: real browser-side C compilation and guest execution.
    for (const [name, width, height] of [
      ["wide", 1680, 1050],
      ["tablet", 1024, 1000],
      ["phone", 390, 844],
    ]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "workbench/#user");
      await page.locator(".cm-content").waitFor();
      await page.waitForFunction(
        () => !document.querySelector("#build-run").disabled,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: path.join(artifacts, "source-" + name + "-user.png"),
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "source workbench has no page overflow",
      );
      const edit = async (source) => {
        await page.locator(".cm-content").click();
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.insertText(source);
      };
      const starter = await page.locator(".cm-content").innerText();
      await edit(
        starter.replace(
          "Hello from my xv6 program!",
          "I CHANGED THIS C SOURCE",
        ),
      );
      await page.locator("#build-run").click();
      await page.waitForFunction(
        () =>
          document.querySelector("#run-status").textContent === "Run complete",
        null,
        { timeout: 60000 },
      );
      assert.match(
        await page.locator("#terminal").textContent(),
        /I CHANGED THIS C SOURCE/,
      );
      const actual = Number(await page.locator("#pid-exit").textContent());
      assert.ok(actual > 0);
      assert.equal(
        Number(await page.locator("#pid-reported").textContent()),
        actual,
      );
      const previous = await page.locator("#terminal").textContent();
      await edit(starter.replace("exit(0);", "this is invalid;"));
      await page.locator("#build-run").click();
      await page.waitForFunction(
        () => document.body.dataset.buildState === "error",
      );
      assert.match(
        await page.locator("#build-messages").textContent(),
        /workbench.c:\d+: error/,
      );
      assert.equal(
        await page.locator("#terminal").textContent(),
        previous,
        "compile errors retain last output",
      );
      await page.goto(base + "lessons/changing-the-answer/");
      await page.waitForFunction(
        () =>
          document.querySelector("#file-name").textContent ===
          "kernel/sysproc.c",
      );
      const kernel = await page.locator(".cm-content").innerText();
      await edit(kernel.replace("myproc()->pid;", "myproc()->pid + 1000;"));
      await page.locator("#build-run").click();
      await page.waitForFunction(
        () =>
          document.querySelector("#run-status").textContent ===
            "Run complete" &&
          document
            .querySelector("#terminal")
            .textContent.includes("reported pid=100"),
        null,
        { timeout: 60000 },
      );
      const internal = Number(await page.locator("#pid-exit").textContent());
      assert.ok(internal > 0);
      assert.equal(
        Number(await page.locator("#pid-reported").textContent()),
        internal + 1000,
      );
      if (name === "phone") {
        await page.locator("#view-result").click();
        assert.equal(
          new URL(page.url()).pathname,
          "/lessons/changing-the-answer/",
        );
        assert.equal(
          await page.locator("#file-name").textContent(),
          "kernel/sysproc.c",
        );
      }
      await page.screenshot({
        path: path.join(artifacts, "source-" + name + "-kernel.png"),
      });
      await page.locator("#restore").click();
      assert.equal(await page.locator("#undo-restore").isVisible(), true);
      await page.locator("#undo-restore").click();
      assert.match(await page.locator(".cm-content").innerText(), /\+ 1000/);
      if (name === "wide") {
        // A pending download can be cancelled without changing source or output.
        await page.route("**/workbench/compiler/tcc.wasm", async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await route.continue().catch(() => {});
        });
        await page.locator("#build-run").click();
        await page.locator("#stop").click();
        assert.match(
          await page.locator("#build-messages").textContent(),
          /Build cancelled/,
        );
        assert.match(await page.locator(".cm-content").innerText(), /\+ 1000/);
        await page.unroute("**/workbench/compiler/tcc.wasm");
        // Saved drafts survive reload; Stop interrupts a real looping guest.
        await page.reload();
        await page.locator(".cm-content").waitFor();
        assert.match(await page.locator(".cm-content").innerText(), /\+ 1000/);
        await page.goto(base + "lessons/a-system-call-result/");
        await page.waitForFunction(
          () =>
            document.querySelector("#file-name").textContent ===
            "user/workbench.c",
        );
        await edit(starter.replace("exit(0);", "for (;;) {}"));
        await page.locator("#build-run").click();
        await page.waitForFunction(() =>
          document
            .querySelector("#terminal")
            .textContent.includes("reported pid="),
        );
        await page.locator("#stop").click();
        assert.equal(
          await page.locator("#run-status").textContent(),
          "Stopped",
        );
        assert.match(
          await page.locator(".cm-content").innerText(),
          /for \(;;\)/,
        );
      }
      assert.deepEqual(errors, [], "source workbench runtime errors");
      await page.close();
      console.log("source workbench " + name + " passed");
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
