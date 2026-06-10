import { describe, expect, it } from "vitest";

import { appendTitleSuffix } from "./title-suffix";

describe("appendTitleSuffix", () => {
  it("appends the Spanish brand suffix", () => {
    expect(appendTitleSuffix("Camisa manga larga", "es")).toBe(
      "Camisa manga larga | Vintage segunda mano",
    );
  });

  it("appends the English brand suffix", () => {
    expect(appendTitleSuffix("Long sleeve shirt", "en")).toBe(
      "Long sleeve shirt | Vintage second hand",
    );
  });

  it("trims the title body before appending", () => {
    expect(appendTitleSuffix("  Vestido  ", "es")).toBe(
      "Vestido | Vintage segunda mano",
    );
  });

  it("returns empty for an empty/whitespace title (no dangling suffix)", () => {
    expect(appendTitleSuffix("   ", "en")).toBe("");
  });
});
