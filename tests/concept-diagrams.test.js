import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { lessonIds } from "../site/workbench/lessons.js";
import {
  concepts,
  lessonConcepts,
  renderConcept,
  enhanceConcepts,
} from "../site/workbench/concept-diagrams.js";

test("course diagrams are available without JavaScript and belong to existing lessons", () => {
  const used = new Set();
  for (const [id, key] of Object.entries(lessonConcepts)) {
    assert.ok(lessonIds.includes(id), id);
    used.add(key);
    const html = renderConcept(id);
    const document = new JSDOM(html).window.document;
    const spec = concepts[key];
    assert.equal(document.querySelectorAll("figure").length, 1);
    assert.equal(
      document.querySelectorAll("[data-node]").length,
      spec.nodes.length,
    );
    assert.match(
      document.querySelector(".concept-source").textContent,
      /(?:kernel|user)\//,
    );
    const modelNote = document.querySelector(".concept-model-note").textContent;
    assert.match(modelNote, /example values/);
    assert.match(modelNote, /xv6 console shows your run/);
    const committed = readFileSync(
      new URL(`../site/lessons/${id}/index.html`, import.meta.url),
      "utf8",
    );
    assert.ok(
      committed.includes(html),
      `${id}: initial diagram is prerendered`,
    );
    if (spec.steps) {
      assert.ok(document.querySelector(".concept-controls").hidden);
      assert.equal(
        document.querySelectorAll(".concept-transcript li").length,
        spec.steps.length,
      );
      for (const state of spec.steps) {
        for (const node of [...state.active, ...Object.keys(state.changes)])
          assert.ok(
            spec.nodes.some((item) => item.key === node),
            `${key}: ${node}`,
          );
      }
    }
  }
  assert.deepEqual([...used].sort(), Object.keys(concepts).sort());
  assert.equal(renderConcept("unknown-lesson"), "");
});

function diagram(id) {
  const document = new JSDOM(
    `<textarea>my unfinished C draft</textarea><pre id="console">actual guest output</pre>${renderConcept(id)}`,
  ).window.document;
  enhanceConcepts(document);
  enhanceConcepts(document); // Navigation/rendering may enhance the same subtree again.
  return {
    document,
    next: () => document.querySelector("[data-concept-next]").click(),
    prev: () => document.querySelector("[data-concept-prev]").click(),
    value: (key) =>
      document.querySelector(`[data-node="${key}"] .concept-value`).textContent,
  };
}

test("all step diagrams support bounded forward/back navigation without changing source or guest output", () => {
  for (const [key, spec] of Object.entries(concepts).filter(
    ([, s]) => s.steps,
  )) {
    const id = Object.keys(lessonConcepts).find(
      (id) => lessonConcepts[id] === key,
    );
    const { document, next, prev } = diagram(id);
    assert.equal(document.querySelector(".concept-controls").hidden, false);
    assert.ok(document.querySelector("[data-concept-prev]").disabled);
    for (let index = 1; index < spec.steps.length; index++) {
      next();
      assert.equal(
        document.querySelector(".concept-position").textContent,
        `Step ${index + 1} of ${spec.steps.length}`,
      );
    }
    assert.ok(document.querySelector("[data-concept-next]").disabled);
    next();
    for (let index = spec.steps.length - 1; index > 0; index--) prev();
    assert.ok(document.querySelector("[data-concept-prev]").disabled);
    assert.equal(
      document.querySelector("textarea").value,
      "my unfinished C draft",
    );
    assert.equal(
      document.querySelector("#console").textContent,
      "actual guest output",
    );
  }
});

test("wakeup makes the sleeper runnable while the other process is still running", () => {
  const { next, prev, value } = diagram("wakeup-makes-a-process-runnable");
  next();
  assert.equal(value("a"), "SLEEPING");
  next();
  assert.equal(value("b"), "RUNNING");
  next();
  assert.equal(value("a"), "RUNNABLE");
  assert.equal(value("b"), "RUNNING");
  next();
  assert.equal(value("a"), "RUNNING");
  prev();
  assert.equal(value("a"), "RUNNABLE");
});

test("redo replay overwrites the home image idempotently, then clears the header", () => {
  const { next, prev, value } = diagram("redo-replay-is-idempotent");
  assert.equal(value("home"), "O");
  assert.equal(value("header"), "n = 1");
  next();
  assert.equal(value("home"), "R");
  assert.equal(value("header"), "n = 1");
  next();
  assert.equal(value("home"), "R");
  next();
  assert.equal(value("home"), "R");
  assert.equal(value("header"), "n = 0");
  prev();
  assert.equal(value("header"), "n = 1");
  prev();
  prev();
  assert.equal(value("home"), "O");
});
