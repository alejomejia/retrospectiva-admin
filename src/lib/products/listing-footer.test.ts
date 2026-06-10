// @vitest-environment node
import { describe, expect, it } from "vitest";

import { appendListingFooter, resolveListingFooter } from "./listing-footer";

type Override = {
  listingFooterEsOverride: string | null;
  listingFooterEnOverride: string | null;
};
type Settings = { listingFooterEs: string; listingFooterEn: string };

const override = (o: Partial<Override>): Override => ({
  listingFooterEsOverride: null,
  listingFooterEnOverride: null,
  ...o,
});
const settings = (s: Partial<Settings>): Settings => ({
  listingFooterEs: "",
  listingFooterEn: "",
  ...s,
});

describe("resolveListingFooter", () => {
  it("falls back to the shop-wide footer when no override is set", () => {
    const footer = resolveListingFooter(
      override({}),
      settings({ listingFooterEs: "Lavar a mano", listingFooterEn: "Hand wash" }),
    );
    expect(footer).toEqual({ es: "Lavar a mano", en: "Hand wash" });
  });

  it("uses the per-product override pair when the ES override is set", () => {
    const footer = resolveListingFooter(
      override({
        listingFooterEsOverride: "Solo este producto",
        listingFooterEnOverride: "This product only",
      }),
      settings({ listingFooterEs: "Por defecto", listingFooterEn: "Default" }),
    );
    expect(footer).toEqual({ es: "Solo este producto", en: "This product only" });
  });

  it("treats a blank/whitespace override as no override", () => {
    const footer = resolveListingFooter(
      override({ listingFooterEsOverride: "   " }),
      settings({ listingFooterEs: "Por defecto", listingFooterEn: "Default" }),
    );
    expect(footer).toEqual({ es: "Por defecto", en: "Default" });
  });

  it("returns empty strings when neither override nor settings are set", () => {
    expect(resolveListingFooter(override({}), settings({}))).toEqual({
      es: "",
      en: "",
    });
  });
});

describe("appendListingFooter", () => {
  it("joins body and footer with a --- divider rule", () => {
    expect(appendListingFooter("Body text", "Footer text")).toBe(
      "Body text\n\n---\n\nFooter text",
    );
  });

  it("returns the body unchanged when the footer is empty", () => {
    expect(appendListingFooter("Body text", "")).toBe("Body text");
    expect(appendListingFooter("Body text", "   ")).toBe("Body text");
  });

  it("returns the footer alone when the body is empty", () => {
    expect(appendListingFooter("", "Footer text")).toBe("Footer text");
  });
});
