import { describe, expect, it } from "vitest";
import { paginationWindow } from "./pagination";

describe("paginationWindow", () => {
  it("shows the first ten pages at the beginning", () => {
    expect(paginationWindow(1, 24)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("keeps a ten-page window around the current page", () => {
    expect(paginationWindow(15, 30)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it("ends on the final page near the end", () => {
    expect(paginationWindow(30, 30)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  });
});
