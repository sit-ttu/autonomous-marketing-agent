# Danh sách khả năng Agent FoxFang (plugin và tool)

Tài liệu này được tổng hợp từ mã nguồn hiện tại trong repo, mô tả **Agent có thể làm gì thông qua các tool khi chạy**. Bộ tool thực tế mà Agent nhìn thấy phụ thuộc: plugin có bật hay không, `tools.profile` / allowlist, chế độ sandbox, kênh phiên hiện tại, nhà cung cấp model, và cờ `optional` của một số tool.

**Điểm lắp ráp (mã nguồn):**

- Công cụ coding + phiên + marketing: `src/agents/pi-tools.ts` → `createFoxFangCodingTools()` → `createFoxFangTools()` (`src/agents/foxfang-tools.ts`)
- Tool từ plugin: `src/plugins/tools.ts` → `resolvePluginTools()`, đăng ký qua `api.registerTool()` trong `extensions/*/index.ts`
- Khả năng tin nhắn kênh: tool `message` + `messageActions` của từng channel plugin (`src/agents/tools/message-tool.ts`, `src/channels/plugins/message-action-discovery.ts`)

**Nguyên tắc an toàn marketing (ràng buộc cứng):** Mọi thao tác publish ra ngoài tuân theo `read-first, draft-first, approval-before-write`. Xem `src/marketing/outbound-guard.ts`, `src/config/types.marketing.ts`.

---

## 1. Tool Agent lõi (built-in)

### 1.1 Workspace và thực thi (Pi coding tools)

`codingTools` từ `@mariozechner/pi-coding-agent`, được bọc theo sandbox/chính sách trong `src/agents/pi-tools.ts`:

| Tên tool               | Mô tả ngắn                                                            |
| ---------------------- | --------------------------------------------------------------------- |
| `read`                 | Đọc file trong workspace (trong sandbox: giới hạn trong sandbox root) |
| `write`                | Ghi file workspace (không dùng được khi sandbox chỉ đọc)              |
| `edit`                 | Sửa file                                                              |
| `grep` / `find` / `ls` | Tìm kiếm, liệt kê thư mục                                             |
| `exec`                 | Chạy lệnh shell (bị ràng buộc bởi chính sách `tools.exec`)            |
| `process`              | Quản lý tiến trình nền của `exec` (khi policy cho phép)               |
| `apply_patch`          | Áp patch trong workspace khi dùng model OpenAI và bật trong cấu hình  |

### 1.2 Tool FoxFang built-in (`createFoxFangTools`)

| Tên tool           | Mô tả ngắn                                                                                                                 | Điều kiện / ghi chú                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `canvas`           | Điều khiển Canvas trên node: `present` / `hide` / `navigate` / `eval` / `snapshot` / `a2ui_push` / `a2ui_reset`            | `src/agents/tools/canvas-tool.ts`                                                   |
| `nodes`            | Node đã ghép nối: `status`, `describe`, duyệt, `notify`, camera/album/quay màn hình, vị trí, thông báo, `run`, `invoke`, … | `src/agents/tools/nodes-tool.ts`                                                    |
| `cron`             | Tác vụ định kỳ: `status`, `list`, `add`, `update`, `remove`, `run`, `runs`, `wake`                                         | `src/agents/tools/cron-tool.ts`                                                     |
| `message`          | Gửi tin và action riêng từng kênh qua Gateway (xem mục 3)                                                                  | Có thể `disableMessageTool`; hỗ trợ `marketingPostDraftId`                          |
| `tts`              | Chuyển văn bản thành giọng nói                                                                                             | Phiên kênh Voice sẽ chặn `tts`                                                      |
| `image_generate`   | Tạo/sửa ảnh; `action=list` liệt kê provider                                                                                | Cần cấu hình image generation                                                       |
| `image`            | Phân tích ảnh bằng model vision (path/URL)                                                                                 | Cần `agentDir`; mô tả khác khi model có vision native                               |
| `pdf`              | Phân tích PDF (native hoặc fallback trích xuất)                                                                            | Cần `agentDir`                                                                      |
| `web_search`       | Tìm kiếm web                                                                                                               | Cần provider tìm kiếm hoặc runtime secret; xung đột với `web_search` native của xAI |
| `web_fetch`        | Lấy nội dung URL                                                                                                           | Có thể dùng runtime Firecrawl                                                       |
| `gateway`          | `restart`, `config.get`, `config.schema.lookup`, `config.apply`, `config.patch`, `update.run`                              | **ownerOnly**                                                                       |
| `agents_list`      | Liệt kê id subagent khả dụng                                                                                               |                                                                                     |
| `sessions_list`    | Liệt kê phiên                                                                                                              |                                                                                     |
| `sessions_history` | Đọc lịch sử phiên                                                                                                          |                                                                                     |
| `sessions_send`    | Gửi tin sang phiên khác                                                                                                    |                                                                                     |
| `sessions_yield`   | Nhường phiên hiện tại                                                                                                      |                                                                                     |
| `sessions_spawn`   | Tạo sub-agent / phiên ACP                                                                                                  | `runtime`: `subagent` \| `acp`                                                      |
| `subagents`        | `list` / `kill` / `steer` sub-agent                                                                                        |                                                                                     |
| `session_status`   | Trạng thái phiên hiện tại                                                                                                  |                                                                                     |

