import { describe, expect, it } from "vitest";
import { cn, toCSSVars } from "./helpers";

describe("cn", () => {
  it("merges tailwind classes and dedupes the same utility", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("filters falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("toCSSVars", () => {
  it("prefixes keys and converts numbers to rem by default", () => {
    expect(toCSSVars({ gap: 16, color: "red" })).toEqual({
      "--gap": "1rem",
      "--color": "red",
    });
  });

  it("supports px unit", () => {
    expect(toCSSVars({ gap: 16 }, "px")).toEqual({ "--gap": "16px" });
  });
});
