// Copyright © 2026 Christopher Snow. Common chrome; source and explorer adapters retain their own machines.
import { materialSymbol as icon } from "./material-symbols.mjs";
import {
  lessons,
  lessonIds,
  chapters,
  lessonHref,
} from "./workbench/lessons.js?v=learner-flow1";
import { lessons as experiments } from "./lessons.js";
import "./runner-controls.mjs";
const $ = (id) => document.getElementById(id),
  esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const root = new URL(
  document.querySelector('meta[name="gpu-base"]')?.content ||
    new URL("./", import.meta.url),
  location.href,
);
let theme;
try {
  theme = localStorage.getItem("xv6-lab:theme");
} catch {}
function setTheme(value) {
  document.documentElement.dataset.theme = value;
  $("theme").textContent = value === "dark" ? "Light theme" : "Dark theme";
}
setTheme(
  ["light", "dark"].includes(theme)
    ? theme
    : window.matchMedia?.("(prefers-color-scheme:dark)")?.matches
      ? "dark"
      : "light",
);
$("theme").onclick = () => {
  const value =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(value);
  try {
    localStorage.setItem("xv6-lab:theme", value);
  } catch {}
};
const main = document.querySelector("main"),
  explorer = document.body.classList.contains("guided-workbook"),
  id = document.body.dataset.lesson;
const row = document.createElement("div");
row.className = "course-location-row";
row.innerHTML =
  '<button type="button" id="course-toggle" aria-expanded="false" aria-controls="course-panel">Course lessons ' +
  icon("expand_more") +
  '</button><span id="course-progress"></span><nav id="course-breadcrumbs" aria-label="Breadcrumb"></nav>';
const panel = document.createElement("div");
panel.id = "course-panel";
panel.hidden = true;
panel.innerHTML =
  '<div class="course-tools"><a href="' +
  root.href +
  '">Course overview</a><a href="' +
  new URL("explorer/", root).href +
  '">Kernel explorer</a><a id="jump-machine" href="#machine" ' +
  (!explorer ? "hidden" : "") +
  ">Jump to live machine</a></div>";
if (explorer) {
  const sidebar = document.querySelector(".sidebar");
  panel.append(sidebar);
  row.querySelector("#course-breadcrumbs").innerHTML =
    '<a href="' +
    root.href +
    '">Kernel explorer</a><span aria-hidden="true">/</span><a id="current-topic" href="#lesson">Current experiment</a>';
} else {
  const grid = document.createElement("div");
  grid.className = "course-outline-grid";
  grid.innerHTML = chapters
    .map(
      (c) =>
        "<section><h2>" +
        esc(c.title) +
        "</h2><ol>" +
        c.lessonIds
          .map(
            (item) =>
              '<li><a href="' +
              new URL(lessonHref(item), root).href +
              '" ' +
              (item === id ? 'aria-current="page"' : "") +
              ">" +
              esc(lessons[item].title) +
              '</a><span role="img" aria-label="Completed" data-completion="' +
              item +
              '" hidden>' +
              icon("check") +
              "</span></li>",
          )
          .join("") +
        "</ol></section>",
    )
    .join("");
  panel.append(grid);
  if (id) {
    const chapter = chapters.find((c) => c.lessonIds.includes(id));
    row.querySelector("nav").innerHTML =
      '<a href="' +
      new URL("#" + chapter.id, root).href +
      '">' +
      esc(chapter.title) +
      '</a><span aria-hidden="true">/</span><span aria-current="page">' +
      esc(lessons[id].title) +
      "</span>";
  }
}
const navigation = document.createElement("nav");
navigation.className = "course-navigation";
navigation.setAttribute("aria-label", "Course navigation");
navigation.append(row, panel);
main.prepend(navigation);
function close() {
  panel.hidden = true;
  $("course-toggle").setAttribute("aria-expanded", "false");
}
$("course-toggle").onclick = () => {
  panel.hidden = !panel.hidden;
  $("course-toggle").setAttribute("aria-expanded", String(!panel.hidden));
  if (explorer) $("course-menu").open = true;
};
navigation.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    $("course-toggle").focus();
  }
});
panel.addEventListener("click", (event) => {
  if (event.target.closest("a")) close();
});
const transientMarks = new Map();
function progress() {
  let done = 0;
  for (const lesson of lessonIds) {
    let marked = false;
    try {
      marked = localStorage.getItem("xv6-source-complete:" + lesson) === "1";
    } catch {}
    if (transientMarks.has(lesson)) marked = transientMarks.get(lesson);
    if (marked) done++;
    for (const n of panel.querySelectorAll(
      '[data-completion="' + lesson + '"]',
    ))
      n.hidden = !marked;
  }
  $("course-progress").textContent = explorer
    ? "25 explorer experiments"
    : done + " / " + lessonIds.length + " complete";
}
progress();
window.addEventListener("storage", (event) => {
  if (event.key?.startsWith("xv6-source-complete:"))
    transientMarks.delete(event.key.slice("xv6-source-complete:".length));
  if (event.key === null) transientMarks.clear();
  if (!explorer) progress();
});
if (id) {
  const ending = document.querySelector(".lesson-ending"),
    nav = ending.querySelector(".lesson-navigation");
  const refs = document.createElement("details");
  refs.className = "resource-row";
  refs.innerHTML =
    "<summary>" +
    icon("menu_book") +
    "<span><strong>References</strong><span>" +
    esc(lessons[id].file + " · " + lessons[id].contextTitle) +
    "</span></span>" +
    icon("chevron_right", "resource-chevron") +
    "</summary><div><p>The matching source excerpts above and Read related source work offline.</p><ul>" +
    lessons[id].contextFiles
      .map(
        (file) =>
          '<li><a href="https://github.com/snowch/xv6-lab/blob/main/guest/' +
          encodeURI(file) +
          '" target="_blank" rel="noreferrer">' +
          esc(file) +
          "</a></li>",
      )
      .join("") +
    '</ul><p>Source links and the <a href="https://snowch.github.io/computer-systems/">companion book</a> need a connection.</p></div>';
  nav.before(refs);
  const completion = document.createElement("section");
  completion.className = "lesson-completion";
  completion.innerHTML =
    '<label><input type="checkbox" id="lesson-complete"> Mark lesson complete</label><p id="completion-status">Saved in this browser when storage is available.</p>';
  nav.before(completion);
  try {
    $("lesson-complete").checked =
      localStorage.getItem("xv6-source-complete:" + id) === "1";
  } catch {}
  $("lesson-complete").onchange = () => {
    transientMarks.set(id, $("lesson-complete").checked);
    try {
      localStorage.setItem(
        "xv6-source-complete:" + id,
        $("lesson-complete").checked ? "1" : "0",
      );
    } catch {
      $("completion-status").textContent =
        "This mark is kept on this page only. Browser storage is unavailable.";
    }
    progress();
  };
}
if (!id && !explorer) {
  window.labWorkbench = {
    isBusy: () =>
      window.xv6Runner?.status().busy ||
      window.xv6Runner?.status().phase === "Starting",
    saveReading: async () => ({}),
    restoreReading: async () => {},
  };
  window.dispatchEvent(new window.Event("lab-workbench-ready"));
}
