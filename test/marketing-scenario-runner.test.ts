import { describe, expect, it } from "vitest";
import { __testing, type TestCase } from "../scripts/marketing-scenario-runner.js";

describe("marketing-scenario-runner helpers", () => {
  it("builds a natural prompt without test metadata", () => {
    const testCase: TestCase = {
      id: "BRIEF-001",
      group: "Brief Analysis",
      title: "Phân tích brief chiến dịch ra mắt sản phẩm 14 ngày",
      preconditions: ["Workspace test rỗng"],
      input: {
        prompt:
          "Lập chiến dịch truyền thông 14 ngày cho sản phẩm Green Farm trên Facebook và TikTok.",
        fixtures: ["brand"],
      },
    };

    const prompt = __testing.buildPrompt(testCase, { brand: { name: "Vinamilk" } }, true);

    expect(prompt).not.toMatch(/test case|BRIEF-001|Preconditions|Fixture:/i);
    expect(prompt).toContain("Vinamilk");
    expect(prompt).toContain("Lập chiến dịch truyền thông 14 ngày");
  });

  it("extracts agent JSON from stderr when stdout is empty", () => {
    const stderr = [
      "[agent/embedded] starting",
      "{",
      '  "payloads": [{ "text": "Phân tích brief cho Facebook và TikTok trong 14 ngày." }],',
      '  "meta": { "durationMs": 1000 }',
      "}",
    ].join("\n");

    const extracted = __testing.extractAgentResponse({ stdout: "", stderr });

    expect(extracted.text).toContain("Facebook");
    expect(extracted.toolCalls).toEqual([]);
  });

  it("extracts logged tool calls without treating tool registries as calls", () => {
    const stderr = [
      "[agent/embedded] [agent] 🔧 tool_start runId=run-1 tool=read toolCallId=call_1",
      "{",
      '  "payloads": [{ "text": "Đã tạo bản nháp." }],',
      '  "meta": { "systemPromptReport": { "tools": [{ "name": "marketing_post_publish" }] } }',
      "}",
    ].join("\n");

    const extracted = __testing.extractAgentResponse({ stdout: "", stderr });

    expect(extracted.toolCalls).toEqual(["read"]);
  });

  it("matches expected phrases with flexible normalization", () => {
    expect(__testing.includesNormalized("Cần làm rõ ngân sách media", "ngân sách")).toBe(true);
    expect(__testing.includesNormalized("KPI đích theo số tuyệt đối", "KPI")).toBe(true);
    expect(
      __testing.expectedTextMatches("Cần xác nhận trước khi đăng", "cần phê duyệt hoặc xác nhận"),
    ).toBe(true);
  });

  it("skips completed cases when resuming", () => {
    const suite = {
      suiteId: "marketing-os",
      version: 1,
      cases: [
        { id: "A", group: "g", title: "a", input: { prompt: "a" } },
        { id: "B", group: "g", title: "b", input: { prompt: "b" } },
        { id: "C", group: "g", title: "c", input: { prompt: "c" } },
      ],
    };

    const pending = __testing.partitionPendingCases({
      suite,
      selectedCaseIds: ["A", "B", "C"],
      completedCaseIds: new Set(["A"]),
    });

    expect(pending.map((testCase) => testCase.id)).toEqual(["B", "C"]);
  });

  it("preserves selected case order in results", () => {
    const makeResult = (caseId: string) =>
      ({
        runId: "run-1",
        suiteId: "marketing-os",
        caseId,
        group: "g",
        title: caseId,
        status: "pass",
        durationMs: 1,
        promptHash: "x",
        actualSummary: "",
        passedAssertions: [],
        failedAssertions: [],
        manualReviewItems: [],
        toolCalls: [],
      }) as const;

    const resultsByCaseId = new Map([
      ["B", makeResult("B")],
      ["A", makeResult("A")],
    ]);

    expect(__testing.orderResults(["A", "B", "C"], resultsByCaseId).map((r) => r.caseId)).toEqual([
      "A",
      "B",
    ]);
  });

  it("reuses resume selectedCaseIds when no --case filter is set", () => {
    const suite = {
      suiteId: "marketing-os",
      version: 1,
      cases: [
        { id: "A", group: "g", title: "a", input: { prompt: "a" } },
        { id: "B", group: "g", title: "b", input: { prompt: "b" } },
      ],
    };

    const ids = __testing.resolveSelectedCaseIds({
      suite,
      options: {
        casesPath: "test-fixtures/marketing-os/cases.json",
        outDir: "test-results/marketing-os",
        runId: "run-1",
        sessionPrefix: "marketing-os",
        local: true,
        includeFixtures: true,
        writeLatex: false,
        quiet: false,
        resumeLatest: true,
        restart: false,
        listRuns: false,
      },
      resumeState: {
        runId: "run-1",
        suiteId: "marketing-os",
        casesPath: "test-fixtures/marketing-os/cases.json",
        startedAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
        status: "in_progress",
        selectedCaseIds: ["A"],
        completedCaseIds: ["A"],
        includeFixtures: true,
        local: true,
        sessionPrefix: "marketing-os",
      },
    });

    expect(ids).toEqual(["A"]);
  });

  it("builds run state with progress metadata", () => {
    const state = __testing.buildRunState({
      options: {
        casesPath: "test-fixtures/marketing-os/cases.json",
        outDir: "test-results/marketing-os",
        runId: "run-1",
        sessionPrefix: "marketing-os",
        local: true,
        includeFixtures: true,
        writeLatex: false,
        quiet: false,
        resumeLatest: false,
        restart: false,
        listRuns: false,
      },
      suiteId: "marketing-os",
      selectedCaseIds: ["A", "B"],
      completedCaseIds: ["A"],
      startedAt: "2026-06-10T00:00:00.000Z",
      status: "in_progress",
    });

    expect(state.status).toBe("in_progress");
    expect(state.completedCaseIds).toEqual(["A"]);
    expect(state.selectedCaseIds).toEqual(["A", "B"]);
  });
});
