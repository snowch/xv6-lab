import { renderConcept } from "../site/workbench/concept-diagrams.js";
import fs from "node:fs";
import { renderReminder, prerequisiteSection } from "./c-reminders.mjs";
import {
  lessons,
  lessonIds,
  lessonHref,
  chapters,
  plannedChapters,
} from "../site/workbench/lessons.js";
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const template = fs.readFileSync("tools/workbench-page.html", "utf8");
for (const [index, id] of lessonIds.entries()) {
  const lesson = lessons[id],
    chapter = chapters.find((chapter) => chapter.number === lesson.chapter),
    outline = chapter.lessonIds
      .map(
        (id, i) =>
          `<a href="${lessonHref(id)}" data-lesson="${id}"><span>${i + 1}.</span> ${escape(lessons[id].title)}</a>`,
      )
      .join("\n"),
    previous = lessonIds[index - 1],
    next = lessonIds[index + 1];
  const navigation =
    (previous
      ? `<a data-direction="previous" href="${lessonHref(previous)}"><small>${lessons[previous].chapter === lesson.chapter ? "← Previous lesson" : "← Previous chapter"}</small>${escape(lessons[previous].title)}</a>`
      : '<a href="./"><small>← All lessons</small>Course contents</a>') +
    (next
      ? `<a data-direction="next" href="${lessonHref(next)}"><small>${lessons[next].chapter === lesson.chapter ? "Next lesson →" : "Next chapter →"}</small>${escape(lessons[next].title)}</a>`
      : `<a data-direction="next" href="./"><small>End of Chapter ${chapter.number} →</small>Back to course contents</a>`);
  const values = {
    ...lesson,
    cReminder: renderReminder(id),
    conceptDiagram: renderConcept(id),
    id,
    number: chapter.lessonIds.indexOf(id) + 1,
    count: chapter.lessonIds.length,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    editorHeight: lesson.editorHeight || 330,
    prepared:
      lesson.mode === "kernel"
        ? `On the first visit, the editor opens with the part of ${lesson.file} you can change. The lab builds that code into xv6 and starts a supplied user program on a fresh machine.`
        : `On the first visit, the editor opens with the starter in ${lesson.file}. The lab builds the code in the editor and starts it on a fresh xv6 machine.`,
    starterEvidence: lesson.starterEvidence
      ? escape(lesson.starterEvidence)
      : `In the xv6 console, find <samp>${escape(lesson.expected.trimEnd())}</samp>.`,
    editableLabel:
      lesson.mode === "kernel"
        ? Array.isArray(lesson.build?.target)
          ? "Kernel functions"
          : "Function only"
        : "Editable C",
    outline,
    navigation,
  };
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    [
      "reading",
      "outline",
      "navigation",
      "cReminder",
      "conceptDiagram",
      "starterEvidence",
    ].includes(key)
      ? values[key]
      : escape(values[key]),
  );
  fs.mkdirSync("site/" + lessonHref(id), { recursive: true });
  fs.writeFileSync("site/" + lessonHref(id) + "index.html", html);
}
const sections = chapters
  .map((chapter) => {
    const entries = chapter.lessonIds
      .map(
        (id, i) =>
          `<li><a href="${lessonHref(id)}" data-lesson="${id}"><span class="lesson-number">${String(i + 1).padStart(2, "0")}</span><span><strong>${escape(lessons[id].title)}</strong><span>${escape(lessons[id].goal)}</span></span><span aria-hidden="true">→</span></a></li>`,
      )
      .join("\n");
    return `<section id="${chapter.id}" class="course-chapter" aria-labelledby="chapter-title-${chapter.number}"><details name="course-chapters"><summary><span class="chapter-number" aria-hidden="true">${String(chapter.number).padStart(2, "0")}</span><span class="chapter-heading"><h2 id="chapter-title-${chapter.number}">${escape(chapter.title)}</h2><span>${chapter.lessonIds.length} lessons</span></span><span class="chapter-toggle" aria-hidden="true">+</span></summary><div class="chapter-content"><p class="chapter-intro">${escape(chapter.intro)}</p><ol class="course-lessons">${entries}</ol></div></details></section>`;
  })
  .join("\n");
fs.writeFileSync(
  "site/index.html",
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#edf2f8"><meta name="description" content="Learn how xv6 works through source-led experiments. Edit C, build the code and run a fresh xv6 machine in your browser."><title>xv6 Lab — Learn through the source</title><link rel="stylesheet" href="workbench/style.css?v=learner-flow1"></head>
<body class="course-page"><a class="skip-link" href="#course-contents">Skip to the lessons</a>
<header class="app-header"><a class="brand" href="./"><span aria-hidden="true">x6_</span><strong>xv6 Lab<small>Learn through the source</small></strong></a><a class="course-link" href="explorer/">Kernel explorer ↗</a></header>
<main class="course-main"><section class="course-intro course-hero"><div class="hero-copy"><h1>Learn how xv6 works by changing its code</h1><p>xv6 is a small teaching operating system. In each lesson you run the supplied C code, make one edit and compare the results in your browser.</p><div class="course-actions"><a class="primary" href="${lessonHref(lessonIds[0])}">Start Chapter 1 →</a><a id="resume-lesson" hidden>Resume your last lesson →</a></div><p class="course-requirements">You need to be able to read short C programs. <a href="#c-prerequisites">C refresher links ↓</a></p></div><figure class="hero-visual"><img src="images/xv6-workshop.png" width="1448" height="1086" fetchpriority="high" alt="User programs connect to a kernel that manages processes, memory and files above the CPU, memory and disk."></figure></section>
${prerequisiteSection}
<section id="course-contents" class="course-contents" aria-labelledby="course-contents-title" tabindex="-1"><div class="contents-heading"><h2 id="course-contents-title">Course contents</h2></div>
${sections}
</section>
${plannedChapters.length ? `<section class="course-roadmap"><h2>Planned chapters</h2><ol start="${plannedChapters[0].number}">${plannedChapters.map((chapter) => `<li>${escape(chapter.title)}</li>`).join("")}</ol></section>` : ""}
<footer class="course-footer"><a href="https://snowch.github.io/computer-systems/">Companion book ↗</a><a href="https://github.com/snowch/xv6-lab">Source on GitHub ↗</a><a href="workbench/NOTICE.md">Runtime & licenses</a></footer></main><script type="module" src="workbench/course.js?v=learner-flow1"></script></body></html>\n`,
);
console.log(
  "Generated course contents and " + lessonIds.length + " lesson pages.",
);
