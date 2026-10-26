/** Acquire one app's launch slot without blocking launches for other apps. */
export function beginAppLaunch(pending: Set<string>, appId: string): (() => void) | undefined {
  if (pending.has(appId)) return undefined;
  pending.add(appId);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pending.delete(appId);
  };
}
