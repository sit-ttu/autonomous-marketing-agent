import { describe, expect, it } from "vitest";
import { isSetRawModeTerminalError } from "./interactive.js";

describe("isSetRawModeTerminalError", () => {
  it("detects setRawMode EIO errors", () => {
    expect(
      isSetRawModeTerminalError({
        code: "EIO",
        syscall: "setRawMode",
        message: "setRawMode EIO",
      }),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isSetRawModeTerminalError(new Error("network down"))).toBe(false);
  });
});