### 1.3 Tool marketing (chỉ FoxFang, `src/agents/tools/marketing-tools.ts`)

Dữ liệu lưu trong marketing JSON store (`src/marketing/store.ts`), **không tự publish ra ngoài**.

| Tên tool                               | Khả năng                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `marketing_post_draft_create`          | Tạo `PostDraft` một kênh (chỉ bản nháp)                                                                                                    |
| `marketing_post_adapt_channels`        | Điều chỉnh copy theo quy tắc từng kênh (facebook, instagram, linkedin, x, telegram, discord, slack, … — xem `src/marketing/cross-post.ts`) |
| `marketing_post_cross_platform_create` | Tạo một `PostDraft` đã adapt cho mỗi nền tảng                                                                                              |
| `marketing_post_request_publish`       | Tạo `Approval` chờ duyệt cho bản nháp                                                                                                      |
| `marketing_approval_resolve`           | Duyệt hoặc từ chối (`approved` / `denied`)                                                                                                 |
| `marketing_post_schedule`              | Gán `scheduledAt` cho bản nháp đã duyệt                                                                                                    |
| `marketing_post_mark_published`        | Đánh dấu `published` sau khi gửi thành công                                                                                                |
| `marketing_brand_upsert`               | Tạo/cập nhật `Brand`                                                                                                                       |
| `marketing_scheduled_publish_due`      | Liệt kê bản nháp đến hạn, đã duyệt, chờ publish và tool gợi ý                                                                              |
| `marketing_store_list`                 | Liệt kê brands / postDrafts / approvals đang chờ gần đây                                                                                   |

**Luồng publish điển hình:**

1. Tạo nháp → `marketing_post_request_publish` → `marketing_approval_resolve` (người vận hành)
2. Facebook Page: `social_meta_page_publish` (plugin, mục 2.1)
3. Kênh khác: `message` + `action=send` + `marketingPostDraftId` (bắt buộc nếu `marketing.requireApprovedDraftForMessageSend=true`)
4. `marketing_post_mark_published`

---

## 2. Tool Agent đăng ký qua plugin

Các tool dưới đây chỉ xuất hiện khi `plugins.enabled`, plugin tương ứng bật trong cấu hình, và vượt qua tool policy. Plugin `optional: true` cần được allowlist rõ ràng.

### 2.1 Marketing và quảng cáo

| Plugin id     | Tên tool                            | Khả năng                                                                       | Bật mặc định |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------------ | ------------ |
| `meta-ads`    | `meta_ads_accounts_list`            | Liệt kê tài khoản quảng cáo (chỉ đọc)                                          | Không        |
|               | `meta_ads_campaigns_list`           | Liệt kê campaign                                                               |              |
|               | `meta_ads_adsets_list`              | Liệt kê ad set                                                                 |              |
|               | `meta_ads_ads_list`                 | Liệt kê ad                                                                     |              |
|               | `meta_ads_insights_get`             | Đọc insights (tài khoản/chiến dịch/nhóm/quảng cáo)                             |              |
|               | `meta_ads_creatives_get`            | Đọc creative                                                                   |              |
|               | `meta_ads_recommendations_generate` | Gợi ý tối ưu dạng văn bản (chỉ đọc)                                            |              |
| `social-post` | `social_meta_page_publish`          | Đăng `PostDraft` **đã duyệt** lên Facebook Page qua Graph API; hỗ trợ `dryRun` | Không        |

