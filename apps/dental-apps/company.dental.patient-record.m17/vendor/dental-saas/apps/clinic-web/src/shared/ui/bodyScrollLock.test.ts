import { describe, expect, it } from "vitest";
import { acquireBodyScrollLock } from "./bodyScrollLockManager";

describe("body scroll lock", () => {
  it("restores the pre-existing overflow after one overlay closes", () => {
    const body = { style: { overflow: "auto" } };
    const release = acquireBodyScrollLock(body);

    expect(body.style.overflow).toBe("hidden");
    release();
    expect(body.style.overflow).toBe("auto");
  });

  it("keeps the page locked until every nested overlay releases", () => {
    const body = { style: { overflow: "" } };
    const releaseParent = acquireBodyScrollLock(body);
    const releaseChild = acquireBodyScrollLock(body);

    releaseChild();
    expect(body.style.overflow).toBe("hidden");

    releaseParent();
    expect(body.style.overflow).toBe("");
  });

  it("is safe when owners release out of order or cleanup runs twice", () => {
    const body = { style: { overflow: "scroll" } };
    const releaseParent = acquireBodyScrollLock(body);
    const releaseChild = acquireBodyScrollLock(body);

    releaseParent();
    releaseParent();
    expect(body.style.overflow).toBe("hidden");

    releaseChild();
    expect(body.style.overflow).toBe("scroll");
  });
});
