import { describe, expect, it } from "vitest";

import { formatSizeHeader, prependSizeHeader } from "./size-conversion";

describe("formatSizeHeader", () => {
  it("formats the English header for a letter size", () => {
    expect(formatSizeHeader("S", "en")).toBe("Size: S | EU 36 | UK 8 | US 4");
  });

  it("formats the Spanish header with the Talla label", () => {
    expect(formatSizeHeader("S", "es")).toBe("Talla: S | EU 36 | UK 8 | US 4");
  });

  it("converts plus sizes", () => {
    expect(formatSizeHeader("2X", "en")).toBe("Size: 2X | EU 50 | UK 22 | US 18");
  });

  it("returns null when size is missing", () => {
    expect(formatSizeHeader(null, "en")).toBeNull();
    expect(formatSizeHeader(undefined, "en")).toBeNull();
    expect(formatSizeHeader("", "en")).toBeNull();
  });

  it("returns null for a value outside the Etsy size scale", () => {
    expect(formatSizeHeader("42", "en")).toBeNull();
    expect(formatSizeHeader("medium", "en")).toBeNull();
  });
});

describe("prependSizeHeader", () => {
  it("prepends the header before the body, separated by a blank line", () => {
    expect(prependSizeHeader("A lovely dress.", "M", "en")).toBe(
      "Size: M | EU 40 | UK 12 | US 8\n\nA lovely dress.",
    );
  });

  it("leaves the body unchanged when size is missing or unknown", () => {
    expect(prependSizeHeader("A lovely dress.", null, "en")).toBe(
      "A lovely dress.",
    );
    expect(prependSizeHeader("A lovely dress.", "nope", "es")).toBe(
      "A lovely dress.",
    );
  });

  it("returns just the header when the body is empty", () => {
    expect(prependSizeHeader("", "S", "en")).toBe("Size: S | EU 36 | UK 8 | US 4");
  });
});
