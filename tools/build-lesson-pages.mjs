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
    id,
    number: chapter.lessonIds.indexOf(id) + 1,
    count: chapter.lessonIds.length,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    editorHeight: lesson.editorHeight || 330,
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
    ["reading", "outline", "navigation", "cReminder"].includes(key)
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
    return `<section id="${chapter.id}" class="course-chapter" aria-labelledby="chapter-title-${chapter.number}"><details name="course-chapters"><summary><span class="chapter-number" aria-hidden="true">${String(chapter.number).padStart(2, "0")}</span><span class="chapter-heading"><h2 id="chapter-title-${chapter.number}">${escape(chapter.title)}</h2><span>${chapter.lessonIds.length} lessons · Available now</span></span><span class="chapter-toggle" aria-hidden="true">+</span></summary><div class="chapter-content"><p class="chapter-intro">${escape(chapter.intro)}</p><ol class="course-lessons">${entries}</ol></div></details></section>`;
  })
  .join("\n");
fs.writeFileSync(
  "site/index.html",
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#edf2f8"><meta name="description" content="Learn how xv6 works through small source-led lessons. Read real code, make a change, compile RISC-V, and run it in your browser."><title>xv6 Lab — Learn through the source</title><link rel="stylesheet" href="workbench/style.css?v=chapter12"></head>
<body class="course-page"><a class="skip-link" href="#course-contents">Skip to the lessons</a>
<header class="app-header"><a class="brand" href="./"><span aria-hidden="true">x6_</span><strong>xv6 Lab<small>Learn through the source</small></strong></a><a class="course-link" href="explorer/">Kernel explorer ↗</a></header>
<main class="course-main"><section class="course-intro course-hero"><div class="hero-copy"><p class="preview-label">A small operating system. One idea at a time.</p><h1>Understand an OS<br>by changing its code.</h1><p>Read real xv6 source. Change one small thing. Compile it and run the result in your browser.</p><div class="course-actions"><a class="primary" href="${lessonHref(lessonIds[0])}">Start Chapter 1 →</a><a id="resume-lesson" hidden>Resume your last lesson →</a></div><p class="course-requirements">Basic C reading is a prerequisite. <a href="#c-prerequisites">C skills and focused refreshers ↓</a></p></div><figure class="hero-visual"><img src="images/xv6-workshop.png" width="1448" height="1086" fetchpriority="high" alt="Conceptual cutaway: user programs connect to a kernel that manages processes, memory and files above the CPU, RAM and disk."><figcaption>User programs. Kernel services. The hardware beneath them.</figcaption></figure></section>
${prerequisiteSection}
<section id="course-contents" class="course-contents" aria-labelledby="course-contents-title" tabindex="-1"><div class="contents-heading"><h2 id="course-contents-title">Choose a chapter</h2><p>${lessonIds.length} available lessons. Open a chapter to explore one idea at a time.</p></div>
${sections}
</section>
${plannedChapters.length ? `<section class="course-roadmap"><h2>Where the course goes next</h2><p>These chapters are planned. The chapters above are available now.</p><ol start="${plannedChapters[0].number}">${plannedChapters.map((chapter) => `<li>${escape(chapter.title)}</li>`).join("")}</ol></section>` : `<section class="course-roadmap"><h2>Keep exploring</h2><p>All ${chapters.length} chapters are available. Revisit any lesson, make another change, or use the <a href="explorer/">kernel explorer</a> for deeper experiments with the running kernel.</p></section>`}
<footer class="course-footer"><a href="https://snowch.github.io/computer-systems/">Companion book ↗</a><a href="https://github.com/snowch/xv6-lab">Source on GitHub ↗</a><a href="workbench/NOTICE.md">Runtime & licenses</a></footer></main><script type="module" src="workbench/course.js?v=chapter12"></script></body></html>\n`,
);
console.log(
  "Generated course contents and " + lessonIds.length + " lesson pages.",
);
