import type { AgentToolResult } from "foxfang/plugin-sdk/agent-runtime";

export function jsonResult(payload: unknown): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}
