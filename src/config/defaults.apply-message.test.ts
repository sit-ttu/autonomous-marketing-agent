import { describe, expect, it } from "vitest";
import { applyMessageDefaults } from "./defaults.js";
import type { FoxFangConfig } from "./types.foxfang.js";

const baseConfig = (overrides: Partial<FoxFangConfig["messages"]> = {}): FoxFangConfig => ({
  messages: { ...overrides } as FoxFangConfig["messages"],
});

describe("applyMessageDefaults", () => {
  it("sets ackReaction='👀' and ackReactionScope='all' when neither is set", () => {
    const result = applyMessageDefaults(baseConfig());
    expect(result.messages?.ackReaction).toBe("👀");
    expect(result.messages?.ackReactionScope).toBe("all");
  });

  it("preserves user-provided ackReaction", () => {
    const result = applyMessageDefaults(baseConfig({ ackReaction: "🦊" }));
    expect(result.messages?.ackReaction).toBe("🦊");
    expect(result.messages?.ackReactionScope).toBe("all");
  });

  it("preserves user-provided ackReactionScope", () => {
    const result = applyMessageDefaults(baseConfig({ ackReactionScope: "group-mentions" }));
    expect(result.messages?.ackReaction).toBe("👀");
    expect(result.messages?.ackReactionScope).toBe("group-mentions");
  });

  it("preserves both when user has fully configured", () => {
    const result = applyMessageDefaults(
      baseConfig({ ackReaction: "✅", ackReactionScope: "direct" }),
    );
    expect(result.messages?.ackReaction).toBe("✅");
    expect(result.messages?.ackReactionScope).toBe("direct");
  });

  it("does not mutate the input config", () => {
    const input = baseConfig();
    applyMessageDefaults(input);
    expect(input.messages?.ackReaction).toBeUndefined();
    expect(input.messages?.ackReactionScope).toBeUndefined();
  });
});
