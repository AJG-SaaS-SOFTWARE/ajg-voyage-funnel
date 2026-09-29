import "server-only";

import { headers as nextHeaders } from "next/headers";

export type PrivateBlobItem = {
  url: string;
  downloadUrl?: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  etag?: string;
};

type BlobListResponse = {
  blobs: PrivateBlobItem[];
  cursor?: string;
  hasMore?: boolean;
};

type BlobPutResponse = {
  url: string;
  downloadUrl?: string;
  pathname: string;
  etag?: string;
};

type BlobCredentials = {
  storeId: string;
  token: string;
};

const API = "https://vercel.com/api/blob";
const API_VERSION = "12";

function normalizeStoreId(value: string) {
  return value.startsWith("store_") ? value.slice("store_".length) : value;
}

async function requestOidcToken() {
  const fromEnv = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  try {
    const requestHeaders = await nextHeaders();
    return requestHeaders.get("x-vercel-oidc-token")?.trim() || null;
  } catch {
    return null;
  }
}

async function auth(): Promise<BlobCredentials | null> {
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (!storeId) return null;

  const oidc = await requestOidcToken();
  if (oidc) {
    return {
      storeId: normalizeStoreId(storeId),
      token: oidc
    };
  }

  const readWrite = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (readWrite) {
    return {
      storeId: normalizeStoreId(storeId),
      token: readWrite
    };
  }

  return null;
}

async function requestHeaders(extra: Record<string, string> = {}) {
  const credentials = await auth();
  if (!credentials) return null;

  return {
    Authorization: `Bearer ${credentials.token}`,
    "x-vercel-blob-store-id": credentials.storeId,
    "x-api-version": API_VERSION,
    "x-api-blob-request-id": `${credentials.storeId}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    ...extra
  };
}

async function blobRequest<T>(
  input: string,
  init: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const extraHeaders: Record<string, string> = {};
  new Headers(init.headers).forEach((value, key) => {
    extraHeaders[key] = value;
  });

  const headers = await requestHeaders(extraHeaders);
  if (!headers) {
    return { ok: false, error: "Blob credentials unavailable" };
  }

  try {
    const response = await fetch(input, {
      ...init,
      headers,
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        status: response.status,
        error: body.slice(0, 300) || `HTTP ${response.status}`
      };
    }

    const body = await response.text();
    return {
      ok: true,
      data: (body ? JSON.parse(body) : undefined) as T
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Blob request failed"
    };
  }
}

export async function privateBlobConfigured() {
  return Boolean(await auth());
}

export async function putPrivateBlob(
  pathname: string,
  body: BodyInit,
  contentType = "application/octet-stream",
  allowOverwrite = false
) {
  const url = new URL(API);
  url.searchParams.set("pathname", pathname);

  return blobRequest<BlobPutResponse>(url.toString(), {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "x-content-type": contentType,
      "x-vercel-blob-access": "private",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": allowOverwrite ? "1" : "0",
      "x-cache-control-max-age": "60"
    },
    body
  });
}

export async function putPrivateJson(
  pathname: string,
  value: unknown,
  allowOverwrite = false
) {
  return putPrivateBlob(
    pathname,
    JSON.stringify(value),
    "application/json; charset=utf-8",
    allowOverwrite
  );
}

export async function listPrivateBlobs(
  prefix: string,
  limit = 1000,
  cursor?: string
) {
  const url = new URL(API);
  url.searchParams.set("prefix", prefix);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);

  return blobRequest<BlobListResponse>(url.toString(), { method: "GET" });
}

export async function listAllPrivateBlobs(prefix: string) {
  const blobs: PrivateBlobItem[] = [];
  let cursor: string | undefined;

  for (;;) {
    const page = await listPrivateBlobs(prefix, 1000, cursor);
    if (!page.ok) return page;

    blobs.push(...page.data.blobs);
    if (!page.data.hasMore || !page.data.cursor) {
      return { ok: true as const, data: { blobs } };
    }
    cursor = page.data.cursor;
  }
}

export async function readPrivateJson<T>(url: string) {
  const credentials = await auth();
  if (!credentials) {
    return { ok: false as const, error: "Blob credentials unavailable" };
  }

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.token}` },
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        error: `HTTP ${response.status}`
      };
    }

    return { ok: true as const, data: (await response.json()) as T };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Blob read failed"
    };
  }
}

export async function deletePrivateBlobs(urls: string[]) {
  if (urls.length === 0) return { ok: true as const };

  return blobRequest<unknown>(`${API}/delete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ urls })
  });
}
