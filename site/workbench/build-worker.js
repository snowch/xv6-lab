import { buildExercise } from "./build.js";
async function bytes(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok)
    throw new Error(
      "Cannot load build asset " +
        path +
        " (HTTP " +
        response.status +
        "). Reload and try again.",
    );
  return new Uint8Array(await response.arrayBuffer());
}
onmessage = async ({ data }) => {
  try {
    postMessage({ type: "progress", phase: "loading" });
    const [compiler, kernel, disk, user, source] = await Promise.all([
      bytes("./compiler/tcc.wasm"),
      bytes("../images/kernel?v=source-workbench1"),
      bytes("../images/fs.img?v=source-workbench1"),
      bytes("./assets/user-base.elf?v=source-workbench1"),
      bytes("../source.json?v=source-workbench1"),
    ]);
    const files = JSON.parse(new TextDecoder().decode(source)).files;
    postMessage({ type: "progress", phase: "compile" });
    const result = await buildExercise(data.kind, data.source, {
      compiler,
      kernel,
      disk,
      user,
      files,
    });
    postMessage(
      { type: "built", ...result },
      [
        result.kernel.buffer,
        result.disk.buffer,
        result.object.buffer,
        result.elf.buffer,
      ].filter((b, i, a) => a.indexOf(b) === i),
    );
  } catch (error) {
    postMessage({ type: "error", message: error.message });
  }
};
