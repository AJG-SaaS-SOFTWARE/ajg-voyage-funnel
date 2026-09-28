import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";

const {
  createTarGzipStream,
  recoveryArchiveFilename,
  recoveryMediaArchivePath
} = await import("../lib/recovery-archive.ts");

async function collect(stream) {
  const reader = stream.getReader();
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function readTar(buffer) {
  const files = new Map();
  let offset = 0;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = header
      .subarray(0, 100)
      .toString("utf8")
      .replace(/\0.*$/, "");
    const sizeText = header
      .subarray(124, 136)
      .toString("ascii")
      .replace(/\0.*$/, "")
      .trim();
    const size = Number.parseInt(sizeText || "0", 8);
    const start = offset + 512;
    const end = start + size;
    files.set(name, buffer.subarray(start, end));
    offset = end + ((512 - (size % 512)) % 512);
  }

  return files;
}

test("recovery archive streams a valid gzip-compressed tar", async () => {
  async function* entries() {
    yield { path: "ajg-builder-export.json", data: "{\"ok\":true}" };
    yield { path: "media/public/0001-photo.txt", data: new Uint8Array([65, 66, 67]) };
    yield { path: "media/private/0002-note.txt", data: new Blob(["private"]) };
  }

  const compressed = await collect(createTarGzipStream(entries()));
  const tar = gunzipSync(compressed);
  const files = readTar(tar);

  assert.deepEqual(
    [...files.keys()],
    [
      "ajg-builder-export.json",
      "media/public/0001-photo.txt",
      "media/private/0002-note.txt"
    ]
  );
  assert.equal(files.get("ajg-builder-export.json")?.toString("utf8"), "{\"ok\":true}");
  assert.equal(files.get("media/public/0001-photo.txt")?.toString("utf8"), "ABC");
  assert.equal(files.get("media/private/0002-note.txt")?.toString("utf8"), "private");
});

test("recovery archive filenames are safe and deterministic", () => {
  assert.equal(
    recoveryMediaArchivePath("site-private-media", 4, "été / facture finale.pdf"),
    "media/private/0005-ete-facture-finale.pdf"
  );
  assert.match(
    recoveryArchiveFilename("Mon Site Démo"),
    /^ajg-builder-export-Mon-Site-Demo-\d{8}\.tar\.gz$/
  );
});
