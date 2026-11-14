import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Worker as NodeWorker } from "node:worker_threads";
import { JSDOM } from "jsdom";
import { lessons } from "../site/lessons.js";
import { learning } from "../site/learning.js";

test("every lesson has a goal, actionable scaffolds, and feedback for each misconception", () => {
  for (const lesson of lessons) {
    const scaffold = learning[lesson.id];
    for (const field of [
      "goal",
      "needs",
      "observe",
      "hint",
      "takeaway",
      "transfer",
      "transferAnswer",
    ])
      assert.ok(scaffold[field]?.length > 15, `${lesson.id}: ${field}`);
    assert.equal(scaffold.flow.length, 3);
    assert.equal(scaffold.steps.length, 3);
    lesson.choices.forEach((_, i) => {
      if (i !== lesson.answer) assert.ok(scaffold.wrong[i]?.length > 25);
    });
  }
});

test(
  "guided UI runs the real guest, waits for shell readiness, and prepares each lesson",
  { timeout: 300000 },
  async (t) => {
    const dom = new JSDOM(
      readFileSync(new URL("../site/index.html", import.meta.url), "utf8"),
      { url: "https://example.test/xv6-lab/#boot" },
    );
    dom.window.matchMedia = (query) => ({
      matches: query.includes("max-width"),
    });
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      location: dom.window.location,
      localStorage: dom.window.localStorage,
    });
    const workers = [];
    let failure;
    globalThis.Worker = class {
      constructor() {
        this.messages = [];
        this.worker = new NodeWorker(
          new URL("./node-worker.js", import.meta.url),
        );
        workers.push(this);
        this.worker.on("message", (data) => this.onmessage?.({ data }));
        this.worker.on("error", (error) => {
          failure = error;
        });
      }
      postMessage(data) {
        this.messages.push(data);
        this.worker.postMessage(data);
      }
      terminate() {
        this.onmessage = null;
        this.worker.removeAllListeners("message");
        this.worker.terminate();
        this.terminated = true;
      }
    };
    t.after(() => {
      for (const worker of workers) worker.terminate();
      dom.window.close();
    });
    await import("../site/app.js");
    const $ = (id) => document.getElementById(id);
    assert.equal(
      $("course-menu").open,
      false,
      "tablet starts with compact curriculum",
    );
    $("view-machine").click();
    assert.equal(document.body.classList.contains("view-machine"), true);
    $("view-lesson").click();
    assert.equal(document.body.classList.contains("view-machine"), false);
    async function until(predicate, description, timeout = 60000) {
      const start = Date.now();
      while (!predicate()) {
        if (failure) throw failure;
        if (!$("error").hidden) throw new Error($("error").textContent);
        if (Date.now() - start > timeout)
          throw new Error(
            "Timed out: " + description + "\n" + $("terminal").textContent,
          );
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    $("prediction").value = "The shell reads the command";
    $("prediction").dispatchEvent(new dom.window.Event("input"));
    $("run-experiment").click();
    assert.equal(workers.length, 1);
    assert.equal($("send").disabled, true);
    assert.equal($("run-experiment").disabled, true);
    assert.equal(
      workers[0].messages.some((m) => m.type === "input"),
      false,
      "never type before the shell starts",
    );
    await until(
      () =>
        $("terminal").textContent.includes("\nhello\n") &&
        $("status").textContent === "Shell ready",
      "first guided experiment",
    );
    assert.equal(
      workers[0].messages.filter((m) => m.type === "input").length,
      1,
      "one click sends only one command",
    );
    assert.equal($("complete").checked, false, "running is not mastery");
    for (const id of lessons.slice(1).map((l) => l.id)) {
      dom.window.location.hash = id;
      dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
      console.log("Guided lesson:", id);
      const lesson = lessons.find((l) => l.id === id);
      const start = $("terminal").textContent.length;
      assert.equal(
        $("run-experiment").disabled,
        false,
        id + ": ready for guided action",
      );
      $("run-experiment").click();
      assert.equal($("send").disabled, true);
      if (lesson.breakpoint) {
        await until(
          () => $("status").textContent === "Stopped at " + lesson.breakpoint,
          id + ": breakpoint",
        );
        assert.equal($("cpu-panel").open, true);
        assert.equal($("continue").disabled, false);
        assert.equal($("step").disabled, false);
        assert.equal(
          $("send").disabled,
          true,
          "commands cannot be sent into a paused guest",
        );
        if (id === "step") {
          const pc = $("pc").textContent;
          $("step").click();
          await until(
            () => $("status").textContent === "Stepped one instruction",
            "step",
          );
          assert.notEqual($("pc").textContent, pc);
        }
        $("continue").click();
      }
      await until(
        () =>
          $("terminal").textContent.length > start &&
          $("status").textContent === "Shell ready" &&
          !$("send").disabled,
        id + ": shell returns",
      );
      assert.equal(
        workers[0].messages.filter((m) => m.type === "input").at(-1).text,
        lesson.command + "\n",
      );
      const actual = $("terminal").textContent.slice(start);
      const checks = {
        identity: /user pid=\d+/,
        exec: /before exec pid=(\d+)[\s\S]*user pid=\1/,
        wait: /parent value=7 child status=23/,
        descriptors: /shared offset: A then B/,
        unlink: /open descriptor still reads: alive/,
        links: /alias reads: linked/,
        directories: /\$ /,
        heap: /heap grew=4096 bytes value=42/,
        pagetables: /user pid=\d+/,
        faults: /parent survived child fault, status=-1/,
        traps: /user pid=\d+/,
        scheduling: /parent turn 2[\s\S]*|child turn 2/,
        sleeping: /awake after timer wakeup/,
        blocking: /reader EOF=0/,
        locks: /user pid=\d+/,
        cache: /xv6 is/,
        blocks: /file size=14336 bytes/,
        transactions: /alias reads: linked/,
        capstone: /reader got 3 bytes: hey[\s\S]*reader EOF=0/,
      };
      if (checks[id])
        assert.match(actual, checks[id], id + ": actual guest result");
      if (id === "scheduling") {
        assert.match(actual, /parent turn 2/);
        assert.match(actual, /child turn 2/);
      }
      assert.equal($("complete").checked, false);
      if (id === "identity" || id === "pagetables" || id === "traps") {
        // A fresh controlled stop in lab allows a real process and user-page walk.
        $("breakpoint").value = "sys_getpid";
        $("arm").click();
        $("command").value = "lab pid";
        $("command-form").dispatchEvent(
          new dom.window.Event("submit", { cancelable: true }),
        );
        await until(
          () => $("status").textContent === "Stopped at sys_getpid",
          "inspector stop",
        );
        $("refresh-processes").click();
        await until(
          () => $("process-result").textContent.includes("lab"),
          "process memory",
        );
        assert.match($("process-result").textContent, /running/);
        assert.match(
          $("process-result").textContent,
          /000000000000000b/,
          "saved getpid syscall number",
        );
        assert.match($("source-location").textContent, /kernel\/sysproc.c/);
        $("page-form").dispatchEvent(
          new dom.window.Event("submit", { cancelable: true }),
        );
        await until(
          () => $("page-result").textContent.includes("Physical address"),
          "page walk",
        );
        assert.match($("page-result").textContent, /VR/);
        $("continue").click();
        await until(
          () =>
            $("status").textContent === "Shell ready" && !$("send").disabled,
          "inspector resume",
        );
      }
    }
    assert.match($("terminal").textContent, /1\s+1\s+6/);
    $("command").value = "cat note";
    $("command-form").dispatchEvent(
      new dom.window.Event("submit", { cancelable: true }),
    );
    await until(
      () => $("status").textContent === "Shell ready" && !$("send").disabled,
      "read created file",
    );
    assert.match($("terminal").textContent, /cat note\nhello\n/);
    // Revisiting a reading restores its own prediction without rebooting the machine.
    dom.window.location.hash = "boot";
    dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
    assert.equal($("prediction").value, "The shell reads the command");
    assert.equal(workers.length, 1);
  },
);
