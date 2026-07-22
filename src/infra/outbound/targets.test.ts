import { describe, expect, it } from "vitest";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import { resolveOutboundTarget } from "./targets.js";

// Error-path coverage for outbound channel resolution: delivering to an unknown
// or non-deliverable channel must be rejected before any send is attempted
// ("gui nham kenh" / wrong-channel guard).
describe("resolveOutboundTarget channel rejection (error paths)", () => {
  it("rejects an unsupported/unknown channel", () => {
    const result = resolveOutboundTarget({
      channel: "myspace" as GatewayMessageChannel,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/unsupported channel/i);
    }
  });

  it("rejects delivery to the internal WebChat channel", () => {
    const result = resolveOutboundTarget({
      channel: "webchat" as GatewayMessageChannel,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/webchat/i);
    }
  });

  it("rejects an empty channel id", () => {
    const result = resolveOutboundTarget({
      channel: "" as GatewayMessageChannel,
    });
    expect(result.ok).toBe(false);
  });
});
