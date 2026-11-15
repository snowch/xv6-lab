import test from "node:test";
import assert from "node:assert/strict";
import { assets, run } from "./guest.js";
import { buildExercise } from "../site/workbench/build.js";
import { chapters, lessons, sourceExcerpt } from "../site/workbench/lessons.js";
import { edits } from "./lesson-edits.js";
for (const chapter of chapters.filter((chapter) => chapter.number >= 3)) {
  test(
    `Chapter ${chapter.number}: every starter runs on actual xv6`,
    { timeout: 180000 },
    async () => {
      for (const id of chapter.lessonIds) {
        const lesson = lessons[id];
        assert.ok(sourceExcerpt(assets.files, lesson).text.trim());
        const built = await buildExercise(
            lesson.mode,
            lesson.starter(assets.files),
            assets,
          ),
          result = await run(built, lesson.observePid);
        assert.ok(
          result.output.includes(lesson.expected),
          id + ": " + result.output,
        );
        if (lesson.expectedFault) {
          assert.match(result.output, /usertrap\(\)/);
          assert.ok(!result.output.includes("child read="));
        }
      }
    },
  );
  test(
    `Chapter ${chapter.number}: taught edits change real outcomes`,
    { timeout: 180000 },
    async () => {
      for (const id of chapter.lessonIds) {
        const lesson = lessons[id],
          change = edits[id];
        assert.ok(change, id + ": taught edit exists");
        const source = change.edit(lesson.starter(assets.files));
        assert.notEqual(source, lesson.starter(assets.files));
        const built = await buildExercise(lesson.mode, source, assets),
          result = await run(built, lesson.observePid);
        assert.ok(
          result.output.includes(change.expected),
          id + ": " + result.output,
        );
        if (lesson.expectedFault)
          assert.ok(!result.output.includes("usertrap()"));
      }
    },
  );
}
