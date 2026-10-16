// IDs and slugs share a 60-character bound. Reserve suffix space before
// truncating so a collision cannot turn into a non-terminating retry loop.
export function uniquePageKey(value: string, used: Set<string>): string {
  const base = value.slice(0, 60) || "page";
  if (!used.has(base)) { used.add(base); return base; }
  const attempts = used.size + 2;
  for (let suffix = 2; suffix <= attempts; suffix++) {
    const tail = `-${suffix}`;
    const candidate = base.slice(0, 60 - tail.length).replace(/-+$/, "") + tail;
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
  }
  throw new Error("page_key_unavailable");
}
