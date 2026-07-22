#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type TestSuite = {
  suiteId: string;
  version: number;
  description?: string;
  fixtures?: Record<string, string>;
  cases: TestCase[];
};

export type TestCase = {
  id: string;
  group: string;
  title: string;
  requirementRef?: string;
  preconditions?: string[];
  input: {
    prompt: string;
    fixtures?: string[];
  };
  expected?: ExpectedCriteria;
  evidenceToRecord?: string[];
};

type ExpectedCriteria = {
  mustIdentify?: string[];
  mustAskIfMissing?: string[];
  mustInclude?: string[];
  mustCheck?: string[];
  mustAvoid?: string[];
  allowedToolCalls?: string[];
  forbiddenToolCalls?: string[];
  requiredStateChanges?: string[];
  requiredStateChecks?: string[];
};

type CaseResultStatus = "pass" | "fail" | "needs_review" | "error";

type CaseResult = {
  runId: string;
  suiteId: string;
  caseId: string;
  group: string;
  title: string;
  status: CaseResultStatus;
  durationMs: number;
  promptHash: string;
  actualSummary: string;
  passedAssertions: string[];
  failedAssertions: string[];
  manualReviewItems: string[];
  toolCalls: string[];
  evidencePath?: string;
  stdoutPath?: string;
  stderrPath?: string;
  error?: string;
};

type RunState = {
  runId: string;
  suiteId: string;
  casesPath: string;
  startedAt: string;
  updatedAt: string;
  status: "in_progress" | "completed";
  selectedCaseIds: string[];
  completedCaseIds: string[];
  includeFixtures: boolean;
  local: boolean;
  agent?: string;
  sessionPrefix: string;
};

type CliOptions = {
  casesPath: string;
  outDir: string;
  runId: string;
  sessionPrefix: string;
  agent?: string;
  local: boolean;
  includeFixtures: boolean;
  writeLatex: boolean;
  quiet: boolean;
  limit?: number;
  caseIds?: Set<string>;
  resumeRunId?: string;
  resumeLatest: boolean;
  restart: boolean;
  listRuns: boolean;
};

type RunLogger = {
  info: (message: string, meta?: Record<string, string | number | boolean | undefined>) => void;
  step: (message: string) => void;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOG_PREFIX = "[marketing-os/run]";
const AGENT_PROGRESS_INTERVAL_MS = 15_000;
const RUN_STATE_FILE = "run-state.json";
const RESULTS_FILE = "results.jsonl";

function usage(): string {
  return `Usage: node --import tsx scripts/marketing-scenario-runner.ts [options]

Runs the Marketing OS scenario catalog through the local FoxFang CLI and writes official results.

Options:
  --cases <path>          Test catalog path (default: test-fixtures/marketing-os/cases.json)
  --out-dir <path>        Official result root (default: test-results/marketing-os)
  --run-id <id>           Run id (default: timestamp; use with --restart to redo a run)
  --agent <id>            Optional FoxFang agent id
  --session-prefix <text> Session id prefix (default: marketing-os)
  --no-local              Do not pass --local to foxfang agent
  --no-fixtures           Do not include fixture context in prompts
  --case <id>             Run one case id; repeatable
  --limit <n>             Run only the first n selected cases
  --write-latex           Also write latex/generated/marketing-test-summary.csv and .tex
  --quiet                 Reduce progress logging
  --resume [run-id]       Continue an interrupted run (omit id or use "latest" for newest)
  --restart               With --resume/--run-id: wipe that run and start from scratch
  --list-runs             List resumable runs under --out-dir and exit
  --help                  Show this help

Examples:
  # New run from scratch (default)
  node --import tsx scripts/marketing-scenario-runner.ts

  # Continue the latest interrupted run
  node --import tsx scripts/marketing-scenario-runner.ts --resume

  # Continue a specific run id
  node --import tsx scripts/marketing-scenario-runner.ts --resume 2026-06-10_17-22-44-376Z

  # Re-run all cases from the beginning using the same run id folder
  node --import tsx scripts/marketing-scenario-runner.ts --restart --run-id 2026-06-10_17-22-44-376Z

Default command per case:
  pnpm --silent foxfang agent --json --local --session-id <session> --message <prompt>
`;
}

function createRunLogger(options: { runId: string; quiet: boolean }): RunLogger {
  const formatMeta = (meta?: Record<string, string | number | boolean | undefined>) => {
    if (!meta || Object.keys(meta).length === 0) {
      return "";
    }
    return ` ${Object.entries(meta)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ")}`;
  };

  return {
    info(message, meta) {
      if (options.quiet) {
        return;
      }
      console.log(`${LOG_PREFIX} ${message}${formatMeta(meta)}`);
    },
    step(message) {
      console.log(`${LOG_PREFIX} ${message}`);
    },
  };
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    casesPath: "test-fixtures/marketing-os/cases.json",
    outDir: "test-results/marketing-os",
    runId: new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "Z"),
    sessionPrefix: "marketing-os",
    local: true,
    includeFixtures: true,
    writeLatex: false,
    quiet: false,
    resumeLatest: false,
    restart: false,
    listRuns: false,
  };
  const caseIds = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return value;
    };

    switch (arg) {
      case "--cases":
        options.casesPath = next();
        break;
      case "--out-dir":
        options.outDir = next();
        break;
      case "--run-id":
        options.runId = next();
        break;
      case "--agent":
        options.agent = next();
        break;
      case "--session-prefix":
        options.sessionPrefix = next();
        break;
      case "--case":
        caseIds.add(next());
        break;
      case "--limit": {
        const limit = Number.parseInt(next(), 10);
        if (!Number.isFinite(limit) || limit < 1) {
          throw new Error("--limit must be a positive integer");
        }
        options.limit = limit;
        break;
      }
      case "--no-local":
        options.local = false;
        break;
      case "--no-fixtures":
        options.includeFixtures = false;
        break;
      case "--write-latex":
        options.writeLatex = true;
        break;
      case "--quiet":
        options.quiet = true;
        break;
      case "--resume": {
        const maybeRunId = argv[index + 1];
        if (!maybeRunId || maybeRunId.startsWith("--")) {
          options.resumeLatest = true;
          break;
        }
        if (maybeRunId === "latest") {
          options.resumeLatest = true;
          index += 1;
          break;
        }
        options.resumeRunId = maybeRunId;
        index += 1;
        break;
      }
      case "--restart":
        options.restart = true;
        break;
      case "--list-runs":
        options.listRuns = true;
        break;
      case "--help":
        console.log(usage());
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    }
  }

  if (caseIds.size > 0) {
    options.caseIds = caseIds;
  }
  return options;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(path.resolve(repoRoot, filePath), "utf8");
  return JSON.parse(raw) as T;
}

