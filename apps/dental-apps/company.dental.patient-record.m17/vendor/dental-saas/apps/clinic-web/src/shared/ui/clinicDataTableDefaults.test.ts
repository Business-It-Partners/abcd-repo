import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CLINIC_TABLE_SKELETON_ROWS } from "./ClinicDataTable";

describe("clinic data-table loading defaults", () => {
  it("renders seven placeholder rows across shared data tables", () => {
    expect(CLINIC_TABLE_SKELETON_ROWS).toBe(7);
  });

  it("keeps shared tables visually scannable with alternating rows", () => {
    const styles = readFileSync(new URL("./ClinicTable.module.css", import.meta.url), "utf8");

    expect(styles).toContain(".striped tbody .tr:nth-child(even) .td");
    expect(styles).toContain(".striped tbody .tr:hover .td");
  });
});
