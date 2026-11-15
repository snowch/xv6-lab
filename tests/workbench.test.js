import test from "node:test";
import assert from "node:assert/strict";
import { buildExercise } from "../site/workbench/build.js";
import { readElf } from "../site/workbench/elf.js";
import { lessons, sourceExcerpt, chapters } from "../site/workbench/lessons.js";
import { assets, run } from "./guest.js";

test(
  "browser compiler builds an edited user program that really runs on xv6",
  { timeout: 120000 },
  async () => {
    const source = assets.files["user/workbench.c"].replace(
      "Hello from my xv6 program!",
      "EDITED IN THE BROWSER http://xv6.test/ /* keep this string */",
    );
    const built = await buildExercise("user", source, assets);
    assert.equal(readElf(built.elf).view.getUint16(18, true), 243);
    const result = await run(built);
    assert.match(result.output, /EDITED IN THE BROWSER/);
    assert.ok(
      result.output.includes("http://xv6.test/ /* keep this string */"),
    );
    assert.match(result.output, new RegExp("reported pid=" + result.actualPID));
  },
);
test(
  "edited kernel return value changes while its process PID remains real",
  { timeout: 120000 },
  async () => {
    const source =
      "uint64\nsys_getpid(void)\n{\n  return myproc()->pid + 1000;\n}\n";
    const built = await buildExercise("kernel", source, assets),
      result = await run(built);
    assert.match(
      result.output,
      new RegExp("reported pid=" + (result.actualPID + 1000)),
    );
    assert.notDeepEqual(built.kernel, assets.kernel);
  },
);
test(
  "kernel compiled globals are linked into writable memory",
  { timeout: 120000 },
  async () => {
    const built = await buildExercise(
        "kernel",
        "static int calls;\nuint64 sys_getpid(void) { calls++; return myproc()->pid + calls; }",
        assets,
      ),
      result = await run(built);
    assert.match(
      result.output,
      new RegExp("reported pid=" + (result.actualPID + 1)),
    );
  },
);
test(
  "a kernel lesson can supply a real compiled user test program",
  { timeout: 120000 },
  async () => {
    const built = await buildExercise(
      "kernel",
      "uint64 sys_getpid(void) { return myproc()->pid + 10; }",
      assets,
      {
        target: "sys_getpid",
        probe:
          '#include "kernel/types.h"\n#include "user/user.h"\nint main(void) { int first = getpid(); int second = getpid(); printf("probe agrees=%d\\n", first == second); exit(0); }',
      },
    );
    const result = await run(built, false);
    assert.match(result.output, /probe agrees=1/);
    assert.ok(!result.output.includes("Hello from my xv6 program"));
  },
);
test("compile and link failures report the edited source rather than producing fake success", async () => {
  await assert.rejects(
    () =>
      buildExercise(
        "user",
        assets.files["user/workbench.c"].replace(
          "exit(0);",
          "this is invalid;",
        ),
        assets,
      ),
    /user\/workbench\.c:\d+: error/,
  );
  await assert.rejects(
    () => buildExercise("user", '#include "stdio.h"\nint main(void){}', assets),
    /unsupported header/,
  );
  await assert.rejects(
    () =>
      buildExercise(
        "user",
        "int main(void) { unknown_function(); return 0; }",
        assets,
      ),
    /Undefined symbol: unknown_function/,
  );
  await assert.rejects(
    () =>
      buildExercise("kernel", "uint64 other_name(void) {return 0;}", assets),
    /must define sys_getpid/,
  );
});

