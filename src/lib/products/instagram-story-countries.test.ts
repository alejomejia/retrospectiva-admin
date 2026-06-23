import { describe, expect, it } from "vitest";

import {
  STORY_COUNTRIES,
  composeSoldTagline,
  findStoryCountry,
} from "./instagram-story-countries";

describe("STORY_COUNTRIES", () => {
  it("is sorted alphabetically by name", () => {
    const names = STORY_COUNTRIES.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("has unique codes", () => {
    const codes = STORY_COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("findStoryCountry", () => {
  it("resolves a known code", () => {
    expect(findStoryCountry("DE")).toEqual({
      code: "DE",
      name: "Germany",
      flag: "🇩🇪",
    });
  });

  it("returns undefined for empty or unknown codes", () => {
    expect(findStoryCountry("")).toBeUndefined();
    expect(findStoryCountry("ZZ")).toBeUndefined();
  });
});

describe("composeSoldTagline", () => {
  it("appends the destination when a country is set", () => {
    expect(composeSoldTagline("One of a kind", "DE")).toBe(
      "One of a kind - Sent to Germany 🇩🇪",
    );
  });

  it("returns the bare tagline when no country is set", () => {
    expect(composeSoldTagline("One of a kind", "")).toBe("One of a kind");
  });
});
