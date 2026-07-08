import { describe, expect, it } from "vitest";

import {
  formatSizeBadge,
  formatSizeHeader,
  prependSizeHeader,
} from "./size-conversion";

describe("formatSizeBadge", () => {
  it("joins size + regional conversions with the default dot separator", () => {
    expect(formatSizeBadge("S")).toBe("S · EU 36 · UK 8 · US 4");
    expect(formatSizeBadge("2X")).toBe("2X · EU 50 · UK 22 · US 18");
  });

  it("honours a custom separator", () => {
    expect(formatSizeBadge("S", " | ")).toBe("S | EU 36 | UK 8 | US 4");
  });

  it("returns null for missing or unrecognized sizes", () => {
    expect(formatSizeBadge(null)).toBeNull();
    expect(formatSizeBadge("not-a-size")).toBeNull();
  });
});

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

  it("appends the condition segment when supplied", () => {
    expect(formatSizeHeader("S", "en", "excellent")).toBe(
      "Size: S | EU 36 | UK 8 | US 4 | Condition: Excellent",
    );
    expect(formatSizeHeader("S", "es", "very_good")).toBe(
      "Talla: S | EU 36 | UK 8 | US 4 | Estado: Muy bueno",
    );
    expect(formatSizeHeader("M", "en", "good")).toBe(
      "Size: M | EU 40 | UK 12 | US 8 | Condition: Good",
    );
  });

  it("omits the condition segment when condition is absent", () => {
    expect(formatSizeHeader("S", "en", null)).toBe("Size: S | EU 36 | UK 8 | US 4");
    expect(formatSizeHeader("S", "en")).toBe("Size: S | EU 36 | UK 8 | US 4");
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

  it("includes the condition segment in the prepended header", () => {
    expect(prependSizeHeader("A lovely dress.", "M", "en", "good")).toBe(
      "Size: M | EU 40 | UK 12 | US 8 | Condition: Good\n\nA lovely dress.",
    );
  });
});
