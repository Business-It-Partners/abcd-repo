type BodyScrollTarget = {
  style: { overflow: string };
};

const owners = new Set<symbol>();
let originalOverflow: string | null = null;

/** Acquires one share of the process-wide page scroll lock. */
export function acquireBodyScrollLock(target: BodyScrollTarget | null = typeof document === "undefined" ? null : document.body): () => void {
  if (!target) return () => undefined;

  const owner = Symbol("body-scroll-lock");
  if (owners.size === 0) {
    originalOverflow = target.style.overflow;
    target.style.overflow = "hidden";
  }
  owners.add(owner);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    owners.delete(owner);
    if (owners.size === 0) {
      target.style.overflow = originalOverflow ?? "";
      originalOverflow = null;
    }
  };
}
