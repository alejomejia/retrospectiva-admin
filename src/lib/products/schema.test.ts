import { describe, expect, it } from "vitest";

import { m } from "@/lib/i18n/messages.es";
import { ProductFormSchema } from "./schema";

describe("ProductFormSchema", () => {
  it("accepts valid input", () => {
    const r = ProductFormSchema.safeParse({
      name: "Abrigo italiano de lana de los 70",
      priceEur: "149.99",
    });
    expect(r.success).toBe(true);
  });

  it("trims whitespace from name", () => {
    const r = ProductFormSchema.safeParse({
      name: "  trimmed  ",
      priceEur: "10",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("trimmed");
  });

  it("rejects empty name with the Spanish message", () => {
    const r = ProductFormSchema.safeParse({ name: "", priceEur: "10" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(m.validation.nameRequired);
    }
  });

  it("rejects name over 200 chars with the Spanish message", () => {
    const r = ProductFormSchema.safeParse({
      name: "x".repeat(201),
      priceEur: "10",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(m.validation.nameTooLong);
    }
  });

  it("rejects empty price with the Spanish message", () => {
    const r = ProductFormSchema.safeParse({ name: "x", priceEur: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(m.validation.priceRequired);
    }
  });

  it("rejects non-numeric price", () => {
    const r = ProductFormSchema.safeParse({ name: "x", priceEur: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(m.validation.priceFormat);
    }
  });

  it("rejects price with more than 2 decimals", () => {
    const r = ProductFormSchema.safeParse({
      name: "x",
      priceEur: "10.999",
    });
    expect(r.success).toBe(false);
  });

  it("rejects zero price with the Spanish message", () => {
    const r = ProductFormSchema.safeParse({ name: "x", priceEur: "0" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(
        m.validation.priceGreaterThanZero,
      );
    }
  });

  it("accepts integer price (no decimals)", () => {
    const r = ProductFormSchema.safeParse({ name: "x", priceEur: "49" });
    expect(r.success).toBe(true);
  });
});
