import { compileObject, prepareSource } from "./compiler.js";
import { linkEditedObject } from "./elf.js?v=kernel3";
import {
  replaceGuestFile,
  prepareRecoveryImage,
} from "./filesystem.js?v=journal1";
const instructionBridges = {
  __sync_synchronize: ["void wb_fence(void);", "wb_fence"],
  __sync_lock_test_and_set: [
    "uint wb_test_and_set(volatile uint*, uint);",
    "wb_test_and_set",
  ],
  __sync_lock_release: [
    "void wb_lock_release(volatile uint*);",
    "wb_lock_release",
  ],
  ...Object.fromEntries(
    ["satp", "sstatus", "scause", "sepc", "stvec", "sie", "stval"].map(
      (name) => [
        "r_" + name,
        ["uint64 wb_r_" + name + "(void);", "wb_r_" + name],
      ],
    ),
  ),
  intr_on: ["void wb_intr_on(void);", "wb_intr_on"],
  intr_off: ["void wb_intr_off(void);", "wb_intr_off"],
  intr_get: ["int wb_intr_get(void);", "wb_intr_get"],
};
export function kernelPrelude(files, context) {
  const base =
    [
      "kernel/types.h",
      "kernel/param.h",
      "kernel/spinlock.h",
      "kernel/proc.h",
      ...(context?.headers || []),
    ]
      .map((p) => files[p])
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .replace(
        "struct context {",
        "typedef uint64 *pagetable_t;\nstruct context {",
      ) + "\nstruct proc *myproc(void);\nvoid printf(char*,...);\n";
  if (!context) return base;
  // Keep private native layouts tied to the exact matching source.
  const sourceTypes = (context.typeSources || [])
    .map((spec) => {
      const source = files[spec.file];
      const first = source.indexOf(spec.start),
        last = source.indexOf(spec.end, first);
      if (first < 0 || last < first)
        throw new Error("Missing native type block: " + spec.file);
      return source
        .slice(first, last + spec.end.length)
        .replace(/^(struct\s+\w+\s+\w+;)$/gm, "extern $1")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
    })
    .join("\n");
  const declarations = (context.functions || [])
    .map((name) => {
      const declaration = files["kernel/defs.h"]
        .split("\n")
        .find((line) => new RegExp("\\b" + name + "\\s*\\(").test(line));
      if (!declaration) throw new Error("Missing native declaration: " + name);
      return declaration;
    })
    .join("\n");
  const bridges = (context.bridges || [])
    .map((name) => {
      const entry = instructionBridges[name];
      if (!entry) throw new Error("Unknown instruction bridge: " + name);
      return entry[0] + "\n#define " + name + " " + entry[1];
    })
    .join("\n");
  const definitions = new Map(
    files["kernel/riscv.h"]
      .split("\n")
      .filter((line) => /^#define\b/.test(line))
      .map((line) => [line.match(/^#define\s+(\w+)/)[1], line]),
  );
  const selected = new Set(context.constants || []);
  for (const name of selected) {
    const definition = definitions.get(name);
    if (!definition) throw new Error("Missing RISC-V constant: " + name);
    for (const word of definition.match(/\b[A-Za-z_]\w*\b/g) || [])
      if (definitions.has(word)) selected.add(word);
  }
  const macros = [...selected]
    .map((name) => definitions.get(name).replace(/\/\/.*$/, ""))
    .join("\n");
  return (
    base +
    sourceTypes +
    "\ntypedef uint64 pte_t;\n" +
    macros +
    "\n" +
    declarations +
    "\n" +
    (context.globals || "") +
    "\n" +
    bridges +
    "\n"
  );
}
export async function buildExercise(kind, source, assets, context) {
  if (!["user", "kernel"].includes(kind)) throw new Error("Unknown exercise.");
  const input =
    kind === "user"
      ? prepareSource(source, assets.files, "user/workbench.c")
      : kernelPrelude(assets.files, context) +
        "\n#line " +
        (context?.offset || 20) +
        ' "' +
        (context?.file || "kernel/sysproc.c") +
        '"\n' +
        source;
  const object = await compileObject(
    assets.compiler,
    input,
    kind === "user" ? "user/workbench.c" : context?.file || "kernel/sysproc.c",
  );
  const linked = linkEditedObject(
    kind === "user" ? assets.user : assets.kernel,
    object.bytes,
    kind === "user" ? "main" : context?.target || "sys_getpid",
  );
  let disk =
    kind === "user"
      ? replaceGuestFile(assets.disk, "workbench", linked.bytes)
      : new Uint8Array(assets.disk);
  if (kind === "kernel" && context?.probe) {
    const probe = await compileObject(
      assets.compiler,
      prepareSource(context.probe, assets.files, "user/workbench.c"),
      "user/workbench.c",
    );
    disk = replaceGuestFile(
      disk,
      "workbench",
      linkEditedObject(assets.user, probe.bytes, "main").bytes,
    );
  }
  if (context?.fixture === "committed-redo") disk = prepareRecoveryImage(disk);
  return {
    kernel: kind === "kernel" ? linked.bytes : new Uint8Array(assets.kernel),
    disk,
    object: object.bytes,
    elf: linked.bytes,
    used: linked.used,
    capacity: linked.capacity,
  };
}
