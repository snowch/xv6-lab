import { lessons as legacyLessons } from "../lessons.js";
import { lessons, lessonHref } from "./lessons.js?v=chapter10";
function legacyLink() {
  const id = location.hash.slice(1);
  if (legacyLessons.some((lesson) => lesson.id === id)) {
    const url = new URL("../explorer/", import.meta.url);
    url.search = location.search;
    url.hash = location.hash;
    location.replace(url);
  }
}
legacyLink();
window.addEventListener("hashchange", legacyLink);
function openLinkedChapter() {
  const section = document.getElementById(location.hash.slice(1));
  if (section?.classList.contains("course-chapter"))
    section.querySelector("details").open = true;
}
openLinkedChapter();
window.addEventListener("hashchange", openLinkedChapter);
try {
  const last = localStorage.getItem("xv6-last-lesson");
  if (Object.hasOwn(lessons, last)) {
    const link = document.getElementById("resume-lesson");
    link.href = lessonHref(last);
    link.hidden = false;
    link.textContent = "Resume: " + lessons[last].title + " →";
  }
} catch {
  /* Reading and all navigation work without storage. */
}
