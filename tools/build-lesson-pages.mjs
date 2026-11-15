import fs from "node:fs";
import {
  lessons,
  lessonIds,
  lessonHref,
  chapters,
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
    id,
    number: chapter.lessonIds.indexOf(id) + 1,
    count: chapter.lessonIds.length,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    editorHeight: lesson.editorHeight || 330,
    editableLabel: lesson.mode === "kernel" ? "Function only" : "Editable C",
    outline,
    navigation,
  };
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    ["reading", "outline", "navigation"].includes(key)
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
    return `<section id="${chapter.id}" class="course-chapter" aria-labelledby="chapter-title-${chapter.number}"><p class="preview-label">Available now · ${chapter.lessonIds.length} short lessons</p><h2 id="chapter-title-${chapter.number}">${chapter.number}. ${escape(chapter.title)}</h2><p class="chapter-intro">${escape(chapter.intro)}</p><ol class="course-lessons">${entries}</ol></section>`;
  })
  .join("\n");
fs.writeFileSync(
  "site/index.html",
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#edf2f8"><meta name="description" content="Learn how xv6 works through small source-led lessons. Read real code, make a change, compile RISC-V, and run it in your browser."><title>xv6 Lab — Learn through the source</title><link rel="stylesheet" href="workbench/style.css?v=chapter2"></head>
<body class="course-page"><a class="skip-link" href="#chapter-one">Skip to the lessons</a>
<header class="app-header"><a class="brand" href="./"><span aria-hidden="true">x6_</span><strong>xv6 Lab<small>Learn through the source</small></strong></a><a class="course-link" href="explorer/">Kernel explorer ↗</a></header>
<main class="course-main"><section class="course-intro"><p class="preview-label">A small operating system. One idea at a time.</p><h1>Understand an OS<br>by changing its code.</h1><p>Read a little xv6 source, make one small change, and run the result on a real kernel. Each lesson introduces one concept and builds on the last.</p><div class="course-actions"><a class="primary" href="${lessonHref(lessonIds[0])}">Start Chapter 1 →</a><a id="resume-lesson" hidden>Resume your last lesson →</a></div><p class="course-requirements">Some basic C is helpful. No installation needed: the compiler and RISC-V machine run in your browser.</p></section>
${sections}
<section class="course-roadmap"><h2>Where the course goes next</h2><p>These chapters are planned. Chapters 1 and 2 are available above. The existing 25 kernel experiments also remain available in the <a href="explorer/">kernel explorer</a>.</p><ol start="3"><li>Memory — address spaces and page tables</li><li>Files — descriptors and persistent data</li><li>Pipes — connecting processes</li><li>Scheduling — taking turns and waiting</li></ol></section>
<footer class="course-footer"><a href="https://snowch.github.io/computer-systems/">Companion book ↗</a><a href="https://github.com/snowch/xv6-lab">Source on GitHub ↗</a><a href="workbench/NOTICE.md">Runtime & licenses</a></footer></main><script type="module" src="workbench/course.js?v=chapter2"></script></body></html>\n`,
);
console.log(
  "Generated course contents and " + lessonIds.length + " lesson pages.",
);