function resolveRunDir(options: Pick<CliOptions, "outDir" | "runId">): string {
  return path.resolve(repoRoot, options.outDir, options.runId);
}

async function loadResultsJsonl(runDir: string): Promise<CaseResult[]> {
  try {
    const raw = await readFile(path.join(runDir, RESULTS_FILE), "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CaseResult);
  } catch {
    return [];
  }
}

async function loadRunState(runDir: string): Promise<RunState | undefined> {
  try {
    const raw = await readFile(path.join(runDir, RUN_STATE_FILE), "utf8");
    return JSON.parse(raw) as RunState;
  } catch {
    return undefined;
  }
}

async function findLatestResumableRun(outDir: string): Promise<string | undefined> {
  const root = path.resolve(repoRoot, outDir);
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return undefined;
  }

  const candidates: Array<{ runId: string; mtime: number }> = [];
  for (const name of entries) {
    const runDir = path.join(root, name);
    try {
      const dirStat = await stat(runDir);
      if (!dirStat.isDirectory()) {
        continue;
      }
      const state = await loadRunState(runDir);
      if (!state || state.status === "completed") {
        continue;
      }
      candidates.push({ runId: name, mtime: dirStat.mtimeMs });
    } catch {
      continue;
    }
  }

  candidates.sort((left, right) => right.mtime - left.mtime);
  return candidates[0]?.runId;
}

async function listResumableRuns(outDir: string): Promise<
  Array<{
    runId: string;
    status: RunState["status"];
    completed: number;
    total: number;
    updatedAt: string;
  }>
> {
  const root = path.resolve(repoRoot, outDir);
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }

  const rows: Array<{
    runId: string;
    status: RunState["status"];
    completed: number;
    total: number;
    updatedAt: string;
    mtime: number;
  }> = [];

  for (const name of entries) {
    const runDir = path.join(root, name);
    try {
      const dirStat = await stat(runDir);
      if (!dirStat.isDirectory()) {
        continue;
      }
      const state = await loadRunState(runDir);
      if (!state) {
        continue;
      }
      rows.push({
        runId: state.runId,
        status: state.status,
        completed: state.completedCaseIds.length,
        total: state.selectedCaseIds.length,
        updatedAt: state.updatedAt,
        mtime: dirStat.mtimeMs,
      });
    } catch {
      continue;
    }
  }

  return rows
    .sort((left, right) => right.mtime - left.mtime)
    .map(({ mtime: _mtime, ...row }) => row);
}

