import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
const result = await build({
  entryPoints: ["tools/workbench-editor.js"],
  outfile: "site/workbench/editor.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  metafile: true,
  legalComments: "eof",
});
const packages = new Set(
  Object.keys(result.metafile.inputs)
    .map((p) => p.match(/node_modules\/(?:@[^/]+\/)?[^/]+/)?.[0])
    .filter(Boolean),
);
let licenses = "Code editor dependencies and their licenses\n\n";
for (const folder of [...packages].sort()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(folder, "package.json")));
  const name = fs
    .readdirSync(folder)
    .find((n) => /^licen[sc]e(?:\.txt|\.md)?$/i.test(n));
  if (!name) throw new Error("Missing license for " + pkg.name);
  licenses += `${pkg.name} ${pkg.version}\n${fs.readFileSync(path.join(folder, name), "utf8")}\n\n`;
}
fs.writeFileSync("site/workbench/EDITOR-LICENSES.txt", licenses);
console.log("Editor bundled with licenses.");
