export async function invalidateLabOrdersAfterCommit(
  createdOrderCount: number,
  reload: (() => Promise<void>) | undefined,
  onReloadError: (cause: unknown) => void,
): Promise<void> {
  if (createdOrderCount === 0 || !reload) return;
  try {
    await reload();
  } catch (cause) {
    // The clinical transaction has already committed. Keep that success
    // durable and report only the failed read-back; callers must never retry
    // the write merely because this reconciliation request failed.
    onReloadError(cause);
  }
}