async function clearRunArtifacts(runDir: string): Promise<void> {
  await rm(path.join(runDir, RESULTS_FILE), { force: true });
  await rm(path.join(runDir, RUN_STATE_FILE), { force: true });
  await rm(path.join(runDir, "summary.csv"), { force: true });
  await rm(path.join(runDir, "report.md"), { force: true });
  await rm(path.join(runDir, "artifacts"), { recursive: true, force: true });
}

function orderResults(
  selectedCaseIds: string[],
  resultsByCaseId: Map<string, CaseResult>,
): CaseResult[] {
  return selectedCaseIds
    .map((caseId) => resultsByCaseId.get(caseId))
    .filter((result): result is CaseResult => Boolean(result));
}

function buildRunState(params: {
  options: CliOptions;
  suiteId: string;
  selectedCaseIds: string[];
  completedCaseIds: string[];
  startedAt: string;
  status: RunState["status"];
}): RunState {
  return {
    runId: params.options.runId,
    suiteId: params.suiteId,
    casesPath: params.options.casesPath,
    startedAt: params.startedAt,
    updatedAt: new Date().toISOString(),
    status: params.status,
    selectedCaseIds: params.selectedCaseIds,
    completedCaseIds: params.completedCaseIds,
    includeFixtures: params.options.includeFixtures,
    local: params.options.local,
    agent: params.options.agent,
    sessionPrefix: params.options.sessionPrefix,
  };
}

