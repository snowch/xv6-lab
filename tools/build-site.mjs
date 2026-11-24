import { cp, rm, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { buildOffline } from "./offline/build.mjs";
await rm(".build/site", { recursive: true, force: true });
await cp("site", ".build/site", { recursive: true });
const dirty = execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
}).trim();
const commit =
  process.env.COURSE_COMMIT ||
  (dirty
    ? null
    : execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
const release = await buildOffline(".build/site", {
  commit,
  date: commit
    ? execFileSync("git", ["show", "-s", "--format=%cs", commit], {
        encoding: "utf8",
      }).trim()
    : null,
});
console.log(
  `Built ${release.files.length} verified course files (${(release.bytes / 1e6).toFixed(1)} MB).`,
);
