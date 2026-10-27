import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");
const readSource = (path: string) => readFileSync(resolve(sourceRoot, path), "utf8");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

describe("shared scroll-lock adoption", () => {
  it("keeps direct body overflow ownership out of feature components", () => {
    const directWriters = sourceFiles(sourceRoot)
      .filter((path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"))
      .filter((path) => readFileSync(path, "utf8").includes("document.body.style.overflow"));

    expect(directWriters).toEqual([]);
  });

  it("routes modal, date-picker, and custom-dialog locks through the shared owner", () => {
    expect(readSource("shared/ui/ClinicModal.tsx")).toContain("useBodyScrollLock();");
    expect(readSource("shared/dates/NepaliDatePicker.tsx")).toContain("useBodyScrollLock(open);");
    expect(readSource("features/follow-ups/components/FollowUpsView.tsx")).toContain("useBodyScrollLock();");
    expect(readSource("features/work-entry/components/CanalDrawer.tsx")).not.toContain("useBodyScrollLock");
  });
});
