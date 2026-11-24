// Copyright © 2026 Christopher Snow.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { retainPublishedReleases } from "../tools/offline/retain-releases.mjs";
import { retainLegacyAssets } from "../tools/offline/retain-legacy-assets.mjs";
const oldBody = Buffer.from("<p>An already open lesson</p>");
const file = {
  path: "index.html",
  bytes: oldBody.length,
  sha256: createHash("sha256").update(oldBody).digest("hex"),
};
const release = {
  schema: 1,
  id: "a".repeat(64),
  commit: null,
  date: null,
  files: [file],
  bytes: file.bytes,
};

test("publisher preserves exact older release bytes and rejects corrupt replacements", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xv6-retain-"));
  try {
    for (const corrupt of [false, true]) {
      const fetcher = async (url) =>
        new Response(
          url.pathname.endsWith("/release.json")
            ? JSON.stringify(release)
            : corrupt
              ? "damaged old lesson"
              : oldBody,
        );
      const retain = () =>
        retainPublishedReleases(directory, "https://example.test/xv6-lab/", {
          fetcher,
          currentId: "b".repeat(64),
        });
      if (corrupt) await assert.rejects(retain, /failed verification/);
      else {
        assert.deepEqual(await retain(), [release.id]);
        assert.deepEqual(
          await readFile(join(directory, "releases", release.id, "index.html")),
          oldBody,
        );
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("first offline publication preserves legacy aliases when no release manifest exists", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xv6-legacy-"));
  const asset = Buffer.from("old runtime bytes");
  try {
    const fetcher = async (url) =>
      url.pathname.endsWith("/release.json")
        ? new Response("", { status: 404 })
        : new Response(url.pathname.endsWith("/index.html") ? oldBody : asset);
    const kept = await retainLegacyAssets(
      directory,
      "https://example.test/xv6-lab/",
      { files: [{ path: "runtime.wasm" }] },
      fetcher,
    );
    assert.deepEqual(kept, [
      {
        path: "runtime.wasm",
        bytes: asset.length,
        sha256: createHash("sha256").update(asset).digest("hex"),
      },
    ]);
    assert.deepEqual(await readFile(join(directory, "runtime.wasm")), asset);
    assert.deepEqual(
      await retainPublishedReleases(
        directory,
        "https://example.test/xv6-lab/",
        { fetcher },
      ),
      [],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
