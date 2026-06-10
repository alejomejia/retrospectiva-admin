import { describe, expect, it } from "vitest";

import { extractOutputText } from "./responses-helpers";

describe("extractOutputText", () => {
  it("returns output_text when present", () => {
    expect(extractOutputText({ output_text: '{"ok":true}' })).toBe(
      '{"ok":true}',
    );
  });

  it("falls back to walking output[].content[]", () => {
    expect(
      extractOutputText({
        output: [
          { type: "reasoning", content: [] },
          {
            type: "message",
            content: [{ type: "output_text", text: '{"ok":true}' }],
          },
        ],
      }),
    ).toBe('{"ok":true}');
  });

  it("throws a cap-specific error on max_output_tokens truncation", () => {
    expect(() =>
      extractOutputText({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: '{"titleEs":"truncated mid-str',
      }),
    ).toThrow(/max_output_tokens/);
  });

  it("throws on other incomplete reasons too", () => {
    expect(() =>
      extractOutputText({
        status: "incomplete",
        incomplete_details: { reason: "content_filter" },
      }),
    ).toThrow(/content_filter/);
  });

  it("throws when no text payload exists", () => {
    expect(() => extractOutputText({ output: [] })).toThrow(
      /no output_text/,
    );
  });
});
