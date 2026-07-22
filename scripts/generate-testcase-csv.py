#!/usr/bin/env python3
"""Generate testcase-results.csv from vitest JSON output.

Usage: vitest ... --reporter=json > vitest-output.json
       python3 scripts/generate-testcase-csv.py .temp/vitest-output.json
"""
import json
import sys
from datetime import date
from pathlib import Path

SCOPE_MAP = {
    "Marketing OS Vinamilk real integration": "Phân tích yêu cầu marketing / lập kế hoạch truyền thông",
    "marketing brand-context": "Lưu trạng thái / chuẩn hóa dữ liệu vận hành",
    "marketing approval-gate": "Kiểm soát thao tác cần phê duyệt",
    "marketing cross-post": "Tạo nội dung / chỉnh sửa nội dung theo nền tảng",
    "marketing outbound guard": "Kiểm soát thao tác cần phê duyệt",
    "marketing scheduled publish": "Tạo nội dung / chỉnh sửa nội dung theo nền tảng",
    "marketing post-draft lifecycle": "Tạo nội dung / chỉnh sửa nội dung theo nền tảng",
    "marketing store": "Lưu trạng thái / chuẩn hóa dữ liệu vận hành",
    "cron schedule": "Tạo tác vụ định kỳ / lập lịch",
    "cron schedule > cron with specific seconds (6-field pattern)": "Tạo tác vụ định kỳ / lập lịch",
    "coerceFiniteScheduleNumber": "Tạo tác vụ định kỳ / lập lịch",
    "cron run log": "Tạo tác vụ định kỳ / lập lịch",
    "normalizeCronJobCreate": "Tạo tác vụ định kỳ / lập lịch",
    "normalizeCronJobPatch": "Tạo tác vụ định kỳ / lập lịch",
}


def resolve_scope(suite, ancestors):
    if suite in SCOPE_MAP:
        return SCOPE_MAP[suite]
    for a in reversed(ancestors + [suite]):
        if a in SCOPE_MAP:
            return SCOPE_MAP[a]
    return "Tạo tác vụ định kỳ / lập lịch"


def csv_escape(s):
    if "," in s or '"' in s or "\n" in s:
        return '"' + s.replace('"', '""') + '"'
    return s


def main():
    json_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".temp/vitest-output.json")
    csv_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("latex/generated/testcase-results.csv")
    raw = json_path.read_text()
    data = None
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("{"):
            data = json.loads(line)
            break
    if data is None:
        print("No JSON found", file=sys.stderr)
        sys.exit(1)

    rows = []
    stt = 0
    run_date = date.today().isoformat()
    for tr in data.get("testResults", []):
        for assertion in tr.get("assertionResults", []):
            stt += 1
            ancestors = assertion.get("ancestorTitles", [])
            suite = " > ".join(ancestors) if ancestors else "(no suite)"
            scope_suite = ancestors[0] if ancestors else suite
            title = assertion.get("title", "")
            duration_ms = int(assertion.get("duration", 0))
            status = "pass" if assertion.get("status") == "passed" else "fail"
            scope = resolve_scope(scope_suite, ancestors)
            rows.append((stt, scope, suite, title, status, duration_ms, run_date))

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w") as f:
        f.write("stt,scope,test_suite,testcase,status,duration_ms,run_date\n")
        for stt, scope, suite, title, status, duration_ms, run_date in rows:
            f.write(
                f"{stt},{csv_escape(scope)},{csv_escape(suite)},{csv_escape(title)},{status},{duration_ms},{run_date}\n"
            )
    print(f"Wrote {len(rows)} testcases to {csv_path}")


if __name__ == "__main__":
    main()
