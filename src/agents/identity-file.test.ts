import { describe, expect, it } from "vitest";
import { parseIdentityMarkdown } from "./identity-file.js";

describe("parseIdentityMarkdown", () => {
  it("strips markdown code spans from values and labels", () => {
    const content = [
      "- **Name:** `Samantha`",
      "- `Creature`: Robot",
      "- **`Avatar`**: `avatars/foxfang.png`",
    ].join("\n");
    const parsed = parseIdentityMarkdown(content);
    expect(parsed).toEqual({
      name: "Samantha",
      creature: "Robot",
      avatar: "avatars/foxfang.png",
    });
  });

  it("still treats code-span-wrapped template placeholders as placeholders", () => {
    const content = "- **Avatar:** `(workspace-relative path, http(s) url, or data uri)`";
    const parsed = parseIdentityMarkdown(content);
    expect(parsed).toStrictEqual({});
  });
});
