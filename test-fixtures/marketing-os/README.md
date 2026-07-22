# Marketing OS sample test cases

Thư mục này chứa bộ test case mẫu cho đồ án FoxFang Marketing OS.

- `brand-vinamilk.json`: dữ liệu thương hiệu/sản phẩm kiểm thử dựa trên website chính thức Vinamilk.
- `metrics-week-1.json`: số liệu chiến dịch giả lập để test báo cáo.
- `runtime-context.json`: dữ liệu giả lập cho auth provider, gateway, kênh, pairing, skill và runtime policy.
- `memory-seed.json`: dữ liệu short memory/long memory giả lập để thiết kế case truy xuất ngữ cảnh.
- `cases.json`: catalog test case có input, precondition (metadata runner), expected criteria và evidence cần ghi nhận.
- `summary-template.csv`: mẫu bảng tổng hợp thủ công nếu cần rà soát trước khi chạy tự động.

Các case này đánh giá theo tiêu chí đạt, không so khớp nguyên văn output của LLM. Prompt gửi tới agent **không** chứa mã case (`BRIEF-001`, …), preconditions hay nhãn `Fixture:` — runner chỉ ghép bối cảnh fixture dạng văn bản tự nhiên với `input.prompt`. Hiện catalog bao gồm cả case agent-facing và case kiểm thử thủ công/fixture cho auth provider, auth gateway, pair/connect channel, plugin, config, agent/session, message, cron, device/node, webhook, directory, hook, secret, sandbox, backup, media/web/browser, voice/MCP/ACP, short memory, long memory và marketing agent. Khi chạy thật, dùng `scripts/marketing-scenario-runner.ts` để lưu kết quả chính thức vào `test-results/marketing-os/<run-id>/`. Nếu cần đưa bảng vào luận văn, chạy thêm tùy chọn `--write-latex` để tạo file trong `latex/generated/`.

## Chạy, tiếp tục và chạy lại

Mỗi lần chạy ghi checkpoint vào `test-results/marketing-os/<run-id>/run-state.json` và `results.jsonl` sau từng case. Nếu bị dừng giữa chừng (Ctrl+C, lỗi mạng, gateway tắt), có thể tiếp tục hoặc chạy lại từ đầu:

```bash
# Chạy mới (mặc định, tạo run-id theo timestamp)
node --import tsx scripts/marketing-scenario-runner.ts

# Tiếp tục run bị gián đoạn gần nhất
node --import tsx scripts/marketing-scenario-runner.ts --resume

# Tiếp tục một run-id cụ thể
node --import tsx scripts/marketing-scenario-runner.ts --resume 2026-06-10_17-22-44-376Z

# Xem các run có thể resume
node --import tsx scripts/marketing-scenario-runner.ts --list-runs

# Chạy lại từ đầu trong cùng thư mục run-id (xóa kết quả cũ)
node --import tsx scripts/marketing-scenario-runner.ts --restart --run-id 2026-06-10_17-22-44-376Z
```

Khi `--resume`, runner bỏ qua các case đã có trong `results.jsonl` và chỉ chạy case còn lại. Khi `--restart`, runner xóa artifact cũ (`results.jsonl`, `run-state.json`, `artifacts/`, …) rồi chạy lại toàn bộ danh sách case đã chọn.

Nguồn fixture Vinamilk: `https://www.vinamilk.com.vn/`, trang `/about-us`, `/technology` và trang sản phẩm Green Farm được dùng làm dữ liệu mô phỏng cho đồ án.
