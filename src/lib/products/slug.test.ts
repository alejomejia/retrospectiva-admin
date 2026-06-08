import { describe, expect, it } from "vitest";

import { buildSlug, slugifyTitle } from "./slug";

describe("slugifyTitle", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyTitle("Chaqueta Safari Arena")).toBe("chaqueta-safari-arena");
  });

  it("strips accents and symbols, collapses separators", () => {
    expect(slugifyTitle("  ¡Vestido 100% lino!  ")).toBe("vestido-100-lino");
    expect(slugifyTitle("Café & Té")).toBe("cafe-te");
  });

  it("falls back to 'item' for empty / symbol-only titles", () => {
    expect(slugifyTitle("")).toBe("item");
    expect(slugifyTitle("!!!")).toBe("item");
  });
});

describe("buildSlug", () => {
  const id = "9f3c1a2b-4d5e-6f70-8a9b-0c1d2e3f4a5b";

  it("appends the first 6 hex chars of the id", () => {
    expect(buildSlug("Chaqueta Safari Arena", id)).toBe(
      "chaqueta-safari-arena-9f3c1a",
    );
  });

  it("disambiguates identical titles by id suffix", () => {
    const a = buildSlug("Vestido", "aaaaaaaa-0000-0000-0000-000000000000");
    const b = buildSlug("Vestido", "bbbbbbbb-0000-0000-0000-000000000000");
    expect(a).not.toBe(b);
    expect(a).toBe("vestido-aaaaaa");
    expect(b).toBe("vestido-bbbbbb");
  });

  it("handles null/empty title with a stable suffix", () => {
    expect(buildSlug(null, id)).toBe("item-9f3c1a");
  });

  it("strips the SEO suffix after ` | ` before slugifying", () => {
    expect(buildSlug("Chaqueta Safari Arena | Vintage second hand", id)).toBe(
      "chaqueta-safari-arena-9f3c1a",
    );
  });
});
