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
  ".png": "image/png",
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
    const { edits } = await import("./lesson-edits.js");
    const { concepts, lessonConcepts } =
      await import("../site/workbench/concept-diagrams.js");
    const latest = chapters.at(-1);
    const matchingFiles = JSON.parse(
      fs.readFileSync(path.join(root, "source.json"), "utf8"),
    ).files;
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
        await page.locator(".course-chapter details[open]").count(),
        0,
      );
      const hero = page.locator(".hero-visual img");
      assert.ok(
        await hero.evaluate(
          (image) => image.complete && image.naturalWidth > 0,
        ),
        "front-page illustration loads",
      );
      const chapterMenus = page.locator(".course-chapter summary");
      await chapterMenus.first().focus();
      await page.keyboard.press("Enter");
      assert.ok(
        await page
          .locator(".course-chapter")
          .first()
          .locator(".course-lessons")
          .isVisible(),
      );
      await chapterMenus.nth(1).click();
      assert.equal(
        await page.locator(".course-chapter details[open]").count(),
        1,
        "chapters form a compact accordion",
      );
      await chapterMenus.nth(1).click();
      assert.equal(
        await page.locator(".course-chapter details[open]").count(),
        0,
      );
      assert.equal(
        await page.locator(".course-lessons li").count(),
        lessonIds.length,
      );
      await page.locator('a[href="#c-prerequisites"]').click();
      assert.ok(await page.locator("#c-prerequisites").isVisible());
      assert.match(
        await page.locator("#c-prerequisites").textContent(),
        /variables, conditions, loops, function calls and return values/,
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
        const concept = concepts[lessonConcepts[id]];
        const figure = page.locator(".concept-diagram");
        assert.equal(
          await figure.count(),
          concept ? 1 : 0,
          id + ": relevant diagram",
        );
        if (concept) {
          assert.ok(
            await figure
              .locator(".concept-value")
              .evaluateAll((nodes) =>
                nodes.every(
                  (el) => parseFloat(getComputedStyle(el).fontSize) >= 18,
                ),
              ),
            id + ": readable diagram labels",
          );
          if (concept.steps) {
            const before = await page.locator(".cm-content").textContent();
            const next = figure.locator("[data-concept-next]");
            const controlTop = await next.evaluate(
              (el) => el.getBoundingClientRect().top + scrollY,
            );
            await next.focus();
            await page.keyboard.press("Enter");
            assert.equal(
              await figure.locator(".concept-position").textContent(),
              "Step 2 of " + concept.steps.length,
            );
            assert.ok(
              Math.abs(
                (await next.evaluate(
                  (el) => el.getBoundingClientRect().top + scrollY,
                )) - controlTop,
              ) < 2,
              id + ": changing step text keeps controls in place",
            );
            await figure.locator("[data-concept-prev]").focus();
            await page.keyboard.press("Enter");
            assert.ok(await figure.locator("[data-concept-prev]").isDisabled());
            assert.equal(
              await page.locator(".cm-content").textContent(),
              before,
              "diagram preserves edited source",
            );
          }
          if (
            [
              "fork-creates-a-child",
              "entering-the-kernel",
              "walking-three-page-table-levels",
              "redo-replay-is-idempotent",
            ].includes(id)
          ) {
            // Place the figure clear of the fixed build toolbar before capturing it.
            await figure.scrollIntoViewIfNeeded();
            await figure.screenshot({
              path: path.join(artifacts, `concept-${id}-${name}.png`),
            });
          }
        }
        const reminder = page.locator(".c-reminder");
        assert.equal(await reminder.count(), 1);
        assert.equal(await reminder.getAttribute("open"), null);
        if (id === "the-current-process") {
          // Keyboard disclosure and a refresher tab must preserve edited source.
          const draft =
            chapter[id].starter(matchingFiles) +
            "\n// Saved C refresher draft\n";
          await page.locator(".cm-content").click();
          await page.keyboard.press("ControlOrMeta+a");
          await page.keyboard.insertText(draft);
          await reminder.locator("summary").focus();
          await page.keyboard.press("Enter");
          assert.notEqual(await reminder.getAttribute("open"), null);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            name + ": expanded C reminder has no page overflow",
          );
          assert.ok(
            await reminder
              .locator("p")
              .first()
              .evaluate(
                (el) => parseFloat(getComputedStyle(el).fontSize) >= 18,
              ),
          );
          await page.screenshot({
            path: path.join(artifacts, "c-reminder-" + name + ".png"),
            fullPage: true,
          });
          const refresher = reminder.locator("a").first();
          assert.equal(await refresher.getAttribute("target"), "_blank");
          assert.match(await refresher.textContent(), /new tab/);
          // Test navigation independently of C Foundry's network availability.
          await page
            .context()
            .route("https://snowch.github.io/c-foundry/**", (route) =>
              route.fulfill({
                contentType: "text/html",
                body: "<title>C refresher</title>",
              }),
            );
          const [popup] = await Promise.all([
            page.waitForEvent("popup"),
            refresher.click(),
          ]);
          await popup.waitForLoadState();
          assert.equal(popup.url(), await refresher.getAttribute("href"));
          await popup.close();
          assert.equal(new URL(page.url()).pathname, "/lessons/" + id + "/");
          await page.reload();
          await page.locator(".cm-content").waitFor();
          assert.match(
            await page.locator(".cm-content").textContent(),
            /Saved C refresher draft/,
          );
          await page.waitForFunction(
            () => !document.querySelector("#build-run").disabled,
          );
        }
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
        const latestMobile =
          name !== "desktop" &&
          latest.number >= 3 &&
          ([latest.lessonIds[0], latest.lessonIds.at(-1)].includes(id) ||
            chapter[id].observeProcesses);
        const mobileEdit =
          latestMobile ||
          (name !== "desktop" &&
            (["a-childs-exit-status", "exec-replaces-the-program"].includes(
              id,
            ) ||
              chapter[id].teachesKernelPanic));
        let expected = chapter[id].expected;
        if (mobileEdit) {
          const source = chapter[id].starter(matchingFiles);
          await page.locator(".cm-content").click();
          await page.keyboard.press("ControlOrMeta+a");
          await page.keyboard.insertText(
            latestMobile || chapter[id].teachesKernelPanic
              ? edits[id].edit(source)
              : id === "a-childs-exit-status"
                ? source.replace("exit(7)", "exit(23)")
                : source.replace(
                    "The new program is echo",
                    "The replacement printed this",
                  ),
          );
          expected =
            latestMobile || chapter[id].teachesKernelPanic
              ? edits[id].expected
              : id === "a-childs-exit-status"
                ? "exited with status 23"
                : "The replacement printed this";
        }
        if (
          (name === "desktop" &&
            (chapter[id].chapter === latest.number ||
              chapter[id].observePid ||
              chapter[id].teachesKernelPanic ||
              id === lessonIds[0])) ||
          mobileEdit
        ) {
          await page.locator("#build-run").click();
          await page
            .waitForFunction(
              () =>
                document.body.dataset.buildState === "error" ||
                document.querySelector("#run-status").textContent ===
                  "Run complete" ||
                document.querySelector("#run-status").textContent ===
                  "Kernel panic",
              null,
              { timeout: 60000 },
            )
            .catch(async (error) => {
              await page.screenshot({
                path: path.join(
                  artifacts,
                  "failed-" + name + "-" + id + ".png",
                ),
                fullPage: true,
              });
              error.message =
                id +
                ": " +
                (await page.locator("#run-status").textContent()) +
                "\n" +
                (await page.locator("#terminal").textContent()) +
                "\n" +
                error.message;
              throw error;
            });
          assert.notEqual(
            await page.locator("body").getAttribute("data-build-state"),
            "error",
            id + ": " + (await page.locator("#build-messages").textContent()),
          );
          assert.ok(
            (await page.locator("#terminal").textContent()).includes(expected),
            id + ": real output",
          );
          assert.equal(
            await page.locator("#pid-evidence").isVisible(),
            chapter[id].observePid && !chapter[id].observeProcesses,
          );
          if (chapter[id].observeProcesses) {
            const rows = page.locator("#process-rows tr");
            assert.equal(await rows.count(), 2);
            const running = page.locator(
              '#process-rows tr[data-state="running"]',
            );
            assert.equal(await running.count(), 1);
            const parent = await running.locator("td").nth(1).textContent();
            assert.equal(
              await page
                .locator('#process-rows tr[data-pid="' + parent + '"]')
                .getAttribute("data-state"),
              "sleeping",
            );
          }
          if (chapter[id].expectedFault)
            assert.match(
              await page.locator("#run-message").textContent(),
              /as this lesson explores/,
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
          if (chapter[id].teachesKernelPanic && mobileEdit) {
            assert.equal(
              await page.locator("#run-status").textContent(),
              "Kernel panic",
            );
            assert.match(
              await page.locator("#run-message").textContent(),
              /whole virtual machine/,
            );
            assert.equal(await page.locator("#stop").isDisabled(), true);
            await page.screenshot({
              path: path.join(artifacts, "kernel-panic-" + name + ".png"),
              fullPage: true,
            });
            await page.locator("#restore").click();
            await page.locator("#build-run").click();
            await page.waitForFunction(
              () =>
                document.body.dataset.buildState === "error" ||
                document.querySelector("#run-status").textContent ===
                  "Run complete",
              null,
              { timeout: 60000 },
            );
            assert.ok(
              (await page.locator("#terminal").textContent()).includes(
                chapter[id].expected,
              ),
            );
            assert.ok(
              !(await page.locator("#terminal").textContent()).includes(
                "panic:",
              ),
            );
          } else if (chapter[id].teachesKernelPanic) {
            assert.equal(
              await page.locator("#run-status").textContent(),
              "Run complete",
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
      assert.equal(
        await page.locator("#resume-lesson").getAttribute("href"),
        "lessons/" + lessonIds.at(-1) + "/",
      );
      await page.locator("#resume-lesson").click();
      await page
        .locator('.lesson-navigation [data-direction="previous"]')
        .click();
      assert.equal(
        new URL(page.url()).pathname,
        "/lessons/" + lessonIds.at(-2) + "/",
      );
      await page.goBack();
      await page.locator(".cm-content").waitFor();
      assert.equal(await page.locator("#build-run").isDisabled(), false);
      assert.deepEqual(errors, [], "chapter runtime errors");
      await page.close();
      console.log("Chapters 1–" + latest.number + " " + name + " passed");
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
    await page.locator("#flow-next").click();
    await page.getByRole("button", { name: "Compare two addresses", exact: true }).press("Enter");
    await page.waitForFunction(() => {
      const compare = document.querySelector("#guide-variant-inspection").textContent;
      return compare.includes("Physical address") && compare.includes("Unmapped");
    }, null, { timeout: 60000 });
    const comparison = page.locator("#guide-variant-inspection");
    assert.match(await comparison.textContent(), /lab · 0x0[\s\S]*L0 \[0\][\s\S]*Physical address/);
    assert.match(await comparison.textContent(), /lab · 0x40000000[\s\S]*L2 \[1\][\s\S]*Unmapped/);
    assert.equal(await page.locator(".advanced-tools").getAttribute("open"), null);
    await page.locator("#flow-next").press("Enter");
    await page.waitForFunction(() => document.querySelector("#status").textContent === "Shell ready");
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
      assert.match(
        await page.locator("#run-owner").textContent(),
        /Latest build failed.*last run/,
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
      if (name === "phone") {
        await page.reload();
        await page.locator(".cm-content").waitFor();
        assert.doesNotMatch(await page.locator(".cm-content").innerText(), /\+ 1000/);
        assert.equal(await page.locator("#undo-restore").isVisible(), true);
      }
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
