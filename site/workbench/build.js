import { compileObject, prepareSource } from "./compiler.js";
import { linkEditedObject } from "./elf.js";
import { replaceGuestFile } from "./filesystem.js";
export function kernelPrelude(files) {
  return (
    ["kernel/types.h", "kernel/param.h", "kernel/spinlock.h", "kernel/proc.h"]
      .map((p) => files[p])
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .replace(
        "struct context {",
        "typedef uint64 *pagetable_t;\nstruct context {",
      ) + "\nstruct proc *myproc(void);\nvoid printf(char*,...);\n"
  );
}
export async function buildExercise(kind, source, assets) {
  if (!["user", "kernel"].includes(kind)) throw new Error("Unknown exercise.");
  const input =
    kind === "user"
      ? prepareSource(source, assets.files, "user/workbench.c")
      : kernelPrelude(assets.files) +
        '\n#line 20 "kernel/sysproc.c"\n' +
        source;
  const object = await compileObject(
    assets.compiler,
    input,
    kind === "user" ? "user/workbench.c" : "kernel/sysproc.c",
  );
  const linked = linkEditedObject(
    kind === "user" ? assets.user : assets.kernel,
    object.bytes,
    kind === "user" ? "main" : "sys_getpid",
  );
  return {
    kernel: kind === "kernel" ? linked.bytes : new Uint8Array(assets.kernel),
    disk:
      kind === "user"
        ? replaceGuestFile(assets.disk, "workbench", linked.bytes)
        : new Uint8Array(assets.disk),
    object: object.bytes,
    elf: linked.bytes,
    used: linked.used,
    capacity: linked.capacity,
  };
}
