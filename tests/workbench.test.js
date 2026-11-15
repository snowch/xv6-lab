import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildExercise } from "../site/workbench/build.js";
import { readElf } from "../site/workbench/elf.js";
import { lessons, sourceExcerpt } from "../site/workbench/lessons.js";
import init, { WasmRiscv } from "../site/vendor/riscv_emu_rust_wasm.js";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url));
const assets = {
  compiler: read("site/workbench/compiler/tcc.wasm"),
  kernel: read("site/images/kernel"),
  disk: read("site/images/fs.img"),
  user: read("site/workbench/assets/user-base.elf"),
  files: JSON.parse(read("site/source.json")).files,
};
async function run(images, observePid = true) {
  await init(read("site/vendor/riscv_emu_rust_wasm_bg.wasm"));
  const vm = WasmRiscv.new();
  vm.setup_program(new Uint8Array(images.kernel));
  vm.setup_filesystem(new Uint8Array(images.disk));
  let output = "";
  const tick = () => {
    vm.run_cycles(100000);
    let c;
    while ((c = vm.get_output())) output += String.fromCharCode(c);
  };
  for (let i = 0; i < 1500 && !output.endsWith("$ "); i++) tick();
  assert.match(output, /init: starting sh/);
  const error = new Uint8Array(1),
    address = vm.get_address_of_symbol("sys_getpid", error);
  assert.equal(error[0], 0);
  for (const char of "workbench\n") vm.put_input(char.charCodeAt(0));
  if (!observePid) {
    const start = output.length;
    for (
      let i = 0;
      i < 1500 &&
      (!output.slice(start).includes("workbench\n") || !output.endsWith("$ "));
      i++
    )
      tick();
    assert.ok(output.endsWith("$ "), output);
    vm.free();
    return { output };
  }
  let hit = false;
  for (let i = 0; i < 1000 && !hit; i++) {
    hit = vm.run_until_breakpoints(new BigUint64Array([address]), 100000);
    let c;
    while ((c = vm.get_output())) output += String.fromCharCode(c);
  }
  assert.equal(hit, true);
  const sources = JSON.parse(read("site/source.json")),
    layout = JSON.parse(read("site/layout.json")),
    base = BigInt(sources.symbols.proc);
  let actualPID;
  for (let i = 0; i < layout.count; i++) {
    const at = base + BigInt(i * layout.size),
      state =
        vm.load_doubleword(at + BigInt(layout.state), error) & 0xffffffffn;
    if (state === 3n) {
      actualPID = Number(
        vm.load_doubleword(at + BigInt(layout.pid), error) & 0xffffffffn,
      );
      break;
    }
  }
  assert.ok(actualPID > 0);
  const before = output.length;
  for (
    let i = 0;
    i < 1500 &&
    (!output.slice(before).includes("reported pid=") || !output.endsWith("$ "));
    i++
  )
    tick();
  assert.ok(output.endsWith("$ "), output);
  vm.free();
  return { output, actualPID };
}

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
    for (const [id, lesson] of Object.entries(lessons)) {
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
