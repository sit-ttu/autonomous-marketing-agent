import { describe, expect, it } from "vitest";
import type { SandboxToolPolicy } from "./sandbox/types.js";
import { isToolAllowedByPolicyName, isToolAllowedByPolicies } from "./tool-policy-match.js";

// Error-path coverage for the tool-policy filter: a denied tool must be rejected,
// and an allow-list that omits a tool must reject it. This guards the
// "approval-before-write" boundary for sensitive marketing publish tools.
describe("tool policy denial (error paths)", () => {
  it("denies a sensitive marketing publish tool listed in the deny list", () => {
    const policy: SandboxToolPolicy = { deny: ["social_meta_page_publish"] };
    expect(isToolAllowedByPolicyName("social_meta_page_publish", policy)).toBe(false);
    // unrelated tools stay allowed
    expect(isToolAllowedByPolicyName("message", policy)).toBe(true);
  });

  it("denies a whole tool family via a glob deny pattern", () => {
    const policy: SandboxToolPolicy = { deny: ["social_*"] };
    expect(isToolAllowedByPolicyName("social_meta_page_publish", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("social_meta_ads_create", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("create_post_draft", policy)).toBe(true);
  });

  it("rejects a tool that is not on a non-empty allow list", () => {
    // Allow only safe, non-outbound tooling; the publish tool must be filtered out.
    const policy: SandboxToolPolicy = { allow: ["create_post_draft", "adapt_for_channel"] };
    expect(isToolAllowedByPolicyName("create_post_draft", policy)).toBe(true);
    expect(isToolAllowedByPolicyName("social_meta_page_publish", policy)).toBe(false);
  });

  it("lets the deny list win over the allow list for the same tool", () => {
    const policy: SandboxToolPolicy = {
      allow: ["social_meta_page_publish"],
      deny: ["social_meta_page_publish"],
    };
    expect(isToolAllowedByPolicyName("social_meta_page_publish", policy)).toBe(false);
  });

  it("denies a tool when any policy in the chain denies it", () => {
    const broad: SandboxToolPolicy = { allow: ["social_meta_page_publish", "message"] };
    const strict: SandboxToolPolicy = { deny: ["social_meta_page_publish"] };
    expect(isToolAllowedByPolicies("social_meta_page_publish", [broad, strict])).toBe(false);
    expect(isToolAllowedByPolicies("message", [broad, strict])).toBe(true);
  });

  it("allows everything when no policy is supplied (control case)", () => {
    expect(isToolAllowedByPolicyName("social_meta_page_publish", undefined)).toBe(true);
  });
});