Giai đoạn A: **Meta Ads không có thao tác ghi** (không đổi ngân sách, không bật/tắt quảng cáo). `social-post` bắt buộc qua cổng duyệt marketing trước khi publish.

Cấu hình: `extensions/meta-ads/foxfang.plugin.json`, `extensions/social-post/foxfang.plugin.json`; biến môi trường trong `providerAuthEnvVars` của từng plugin.

### 2.2 Bộ nhớ

| Plugin id        | Tên tool        | Khả năng                                                                       |
| ---------------- | --------------- | ------------------------------------------------------------------------------ |
| `memory-core`    | `memory_search` | Tìm ngữ nghĩa trong `MEMORY.md` / `memory/*.md` (và transcript phiên tùy chọn) |
|                  | `memory_get`    | Đọc đoạn file memory theo đường dẫn                                            |
| `memory-lancedb` | `memory_recall` | Truy xuất vector bộ nhớ dài hạn LanceDB                                        |
|                  | `memory_store`  | Ghi bộ nhớ dài hạn                                                             |
|                  | `memory_forget` | Xóa bộ nhớ (GDPR)                                                              |

`memory-core` có `kind: "memory"`, còn cung cấp CLI `foxfang memory` và prompt section — không chỉ hai tool trên.

### 2.3 Tìm kiếm và thu thập web

**Cách A — `web_search` / `web_fetch` lõi:** Các plugin sau gắn vào `web_search` thống nhất qua `api.registerWebSearchProvider()` (chọn bằng `tools.web.search.provider`, …), có thể không có tên tool riêng:

| Plugin id    | Vai trò            |
| ------------ | ------------------ |
| `brave`      | Brave Search API   |
| `duckduckgo` | DuckDuckGo         |
| `exa`        | Exa                |
| `firecrawl`  | Tìm kiếm Firecrawl |
| `google`     | Tìm kiếm Gemini    |
| `perplexity` | Perplexity         |
| `moonshot`   | Tìm kiếm Kimi      |
| `xai`        | Tìm kiếm xAI       |
| `tavily`     | Tavily             |

**Cách B — tool riêng của plugin:**

| Plugin id   | Tên tool           | Khả năng                                       |
| ----------- | ------------------ | ---------------------------------------------- |
| `tavily`    | `tavily_search`    | Tìm Tavily (độ sâu, lọc domain, tóm tắt AI, …) |
|             | `tavily_extract`   | Trích xuất Tavily                              |
| `firecrawl` | `firecrawl_search` | Tìm Firecrawl                                  |
|             | `firecrawl_scrape` | Scrape một trang (phù hợp trang nặng JS)       |

`web_fetch` lõi (`src/agents/tools/web-fetch.ts`) có thể kết hợp runtime Firecrawl.

### 2.4 Trình duyệt, workflow, thoại

