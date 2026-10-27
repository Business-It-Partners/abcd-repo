"use client";

import { useEffect } from "react";
import { acquireBodyScrollLock } from "./bodyScrollLockManager";

export { acquireBodyScrollLock } from "./bodyScrollLockManager";

/**
 * Acquires one share of the page scroll lock.
 *
 * Overlay components may be nested and React may replay their effects in
 * development. A token per acquisition makes cleanup idempotent and ensures
 * only the final owner restores the value that existed before the first lock.
 */
export function useBodyScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    return acquireBodyScrollLock();
  }, [active]);
}
