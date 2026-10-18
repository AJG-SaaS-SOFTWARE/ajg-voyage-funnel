export type DomainActionResult<T> =
  | { stage: "confirmed"; value: T }
  | { stage: "refresh_failed"; value: T }
  | { stage: "mutation_unconfirmed" };

/** Never retry a mutation after a lost response or a failed display refresh. */
export async function runDomainAction<T>(input: {
  mutate: () => Promise<T>;
  refresh: () => Promise<void>;
}): Promise<DomainActionResult<T>> {
  let value: T;
  try {
    value = await input.mutate();
  } catch {
    // The operation may have reached the server. Do not claim it was undone.
    return { stage: "mutation_unconfirmed" };
  }
  try {
    await input.refresh();
    return { stage: "confirmed", value };
  } catch {
    return { stage: "refresh_failed", value };
  }
}