test(
  "every Chapter 1 starter and its taught edits execute on the real guest",
  { timeout: 120000 },
  async () => {
    for (const id of chapters[0].lessonIds) {
      const lesson = lessons[id];
      const excerpt = sourceExcerpt(assets.files, lesson);
      assert.ok(excerpt.text.trim(), id + ": matching source");
      let source = lesson.starter(assets.files);
      if (id === "writing-bytes")
        source = source.replace('"hello\\n", 6', '"hello\\n", 3');
      if (id === "entering-the-kernel")
        source = source.replace(
          "  exit(0);",
          '  printf("reported pid=%d\\n", getpid());\n  exit(0);',
        );
      if (id === "the-current-process")
        source = source.replace(
          "  return",
          '  printf("kernel sees pid=%d\\n", myproc()->pid);\n  return',
        );
      const built = await buildExercise(lesson.mode, source, assets),
        result = await run(built, lesson.observePid);
      if (id === "writing-bytes")
        assert.match(result.output, /workbench\nhel\$ /);
      else
        assert.ok(
          result.output.includes(lesson.expected),
          id + ": expected actual output",
        );
      if (id === "entering-the-kernel")
        assert.equal((result.output.match(/reported pid=/g) || []).length, 2);
      if (id === "the-current-process")
        assert.ok(
          result.output.includes("kernel sees pid=" + result.actualPID),
        );
    }
  },
);

test(
  "Chapter 2 starters execute real fork, wait, memory-copy and exec behaviour",
  { timeout: 120000 },
  async () => {
    for (const id of chapters[1].lessonIds) {
      const lesson = lessons[id];
      const snippet = sourceExcerpt(assets.files, lesson);
      assert.ok(snippet.text.length > 10);
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
      if (id === "fork-creates-a-child") {
        const parent = result.output.match(
          /parent: fork returned (\d+); collected (\d+)/,
        );
        assert.ok(parent, result.output);
        assert.ok(Number(parent[1]) > 0);
        assert.equal(parent[1], parent[2]);
      }
      if (id === "waiting-for-a-child")
        assert.ok(
          result.output.indexOf("child: finishing") <
            result.output.indexOf("parent: collected"),
        );
      if (id === "fork-copies-memory")
        assert.ok(result.output.includes("child value=99"));
      if (id === "exec-replaces-the-program") {
        assert.equal(result.actualPID, result.exitPID);
        assert.ok(!result.output.includes("exec returned to the old program"));
      }
      if (id === "when-exec-fails") {
        assert.equal(result.actualPID, result.exitPID);
        assert.ok(
          result.output.includes(
            `caller pid before=${result.actualPID} after=${result.actualPID}`,
          ),
        );
      }
    }
  },
);

test(
  "Chapter 2 taught edits change outcomes without manufacturing guest output",
  { timeout: 120000 },
  async () => {
    const cases = [
      [
        "fork-creates-a-child",
        (s) => s.replace("child: fork returned", "child edit: fork returned"),
        /child edit: fork returned 0/,
      ],
      [
        "waiting-for-a-child",
        (s) =>
          s.replace(
            "  exit(0);\n}",
            '  printf("second wait=%d\\n", wait(0));\n  exit(0);\n}',
          ),
        /second wait=-1/,
      ],
      [
        "a-childs-exit-status",
        (s) => s.replace("exit(7)", "exit(23)"),
        /exited with status 23/,
      ],
      [
        "fork-copies-memory",
        (s) => s.replace("value = 99", "value = 123"),
        /child value=123[\s\S]*parent value=7/,
      ],
      [
        "exec-replaces-the-program",
        (s) => s.replace("The new program is echo", "EDITED EXEC ARGUMENT"),
        /EDITED EXEC ARGUMENT/,
      ],
      [
        "when-exec-fails",
        (s) => s.replace('exec("missing", args)', 'exec("echo", args)'),
        /The replacement ran/,
      ],
    ];
    for (const [id, edit, expected] of cases) {
      const lesson = lessons[id],
        source = edit(lesson.starter(assets.files));
      assert.notEqual(source, lesson.starter(assets.files), id);
      const built = await buildExercise(lesson.mode, source, assets),
        result = await run(built, lesson.observePid);
      assert.match(result.output, expected);
      if (id === "when-exec-fails") {
        assert.ok(!result.output.includes("exec result="));
        assert.ok(!result.output.includes("caller pid before="));
        assert.equal(result.actualPID, result.exitPID);
      }
    }
  },
);

test("source excerpts stay inside the selected kernel function", () => {
  assert.throws(
    () =>
      sourceExcerpt(assets.files, {
        excerpt: {
          file: "kernel/proc.c",
          within: "fork(void)",
          anchor: "p->xstate = status;",
        },
      }),
    /Matching source excerpt was not found/,
  );
});
