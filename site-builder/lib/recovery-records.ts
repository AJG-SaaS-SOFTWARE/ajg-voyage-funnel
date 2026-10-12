type RecoveryPage<T> = { data: T[] | null; error: unknown };

/** Read every page; a database error must never look like an empty export. */
export async function readRecoveryRecords<T>(
  readPage: (from: number, to: number) => PromiseLike<RecoveryPage<T>>
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; ) {
    const { data, error } = await readPage(offset, offset + 999);
    if (error || !Array.isArray(data)) throw new Error("recovery_records_unavailable");
    if (data.length === 0) return rows;
    rows.push(...data);
    // Continue even if the server's row limit is below the requested page size.
    offset += data.length;
  }
}
