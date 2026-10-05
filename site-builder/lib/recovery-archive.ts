import { Readable } from "node:stream";
import { createGzip } from "node:zlib";

const BLOCK_SIZE = 512;
const encoder = new TextEncoder();

export type RecoveryTarEntry = {
  path: string;
  data: string | Uint8Array | Blob;
  modifiedAt?: Date;
};

function writeText(target: Uint8Array, offset: number, length: number, value: string) {
  const bytes = encoder.encode(value);
  target.set(bytes.subarray(0, length), offset);
}

function writeOctal(target: Uint8Array, offset: number, length: number, value: number) {
  const octal = Math.max(0, Math.floor(value)).toString(8);
  const formatted = octal.padStart(length - 1, "0").slice(-(length - 1)) + "\0";
  writeText(target, offset, length, formatted);
}

function tarHeader(path: string, size: number, modifiedAt: Date) {
  const encodedPath = encoder.encode(path);
  if (encodedPath.length > 100) {
    throw new Error("Archive path is too long: " + path);
  }

  const header = new Uint8Array(BLOCK_SIZE);
  writeText(header, 0, 100, path);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, Math.floor(modifiedAt.getTime() / 1000));

  for (let index = 148; index < 156; index += 1) header[index] = 32;
  header[156] = "0".charCodeAt(0);
  writeText(header, 257, 6, "ustar\0");
  writeText(header, 263, 2, "00");
  writeText(header, 265, 32, "ajg-builder");
  writeText(header, 297, 32, "ajg-builder");

  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeText(header, 148, 8, checksum.toString(8).padStart(6, "0").slice(-6) + "\0 ");

  return header;
}

function entrySize(data: RecoveryTarEntry["data"]) {
  if (typeof data === "string") return encoder.encode(data).byteLength;
  if (data instanceof Blob) return data.size;
  return data.byteLength;
}

async function* dataChunks(data: RecoveryTarEntry["data"]): AsyncGenerator<Uint8Array> {
  if (typeof data === "string") {
    yield encoder.encode(data);
    return;
  }

  if (data instanceof Uint8Array) {
    yield data;
    return;
  }

  const reader = data.stream().getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      yield chunk.value;
    }
  } finally {
    reader.releaseLock();
  }
}

async function* tarChunks(entries: AsyncIterable<RecoveryTarEntry>): AsyncGenerator<Uint8Array> {
  for await (const entry of entries) {
    const size = entrySize(entry.data);
    yield tarHeader(entry.path, size, entry.modifiedAt || new Date());

    for await (const chunk of dataChunks(entry.data)) yield chunk;

    const padding = (BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE;
    if (padding) yield new Uint8Array(padding);
  }

  yield new Uint8Array(BLOCK_SIZE * 2);
}

export function createTarGzipStream(entries: AsyncIterable<RecoveryTarEntry>) {
  const tar = Readable.from(tarChunks(entries));
  const gzip = createGzip({ level: 6 });
  return Readable.toWeb(tar.pipe(gzip)) as ReadableStream<Uint8Array>;
}

function asciiFilename(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return (normalized || "media").slice(0, 64);
}

export function recoveryMediaArchivePath(bucket: string, index: number, originalName: string) {
  const visibility = bucket === "site-private-media" ? "private" : "public";
  const ordinal = String(index + 1).padStart(4, "0");
  return "media/" + visibility + "/" + ordinal + "-" + asciiFilename(originalName);
}

export function recoveryArchiveFilename(slug: string) {
  const safeSlug = asciiFilename(slug).slice(0, 48) || "site";
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return "eltara-export-" + safeSlug + "-" + day + ".tar.gz";
}
