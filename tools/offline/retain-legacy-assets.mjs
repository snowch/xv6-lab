// Copyright © 2026 Christopher Snow
// Compatibility aliases for lessons opened before immutable release URLs existed.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const digest = (body) => createHash("sha256").update(body).digest("hex");
const safe = (path) =>
  /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.+-]+$/.test(path) &&
  !path.split("/").some((p) => p === "." || p === "..") &&
  !path.startsWith("releases/");
export async function retainLegacyAssets(
  directory,
  source,
  release,
  fetcher = fetch,
) {
  if (!source) return [];
  const base = new URL(source.endsWith("/") ? source : source + "/"),
    request = (path) =>
      fetcher(new URL(path, base), {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
  const response = await request("release.json");
  let previous;
  if (response.ok) previous = await response.json();
  else if (response.status !== 404)
    throw Error(
      "Could not read published release before keeping older open lessons working.",
    );
  const before = await request("index.html");
  if (!before.ok)
    throw Error(
      "Could not capture the published page before retaining its assets.",
    );
  const pageHash = digest(Buffer.from(await before.arrayBuffer()));
  const known = previous?.legacyAssets;
  const paths = known
    ? known.map((f) => f.path)
    : release.files.filter((f) => !f.path.endsWith(".html")).map((f) => f.path);
  if (!Array.isArray(paths) || paths.some((p) => !safe(p)))
    throw Error("Invalid legacy asset paths.");
  const queue = [...paths],
    retained = [];
  await Promise.all(
    Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (queue.length) {
        const path = queue.shift(),
          response = await request(path);
        if (!response.ok) {
          if (response.status === 404 && !known) continue;
          throw Error("Could not preserve an older lesson asset: " + path);
        }
        const body = Buffer.from(await response.arrayBuffer()),
          sha256 = digest(body),
          expected = known?.find((f) => f.path === path);
        if (
          expected &&
          (expected.bytes !== body.length || expected.sha256 !== sha256)
        )
          throw Error("An older lesson asset failed verification: " + path);
        const current = release.files.find((f) => f.path === path);
        await mkdir(
          directory + "/" + path.slice(0, path.lastIndexOf("/") + 1),
          { recursive: true },
        );
        await writeFile(directory + "/" + path, body);
        retained.push({ path, bytes: body.length, sha256 });
      }
    }),
  );
  const after = await request("index.html");
  if (!after.ok || digest(Buffer.from(await after.arrayBuffer())) !== pageHash)
    throw Error(
      "The published site changed while retaining older open lessons. Retry publication.",
    );
  return retained.sort((a, b) => a.path.localeCompare(b.path));
}
