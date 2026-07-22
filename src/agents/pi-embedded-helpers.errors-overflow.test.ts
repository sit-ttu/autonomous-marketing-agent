import { describe, expect, it } from "vitest";
import { extractObservedOverflowTokenCount } from "./pi-embedded-helpers/errors.js";

describe("extractObservedOverflowTokenCount", () => {
  it("parses provider-specific overflow token counts", () => {
    expect(
      extractObservedOverflowTokenCount(
        "400 The prompt is too long: 203557, model maximum context length: 196607",
      ),
    ).toBe(203557);
    expect(
      extractObservedOverflowTokenCount(
        "Invalid request: Your request exceeded model token limit: 262144 (requested: 291351)",
      ),
    ).toBe(291351);
    expect(
      extractObservedOverflowTokenCount(
        "input length and max_tokens exceed context limit (i.e 156321 + 48384 > 200000)",
      ),
    ).toBe(204705);
  });

  it("returns undefined when overflow counts are not present", () => {
    expect(extractObservedOverflowTokenCount("Prompt too large for this model")).toBeUndefined();
    expect(
      extractObservedOverflowTokenCount(
        "The prompt is too long: 203557 characters, model maximum context length: 196607",
      ),
    ).toBeUndefined();
  });
});
