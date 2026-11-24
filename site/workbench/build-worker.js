import { toolModules } from "../tool-cache.mjs";
import { buildExercise } from "./build.js?v=journal1";
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
  let phase = "loading";
  try {
    postMessage({ type: "progress", phase: "loading" });
    const assets = data.assets;
    const modules = await toolModules(assets?.cacheKey);
    const [compiler, kernel, disk, user, source] = assets
      ? [
          modules?.compiler || assets.compiler,
          assets.kernel,
          assets.disk,
          assets.user,
          new TextEncoder().encode(assets.source),
        ]
      : await Promise.all([
          bytes("./compiler/tcc.wasm"),
          bytes("../images/kernel?v=guest4"),
          bytes("../images/fs.img?v=guest4"),
          bytes("./assets/user-base.elf?v=guest4"),
          bytes("../source.json?v=guest4"),
        ]);
    const files = JSON.parse(new TextDecoder().decode(source)).files;
    phase = "compile";
    postMessage({ type: "progress", phase: "compile" });
    const result = await buildExercise(
      data.kind,
      data.source,
      {
        compiler,
        kernel,
        disk,
        user,
        files,
      },
      data.context,
    );
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
    postMessage({
      type: "error",
      message: error.message,
      category: phase === "loading" ? "asset" : "compile",
    });
  }
};
