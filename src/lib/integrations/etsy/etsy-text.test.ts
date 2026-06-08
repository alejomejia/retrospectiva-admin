import { describe, expect, it } from "vitest";

import {
  clampPhrasesToMaxLen,
  clampPhraseToMaxLen,
  ETSY_TAG_MAX_LEN,
} from "./etsy-text";

describe("clampPhraseToMaxLen", () => {
  it("leaves a phrase within the cap untouched", () => {
    expect(clampPhraseToMaxLen("vestido flores", 20)).toBe("vestido flores");
  });

  it("drops whole trailing words to fit the cap", () => {
    // "vestido flores años 90" is 22 chars → trim to the last word boundary.
    expect(clampPhraseToMaxLen("vestido flores años 90", 20)).toBe(
      "vestido flores años",
    );
  });

  it("hard-cuts a single leading word longer than the cap", () => {
    expect(clampPhraseToMaxLen("supercalifragilistico", 20)).toBe(
      "supercalifragilistic",
    );
  });

  it("trims surrounding whitespace before measuring", () => {
    expect(clampPhraseToMaxLen("  vestido flores  ", 20)).toBe(
      "vestido flores",
    );
  });
});

describe("clampPhrasesToMaxLen", () => {
  it("clamps every entry and never exceeds the cap", () => {
    const out = clampPhrasesToMaxLen(
      ["vestido flores años 90", "blusa lino azul marino", "ok"],
      ETSY_TAG_MAX_LEN,
    );
    expect(out.every((t) => t.length <= ETSY_TAG_MAX_LEN)).toBe(true);
    expect(out).toEqual(["vestido flores años", "blusa lino azul", "ok"]);
  });

  it("drops entries that clamp to empty and non-strings", () => {
    expect(
      clampPhrasesToMaxLen(["", "   ", "tag", 1 as unknown as string], 20),
    ).toEqual(["tag"]);
  });
});