async function persistRunOutputs(params: {
  runDir: string;
  results: CaseResult[];
  runState: RunState;
  writeLatex: boolean;
}): Promise<void> {
  await writeFile(
    path.join(params.runDir, RESULTS_FILE),
    `${params.results.map((result) => JSON.stringify(result)).join("\n")}\n`,
    "utf8",
  );
  await writeFile(
    path.join(params.runDir, RUN_STATE_FILE),
    `${JSON.stringify(params.runState, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(params.runDir, "summary.csv"), toSummaryCsv(params.results), "utf8");
  await writeFile(path.join(params.runDir, "report.md"), toMarkdownReport(params.results), "utf8");

  if (params.writeLatex) {
    const latexDir = path.resolve(repoRoot, "latex/generated");
    await mkdir(latexDir, { recursive: true });
    await writeFile(
      path.join(latexDir, "marketing-test-summary.csv"),
      toSummaryCsv(params.results),
      "utf8",
    );
    await writeFile(
      path.join(latexDir, "marketing-test-report.tex"),
      toLatexReport(params.results),
      "utf8",
    );
  }
}

function selectCasesFromSuite(params: {
  suite: TestSuite;
  caseIds?: Set<string>;
  limit?: number;
}): TestCase[] {
  let selectedCases = params.caseIds
    ? params.suite.cases.filter((testCase) => params.caseIds?.has(testCase.id))
    : params.suite.cases;
  if (params.limit !== undefined) {
    selectedCases = selectedCases.slice(0, params.limit);
  }
  return selectedCases;
}

function resolveSelectedCaseIds(params: {
  suite: TestSuite;
  options: CliOptions;
  resumeState?: RunState;
}): string[] {
  if (params.options.caseIds && params.options.caseIds.size > 0) {
    return selectCasesFromSuite({
      suite: params.suite,
      caseIds: params.options.caseIds,
      limit: params.options.limit,
    }).map((testCase) => testCase.id);
  }
  if (params.resumeState && !params.options.restart) {
    return params.resumeState.selectedCaseIds;
  }
  return selectCasesFromSuite({
    suite: params.suite,
    caseIds: params.options.caseIds,
    limit: params.options.limit,
  }).map((testCase) => testCase.id);
}

function partitionPendingCases(params: {
  suite: TestSuite;
  selectedCaseIds: string[];
  completedCaseIds: Set<string>;
}): TestCase[] {
  const casesById = new Map(params.suite.cases.map((testCase) => [testCase.id, testCase]));
  return params.selectedCaseIds
    .filter((caseId) => !params.completedCaseIds.has(caseId))
    .map((caseId) => casesById.get(caseId))
    .filter((testCase): testCase is TestCase => Boolean(testCase));
}

async function resolveRunContext(options: CliOptions): Promise<{
  runDir: string;
  resumeState?: RunState;
  existingResults: CaseResult[];
}> {
  if (options.listRuns) {
    return { runDir: "", existingResults: [] };
  }

  if (options.restart && !options.resumeRunId && !options.resumeLatest) {
    const runDir = resolveRunDir(options);
    if (await loadRunState(runDir)) {
      await clearRunArtifacts(runDir);
    }
    return { runDir, existingResults: [] };
  }

  if (options.resumeLatest || options.resumeRunId) {
    const runId = options.resumeRunId ?? (await findLatestResumableRun(options.outDir));
    if (!runId) {
      throw new Error(
        "No resumable run found. Start a new run without --resume, or pass --run-id with --restart.",
      );
    }
    options.runId = runId;
    const runDir = resolveRunDir(options);
    const resumeState = await loadRunState(runDir);
    if (!resumeState) {
      throw new Error(
        `Run state missing for ${runId}. Use --restart --run-id ${runId} to rerun from scratch.`,
      );
    }

    if (options.restart) {
      await clearRunArtifacts(runDir);
      return { runDir, resumeState, existingResults: [] };
    }

    return {
      runDir,
      resumeState,
      existingResults: await loadResultsJsonl(runDir),
    };
  }

  return {
    runDir: resolveRunDir(options),
    existingResults: [],
  };
}

function normalizeForSearch(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

function includesNormalized(text: string, needle: string): boolean {
  return normalizeForSearch(text).includes(normalizeForSearch(needle));
}

function expectedTextMatches(text: string, expectation: string): boolean {
  const alternatives = expectation
    .split(/\s+hoặc\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
  const candidates = alternatives.length > 1 ? alternatives : [expectation];
  return candidates.some((candidate) => includesNormalized(text, candidate));
}

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

function csvEscape(value: string | number): string {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function asObject(value: JsonValue): Record<string, JsonValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : undefined;
}

function collectText(value: JsonValue, depth = 0): string[] {
  if (depth > 8 || value === null) {
    return [];
  }
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectText(item, depth + 1));
  }

  const preferredKeys = new Set(["text", "message", "reply", "output", "content", "visibleText"]);
  const object = asObject(value) ?? {};
  const preferred = Object.entries(object)
    .filter(([key]) => preferredKeys.has(key))
    .flatMap(([, nested]) => collectText(nested, depth + 1));
  if (preferred.length > 0) {
    return preferred;
  }
  return Object.values(object).flatMap((nested) => collectText(nested, depth + 1));
}

function collectVisibleResponseText(value: JsonValue): string[] {
  const object = asObject(value);
  if (object?.payloads) {
    return collectText(object.payloads);
  }
  if (object?.content) {
    return collectText(object.content);
  }
  return collectText(value);
}

function collectToolCalls(value: JsonValue, depth = 0, inCallContainer = false): string[] {
  if (depth > 10 || value === null || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectToolCalls(item, depth + 1, inCallContainer));
  }

  const object = asObject(value) ?? {};
  const names: string[] = [];
  const directName = object.name ?? object.toolName ?? object.tool_name ?? object.function;
  if (
    typeof directName === "string" &&
    (inCallContainer ||
      object.type === "tool_use" ||
      object.type === "tool_call" ||
      object.type === "function_call")
  ) {
    names.push(directName);
  }

  for (const [key, nested] of Object.entries(object)) {
    if (key === "toolCalls" || key === "tool_calls" || key === "calls") {
      names.push(...collectToolCalls(nested, depth + 1, true));
      continue;
    }
    if (typeof nested === "object") {
      names.push(...collectToolCalls(nested, depth + 1));
    }
  }
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

function collectLoggedToolCalls(stderr: string): string[] {
  const names: string[] = [];
  for (const match of stderr.matchAll(/\btool_start\b[^\n]*\btool=([A-Za-z0-9_.:-]+)/g)) {
    const name = match[1]?.trim();
    if (name) {
      names.push(name);
    }
  }
  return [...new Set(names)];
}

function summarizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 260);
}

function tryParseJsonObject(raw: string): JsonValue | undefined {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return undefined;
  }
}

function findAgentJsonCandidates(text: string): JsonValue[] {
  const candidates: JsonValue[] = [];
  const whole = tryParseJsonObject(text);
  if (whole) {
    candidates.push(whole);
  }

  const lines = text.split(/\r?\n/);
  for (let start = 0; start < lines.length; start += 1) {
    const line = lines[start]?.trim() ?? "";
    if (!line.startsWith("{")) {
      continue;
    }
    for (let end = start; end < lines.length; end += 1) {
      const block = lines.slice(start, end + 1).join("\n");
      const parsed = tryParseJsonObject(block);
      if (parsed && asObject(parsed)?.payloads) {
        candidates.push(parsed);
      }
    }
  }

  return candidates;
}

function extractAgentResponse(params: { stdout: string; stderr: string }): {
  parsed?: JsonValue;
  text: string;
  toolCalls: string[];
} {
  const candidates = [
    ...findAgentJsonCandidates(params.stdout),
    ...findAgentJsonCandidates(params.stderr),
  ];
  const parsed = candidates.at(-1);
  if (parsed) {
    const text = collectVisibleResponseText(parsed).join("\n");
    return {
      parsed,
      text,
      toolCalls: [
        ...new Set([...collectToolCalls(parsed), ...collectLoggedToolCalls(params.stderr)]),
      ],
    };
  }

  const fallbackText = params.stdout.trim() || params.stderr.trim();
  return {
    text: fallbackText,
    toolCalls: collectLoggedToolCalls(params.stderr),
  };
}

function formatStringList(items: JsonValue | undefined): string[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatFixtureContext(name: string, data: JsonValue | undefined): string | undefined {
  if (data === undefined || data === null) {
    return undefined;
  }
  const object = asObject(data);
  if (!object) {
    return undefined;
  }

  switch (name) {
    case "brand": {
      const product = asObject(object.product);
      const audience = asObject(object.audience);
      const lines = [
        "Bối cảnh thương hiệu (tham khảo):",
        typeof object.name === "string" ? `- Thương hiệu: ${object.name}` : undefined,
        product?.name ? `- Sản phẩm: ${product.name}` : undefined,
        product?.description ? `- Mô tả sản phẩm: ${product.description}` : undefined,
        audience?.primarySegment ? `- Đối tượng: ${audience.primarySegment}` : undefined,
        formatStringList(object.brandVoice).length > 0
          ? `- Giọng văn: ${formatStringList(object.brandVoice).join(", ")}`
          : undefined,
        formatStringList(object.guardrails).length > 0
          ? `- Ràng buộc: ${formatStringList(object.guardrails).join("; ")}`
          : undefined,
      ].filter(Boolean);
      return lines.length > 1 ? lines.join("\n") : undefined;
    }
    case "metricsWeek1": {
      const channels = Array.isArray(object.channels) ? object.channels : [];
      const lines = [
        "Số liệu chiến dịch tuần 1 (tham khảo):",
        typeof object.period === "string" ? `- Kỳ báo cáo: ${object.period}` : undefined,
        ...channels.flatMap((entry) => {
          const channel = asObject(entry);
          if (!channel) {
            return [];
          }
          const label = typeof channel.channel === "string" ? channel.channel : "unknown";
          return [
            `- ${label}: impressions=${channel.impressions ?? "?"}, ctr=${channel.ctr ?? "?"}, leads=${channel.leads ?? "?"}`,
          ];
        }),
        ...formatStringList(object.notes).map((note) => `- Ghi chú: ${note}`),
      ].filter(Boolean);
      return lines.length > 1 ? lines.join("\n") : undefined;
    }
    case "memorySeed": {
      const shortMemory = asObject(object.shortMemory);
      const longMemory = asObject(object.longMemory);
      const lines = [
        "Ngữ cảnh bộ nhớ (tham khảo):",
        shortMemory?.previousTurn ? `- Lượt trước: ${shortMemory.previousTurn}` : undefined,
        shortMemory?.currentTurn ? `- Yêu cầu hiện tại: ${shortMemory.currentTurn}` : undefined,
        ...(Array.isArray(longMemory?.files)
          ? longMemory.files.flatMap((fileEntry) => {
              const file = asObject(fileEntry);
              if (!file) {
                return [];
              }
              return formatStringList(file.lines).map((line) => `- Memory: ${line}`);
            })
          : []),
      ].filter(Boolean);
      return lines.length > 1 ? lines.join("\n") : undefined;
    }
    case "runtimeContext": {
      return [
        "Bối cảnh runtime (tham khảo):",
        typeof object.suitePurpose === "string" ? `- Mục đích: ${object.suitePurpose}` : undefined,
      ]
        .filter(Boolean)
        .join("\n");
    }
    default:
      return undefined;
  }
}

function buildPrompt(
  testCase: TestCase,
  fixtures: Record<string, JsonValue>,
  includeFixtures: boolean,
): string {
  const contextBlocks =
    includeFixtures && testCase.input.fixtures?.length
      ? testCase.input.fixtures
          .map((name) => formatFixtureContext(name, fixtures[name]))
          .filter((block): block is string => Boolean(block))
      : [];

  return [contextBlocks.join("\n\n"), testCase.input.prompt.trim()].filter(Boolean).join("\n\n");
}

function evaluateCase(params: {
  runId: string;
  suiteId: string;
  testCase: TestCase;
  prompt: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  stdoutPath: string;
  stderrPath: string;
}): CaseResult {
  const {
    parsed,
    text: actualText,
    toolCalls,
  } = extractAgentResponse({
    stdout: params.stdout,
    stderr: params.stderr,
  });
  void parsed;
  const expected = params.testCase.expected ?? {};
  const passedAssertions: string[] = [];
  const failedAssertions: string[] = [];
  const manualReviewItems: string[] = [];

  const checkTextPresence = (label: string, items: string[] | undefined) => {
    for (const item of items ?? []) {
      if (expectedTextMatches(actualText, item)) {
        passedAssertions.push(`${label}: ${item}`);
      } else {
        failedAssertions.push(`${label}: ${item}`);
      }
    }
  };

  checkTextPresence("mustIdentify", expected.mustIdentify);
  checkTextPresence("mustAskIfMissing", expected.mustAskIfMissing);
  checkTextPresence("mustInclude", expected.mustInclude);

  for (const item of expected.mustAvoid ?? []) {
    if (includesNormalized(actualText, item)) {
      failedAssertions.push(`mustAvoid appeared: ${item}`);
    } else {
      passedAssertions.push(`mustAvoid: ${item}`);
    }
  }

  for (const forbidden of expected.forbiddenToolCalls ?? []) {
    if (toolCalls.some((tool) => tool === forbidden || tool.includes(forbidden))) {
      failedAssertions.push(`forbiddenToolCall appeared: ${forbidden}`);
    } else {
      passedAssertions.push(`forbiddenToolCall absent: ${forbidden}`);
    }
  }

  for (const allowed of expected.allowedToolCalls ?? []) {
    if (toolCalls.length === 0) {
      manualReviewItems.push(`allowedToolCall not observable from output: ${allowed}`);
    } else if (toolCalls.some((tool) => tool === allowed || tool.includes(allowed))) {
      passedAssertions.push(`allowedToolCall observed: ${allowed}`);
    } else {
      failedAssertions.push(`allowedToolCall missing: ${allowed}`);
    }
  }

  for (const item of [
    ...(expected.mustCheck ?? []),
    ...(expected.requiredStateChanges ?? []),
    ...(expected.requiredStateChecks ?? []),
  ]) {
    manualReviewItems.push(item);
  }

  const status: CaseResultStatus =
    failedAssertions.length > 0 ? "fail" : manualReviewItems.length > 0 ? "needs_review" : "pass";

  return {
    runId: params.runId,
    suiteId: params.suiteId,
    caseId: params.testCase.id,
    group: params.testCase.group,
    title: params.testCase.title,
    status,
    durationMs: params.durationMs,
    promptHash: hashPrompt(params.prompt),
    actualSummary: summarizeText(actualText || params.stderr),
    passedAssertions,
    failedAssertions,
    manualReviewItems,
    toolCalls,
    evidencePath: params.stdout.trim() ? params.stdoutPath : params.stderrPath,
    stdoutPath: params.stdoutPath,
    stderrPath: params.stderrPath,
  };
}

async function runFoxFangAgent(params: {
  prompt: string;
  testCase: TestCase;
  options: CliOptions;
  logger: RunLogger;
}): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }> {
  const sessionId = `${params.options.sessionPrefix}-${params.options.runId}-${params.testCase.id}`
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "-");
  const args = [
    "--silent",
    "foxfang",
    "agent",
    "--json",
    "--session-id",
    sessionId,
    "--message",
    params.prompt,
  ];
  if (params.options.local) {
    args.splice(4, 0, "--local");
  }
  if (params.options.agent) {
    args.splice(4, 0, "--agent", params.options.agent);
  }

  params.logger.info("spawning agent", {
    case: params.testCase.id,
    session: sessionId,
    promptChars: params.prompt.length,
    local: params.options.local,
    agent: params.options.agent ?? "default",
  });

  const startedAt = Date.now();
  return await new Promise((resolve) => {
    const child = spawn("pnpm", args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let lastProgressAt = startedAt;
    let sawAgentActivity = false;

    const noteActivity = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text.includes("[agent/embedded]") || text.includes('"payloads"')) {
        sawAgentActivity = true;
      }
      const now = Date.now();
      if (now - lastProgressAt >= AGENT_PROGRESS_INTERVAL_MS) {
        params.logger.info("agent still running", {
          case: params.testCase.id,
          elapsedSec: Math.round((now - startedAt) / 1000),
          activity: sawAgentActivity,
        });
        lastProgressAt = now;
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      noteActivity(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      noteActivity(chunk);
    });
    child.on("close", (exitCode) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: exitCode ?? 1,
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("error", (error) => {
      resolve({
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function toSummaryCsv(results: CaseResult[]): string {
  const rows = ["case_id,group,title,status,duration_ms,actual_summary,evidence"];
  for (const result of results) {
    rows.push(
      [
        result.caseId,
        result.group,
        result.title,
        result.status,
        result.durationMs,
        result.actualSummary,
        result.evidencePath ?? result.stdoutPath ?? result.stderrPath ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}

function toMarkdownReport(results: CaseResult[]): string {
  const totals = results.reduce<Record<CaseResultStatus, number>>(
    (acc, result) => {
      acc[result.status] += 1;
      return acc;
    },
    { pass: 0, fail: 0, needs_review: 0, error: 0 },
  );
  const rows = results.map(
    (result) =>
      `| ${result.caseId} | ${result.group} | ${result.status} | ${result.actualSummary.replace(/\|/g, "\\|")} |`,
  );
  return `# Marketing OS test run ${results[0]?.runId ?? "unknown"}

Summary: ${totals.pass} pass, ${totals.fail} fail, ${totals.needs_review} needs review, ${totals.error} error.

| Case | Group | Status | Summary |
|---|---|---|---|
${rows.join("\n")}
`;
}

function toLatexReport(results: CaseResult[]): string {
  const escapeLatex = (value: string) =>
    value
      .replace(/\\/g, "\\textbackslash{}")
      .replace(/&/g, "\\&")
      .replace(/%/g, "\\%")
      .replace(/\$/g, "\\$")
      .replace(/#/g, "\\#")
      .replace(/_/g, "\\_")
      .replace(/{/g, "\\{")
      .replace(/}/g, "\\}");
  const rows = results.map(
    (result) =>
      [
        escapeLatex(result.caseId),
        escapeLatex(result.group),
        escapeLatex(result.status),
        escapeLatex(result.actualSummary),
      ].join(" & ") + "\\\\",
  );
  return `% Generated by scripts/marketing-scenario-runner.ts
\\begin{longtable}{L{0.14\\textwidth}L{0.24\\textwidth}L{0.14\\textwidth}L{0.38\\textwidth}}
\\caption{Tổng hợp kết quả kiểm thử Marketing OS}\\\\
\\toprule
\\textbf{Mã} & \\textbf{Nhóm} & \\textbf{Trạng thái} & \\textbf{Tóm tắt}\\\\
\\midrule
\\endfirsthead
\\toprule
\\textbf{Mã} & \\textbf{Nhóm} & \\textbf{Trạng thái} & \\textbf{Tóm tắt}\\\\
\\midrule
\\endhead
${rows.join("\n")}
\\bottomrule
\\end{longtable}
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.listRuns) {
    const runs = await listResumableRuns(options.outDir);
    if (runs.length === 0) {
      console.log(`${LOG_PREFIX} no resumable runs under ${options.outDir}`);
      return;
    }
    console.log(`${LOG_PREFIX} resumable runs under ${options.outDir}:`);
    for (const run of runs) {
      console.log(
        `- ${run.runId} status=${run.status} progress=${run.completed}/${run.total} updatedAt=${run.updatedAt}`,
      );
    }
    return;
  }

  const logger = createRunLogger({ runId: options.runId, quiet: options.quiet });
  const runContext = await resolveRunContext(options);
  const runDir = runContext.runDir;

  if (options.resumeLatest || options.resumeRunId) {
    logger.step(`resume run-id=${options.runId}`);
    if (options.restart) {
      logger.step(`restart enabled: cleared previous artifacts for ${options.runId}`);
    } else {
      logger.info("loaded completed cases", {
        count: runContext.existingResults.length,
        ids: runContext.existingResults.map((result) => result.caseId).join(",") || "-",
      });
    }
  } else if (options.restart) {
    logger.step(`fresh restart run-id=${options.runId}`);
  } else {
    logger.step(`run-id=${options.runId}`);
  }

  logger.info("loading suite", { casesPath: options.casesPath });

  const suite = await readJsonFile<TestSuite>(options.casesPath);
  const fixtures: Record<string, JsonValue> = {};
  for (const [name, fixturePath] of Object.entries(suite.fixtures ?? {})) {
    fixtures[name] = await readJsonFile<JsonValue>(fixturePath);
    logger.info("loaded fixture", { name, path: fixturePath });
  }

  const selectedCaseIds = resolveSelectedCaseIds({
    suite,
    options,
    resumeState: runContext.resumeState,
  });
  if (selectedCaseIds.length === 0) {
    throw new Error("No test cases selected.");
  }

  const resultsByCaseId = new Map(
    runContext.existingResults.map((result) => [result.caseId, result] as const),
  );
  const completedCaseIds = new Set(resultsByCaseId.keys());
  const pendingCases = partitionPendingCases({
    suite,
    selectedCaseIds,
    completedCaseIds,
  });

  logger.info("selected cases", {
    suiteId: suite.suiteId,
    total: selectedCaseIds.length,
    pending: pendingCases.length,
    completed: completedCaseIds.size,
    ids: selectedCaseIds.join(","),
  });

  if (pendingCases.length === 0) {
    logger.step("nothing to do: all selected cases already completed");
    const results = orderResults(selectedCaseIds, resultsByCaseId);
    await persistRunOutputs({
      runDir,
      results,
      runState: buildRunState({
        options,
        suiteId: suite.suiteId,
        selectedCaseIds,
        completedCaseIds: [...completedCaseIds],
        startedAt: runContext.resumeState?.startedAt ?? new Date().toISOString(),
        status: "completed",
      }),
      writeLatex: options.writeLatex,
    });
    logger.step(`results: ${path.relative(repoRoot, runDir)}`);
    return;
  }

  const artifactsDir = path.join(runDir, "artifacts");
  await mkdir(artifactsDir, { recursive: true });
  logger.info("writing results", { runDir: path.relative(repoRoot, runDir) });

  const startedAt = runContext.resumeState?.startedAt ?? new Date().toISOString();

  for (const [index, testCase] of pendingCases.entries()) {
    const overallIndex = selectedCaseIds.indexOf(testCase.id) + 1;
    logger.step(`[${overallIndex}/${selectedCaseIds.length}] ${testCase.id} — ${testCase.title}`);
    if (testCase.preconditions?.length) {
      logger.info("preconditions (runner metadata only)", {
        case: testCase.id,
        items: testCase.preconditions.join(" | "),
      });
    }

    const prompt = buildPrompt(testCase, fixtures, options.includeFixtures);
    const stdoutPath = path.relative(
      repoRoot,
      path.join(artifactsDir, `${testCase.id}.stdout.txt`),
    );
    const stderrPath = path.relative(
      repoRoot,
      path.join(artifactsDir, `${testCase.id}.stderr.txt`),
    );
    const run = await runFoxFangAgent({ prompt, testCase, options, logger });
    await writeFile(path.resolve(repoRoot, stdoutPath), run.stdout, "utf8");
    await writeFile(path.resolve(repoRoot, stderrPath), run.stderr, "utf8");

    let result: CaseResult;
    if (run.exitCode !== 0) {
      logger.step(`${testCase.id} error exit=${run.exitCode} durationMs=${run.durationMs}`);
      result = {
        runId: options.runId,
        suiteId: suite.suiteId,
        caseId: testCase.id,
        group: testCase.group,
        title: testCase.title,
        status: "error",
        durationMs: run.durationMs,
        promptHash: hashPrompt(prompt),
        actualSummary: summarizeText(run.stderr || run.stdout),
        passedAssertions: [],
        failedAssertions: [],
        manualReviewItems: [],
        toolCalls: [],
        stdoutPath,
        stderrPath,
        error: `foxfang agent exited with code ${run.exitCode}`,
      };
    } else {
      result = evaluateCase({
        runId: options.runId,
        suiteId: suite.suiteId,
        testCase,
        prompt,
        stdout: run.stdout,
        stderr: run.stderr,
        durationMs: run.durationMs,
        stdoutPath,
        stderrPath,
      });
      logger.step(
        `${testCase.id} ${result.status} durationMs=${result.durationMs} passed=${result.passedAssertions.length} failed=${result.failedAssertions.length} review=${result.manualReviewItems.length}`,
      );
      if (result.failedAssertions.length > 0) {
        logger.info("failed assertions", {
          case: testCase.id,
          items: result.failedAssertions.slice(0, 5).join(" | "),
        });
      }
    }

    resultsByCaseId.set(testCase.id, result);
    completedCaseIds.add(testCase.id);
    const results = orderResults(selectedCaseIds, resultsByCaseId);
    const runState = buildRunState({
      options,
      suiteId: suite.suiteId,
      selectedCaseIds,
      completedCaseIds: [...completedCaseIds],
      startedAt,
      status: completedCaseIds.size >= selectedCaseIds.length ? "completed" : "in_progress",
    });
    await persistRunOutputs({
      runDir,
      results,
      runState,
      writeLatex: options.writeLatex && index === pendingCases.length - 1,
    });
    logger.info("checkpoint saved", {
      case: testCase.id,
      progress: `${completedCaseIds.size}/${selectedCaseIds.length}`,
    });
  }

  const finalResults = orderResults(selectedCaseIds, resultsByCaseId);
  const totals = finalResults.reduce<Record<CaseResultStatus, number>>(
    (acc, result) => {
      acc[result.status] += 1;
      return acc;
    },
    { pass: 0, fail: 0, needs_review: 0, error: 0 },
  );
  logger.step(
    `done ${finalResults.length} cases → pass=${totals.pass} fail=${totals.fail} needs_review=${totals.needs_review} error=${totals.error}`,
  );
  logger.step(`results: ${path.relative(repoRoot, runDir)}`);
}

export const __testing = {
  buildPrompt,
  extractAgentResponse,
  includesNormalized,
  expectedTextMatches,
  formatFixtureContext,
  partitionPendingCases,
  orderResults,
  resolveSelectedCaseIds,
  buildRunState,
};

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