| Plugin id    | Tên tool     | Khả năng                                                                                                                                                                                          |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser`    | `browser`    | Điều khiển trình duyệt: `status`, `start`, `stop`, `profiles`, `tabs`, `open`, `focus`, `close`, `snapshot`, `screenshot`, `navigate`, `console`, `pdf`, `upload`, `dialog`, `act` (click/type/…) |
| `lobster`    | `lobster`    | Pipeline Lobster cục bộ: `run` / `resume`; **không đăng ký trong phiên sandbox**                                                                                                                  |
| `llm-task`   | `llm-task`   | Tác vụ LLM JSON chung (có thể validate schema); **optional**                                                                                                                                      |
| `voice-call` | `voice_call` | Gọi điện: `initiate_call`, `continue_call`, `speak_to_user`, `end_call`, `get_status`, …; cần bật trong cấu hình plugin                                                                           |
| `diffs`      | `diffs`      | Tạo URL xem diff / PNG / PDF (cho canvas)                                                                                                                                                         |

### 2.5 GitHub

| Plugin id | Tên tool              | Khả năng                  | Mặc định |
| --------- | --------------------- | ------------------------- | -------- |
| `github`  | `github_create_issue` | Tạo Issue bằng GitHub App | Có       |
|           | `github_list_issues`  | Liệt kê Issue             |          |
|           | `github_add_comment`  | Bình luận Issue           |          |

### 2.6 Feishu (Lark)

Plugin kênh `feishu` đăng ký nhiều tool trong `registerFull` (cần credential ứng dụng Feishu):

| Tên tool                       | Lĩnh vực               |
| ------------------------------ | ---------------------- |
| `feishu_doc`                   | Tài liệu đám mây       |
| `feishu_app_scopes`            | Tra cứu quyền ứng dụng |
| `feishu_chat`                  | Thông tin nhóm chat    |
| `feishu_wiki`                  | Wiki / knowledge base  |
| `feishu_drive`                 | Ổ đám mây              |
| `feishu_perm`                  | Quyền                  |
| `feishu_bitable_get_meta`      | Metadata bảng đa chiều |
| `feishu_bitable_list_fields`   | Danh sách trường       |
| `feishu_bitable_list_records`  | Danh sách bản ghi      |
| `feishu_bitable_get_record`    | Một bản ghi            |
| `feishu_bitable_create_record` | Tạo bản ghi            |
| `feishu_bitable_update_record` | Cập nhật bản ghi       |
| `feishu_bitable_create_app`    | Tạo ứng dụng           |
| `feishu_bitable_create_field`  | Tạo trường             |

Đồng thời có khả năng **kênh**: nhận/gửi tin, thẻ, media, reaction, … (`extensions/feishu/src/channel.ts`).

### 2.7 Plugin khác có tool

| Plugin id  | Tên tool   | Khả năng                                                                             |
| ---------- | ---------- | ------------------------------------------------------------------------------------ |
| `zalouser` | `zalouser` | Tài khoản Zalo cá nhân: `send`, `image`, `link`, `friends`, `groups`, `me`, `status` |
| `tlon`     | `tlon`     | Lệnh kiểu CLI Tlon/Urbit (hoạt động, kênh, danh bạ, nhóm, tin nhắn, …)               |

---

## 3. Tool `message` và khả năng kênh

`message` là cổng gửi ra thống nhất (`src/infra/outbound/message-action-runner.ts`). Giá trị `action` lấy từ bảng toàn cục `CHANNEL_MESSAGE_ACTION_NAMES` (`src/channels/plugins/message-action-names.ts`); **mỗi kênh chỉ bật một phần**.

Action toàn cục (trích): `send`, `broadcast`, `poll`, `react`, `read`, `edit`, `reply`, `thread-reply`, `search`, các action quản trị Discord (`channel-create`, `role-add`, `timeout`, `ban`, …), `upload-file`, `download-file`, …

**Plugin kênh bundled sẵn** (`src/generated/bundled-channel-entries.generated.ts`):

| Kênh id          | Mô tả                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `telegram`       | Telegram Bot                                                                                             |
| `discord`        | Discord (action theo `DiscordActionConfig` từng tài khoản — `extensions/discord/src/channel-actions.ts`) |
| `slack`          | Slack                                                                                                    |
| `signal`         | Signal                                                                                                   |
| `imessage`       | iMessage                                                                                                 |
| `bluebubbles`    | BlueBubbles                                                                                              |
| `feishu`         | Feishu                                                                                                   |
| `line`           | LINE                                                                                                     |
| `irc`            | IRC                                                                                                      |
| `mattermost`     | Mattermost                                                                                               |
| `nextcloud-talk` | Nextcloud Talk                                                                                           |
| `synology-chat`  | Synology Chat                                                                                            |
| `zalo`           | Zalo Bot chính thức (khác `zalouser` tài khoản cá nhân)                                                  |

**Plugin kênh có trong repo nhưng cần bật riêng trong `plugins`:** `whatsapp`, `msteams`, `matrix`, `googlechat`, `twitch`, `nostr`, `tlon`, … (trường `channels` trong `extensions/<id>/foxfang.plugin.json`).

**Tham số marketing:** `message` hỗ trợ `marketingPostDraftId`. Khi `marketing.requireApprovedDraftForMessageSend: true`, `send` không `dryRun` phải gắn `PostDraft` đã duyệt (`src/marketing/outbound-guard.ts`).

---

## 4. Loại extension (không phải tất cả đều là Agent tool)

Nhiều gói trong `extensions/*` là **LLM Provider** (`api.registerProvider`) — dùng để gọi model suy luận, **không** trở thành tên tool Agent, ví dụ:

`anthropic`, `openai`, `google`, `openrouter`, `amazon-bedrock`, `ollama`, `deepseek`, `groq`, `xai`, `moonshot`, `minimax`, `zai`, `chutes`, `huggingface`, `fal`, `copilot-proxy`, `github-copilot`, `litellm`, `vllm`, `sglang`, `volcengine`, `byteplus`, `kimi-coding`, `microsoft-foundry`, `cloudflare-ai-gateway`, `venice`, `together`, `qianfan`, `nvidia`, `modelstudio`, `synthetic`, `opencode`, `opencode-go`, …

Còn plugin **chỉ CLI / Gateway / kênh / chẩn đoán** (thường không `registerTool`), ví dụ: `device-pair`, `phone-control`, `talk-voice`, `diagnostics-otel`, `thread-ownership`, `acpx`, `openshell` — ảnh hưởng ghép nối thiết bị hoặc runtime, không nằm trong bảng tool Agent.

---

## 5. Tra nhanh: tool có hiển thị không?

| Yếu tố                             | Ảnh hưởng                                     |
| ---------------------------------- | --------------------------------------------- |
| `plugins.enabled`                  | `false` → không load tool plugin              |
| `plugins.entries.<id>.enabled`     | Bật/tắt từng plugin                           |
| `tools.profile` / allowlist / deny | Lọc tên tool                                  |
| Sandbox `sandboxed: true`          | Tắt `lobster`; đọc/ghi giới hạn trong sandbox |
| `disableMessageTool`               | Bỏ `message`                                  |
| Không có `agentDir`                | Không có `image` / `pdf`                      |
| Chưa cấu hình web search           | Không có `web_search`                         |
| Model xAI có `web_search` native   | Bỏ `web_search` của FoxFang để tránh trùng    |
| Kênh tin Voice                     | Bỏ `tts`                                      |
| `gateway`                          | Chỉ owner                                     |
| Plugin `optional: true`            | Cần allowlist tên tool hoặc `group:plugins`   |

---

## 6. Ánh xạ vòng lặp marketing sản phẩm

| Giai đoạn        | Tool / plugin chính                                                            |
| ---------------- | ------------------------------------------------------------------------------ |
| Brief / Brand    | `marketing_brand_upsert`, `memory_*`, `read`/`write` workspace                 |
| Strategy / Plan  | Suy luận Agent + `web_search` / plugin nghiên cứu                              |
| Create           | `marketing_post_*`, `marketing_post_adapt_channels`                            |
| Approve          | `marketing_post_request_publish`, `marketing_approval_resolve`                 |
| Publish          | `social_meta_page_publish`, `message(send)` + cổng duyệt                       |
| Measure          | `meta_ads_insights_get`, `read` kênh / phân tích (chỉ đọc)                     |
| Learn / Optimize | `memory_*`, `meta_ads_recommendations_generate` (gợi ý, không tự đổi chi tiêu) |

---

## 7. Chỉ mục mã nguồn

| Chủ đề           | Đường dẫn                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Lắp tool         | `src/agents/foxfang-tools.ts`, `src/agents/pi-tools.ts`                                    |
| Tool plugin      | `src/plugins/tools.ts`                                                                     |
| Tool marketing   | `src/agents/tools/marketing-tools.ts`, `src/marketing/`                                    |
| Duyệt outbound   | `src/marketing/outbound-guard.ts`                                                          |
| Action tin nhắn  | `src/agents/tools/message-tool.ts`, `src/channels/plugins/message-action-names.ts`         |
| Kênh bundled     | `src/generated/bundled-channel-entries.generated.ts`                                       |
| Danh sách plugin | `extensions/*/foxfang.plugin.json`, `extensions/*/index.ts`                                |
| Cấu hình mẫu     | `docs/marketing/agents.example.json`, `docs/marketing/cron-scheduled-publish.example.json` |

_Tài liệu dựa trên mã nguồn repo; sau khi nâng cấp plugin hoặc core, ưu tiên trường `description` trong `index.ts` / từng tool._
