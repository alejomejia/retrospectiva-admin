import { describe, expect, it } from "vitest";
import {
  MONEY_STRING_RE,
  centsToPriceEur,
  formatCents,
  priceEurToCents,
} from "./money";

describe("formatCents", () => {
  it("formats EUR by default", () => {
    // Use a fixed locale ("en-IE") for deterministic output.
    expect(formatCents(4999, "EUR", "en-IE")).toBe("€49.99");
  });

  it("formats thousands with the locale's separators", () => {
    expect(formatCents(120000, "EUR", "en-IE")).toBe("€1,200.00");
  });

  it("formats zero", () => {
    expect(formatCents(0, "EUR", "en-IE")).toBe("€0.00");
  });
});

describe("MONEY_STRING_RE", () => {
  it.each(["0", "49", "49.9", "49.99", "1000", "0.01"])(
    "accepts %s",
    (input) => {
      expect(MONEY_STRING_RE.test(input)).toBe(true);
    },
  );

  it.each(["", "abc", "49.", "49.999", "-1", "1,99", " 49", "49 "])(
    "rejects %s",
    (input) => {
      expect(MONEY_STRING_RE.test(input)).toBe(false);
    },
  );
});

describe("priceEurToCents", () => {
  it("converts whole euros", () => {
    expect(priceEurToCents("49")).toBe(4900);
  });

  it("converts decimals", () => {
    expect(priceEurToCents("49.99")).toBe(4999);
  });

  it("handles float-imprecision-prone values", () => {
    // 1.23 * 100 → 122.99999999999999 without Math.round.
    expect(priceEurToCents("1.23")).toBe(123);
  });

  it("handles single-decimal values", () => {
    expect(priceEurToCents("9.5")).toBe(950);
  });
});

describe("centsToPriceEur", () => {
  it("formats whole euros", () => {
    expect(centsToPriceEur(4900)).toBe("49.00");
  });

  it("formats decimals", () => {
    expect(centsToPriceEur(4999)).toBe("49.99");
  });

  it("round-trips with priceEurToCents", () => {
    const original = "1234.56";
    expect(centsToPriceEur(priceEurToCents(original))).toBe(original);
  });
});
