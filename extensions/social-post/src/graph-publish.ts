import type { FoxFangConfig } from "foxfang/plugin-sdk/config-runtime";
import { resolveGraphApiVersion, resolvePageAccessToken, resolvePageId } from "./config.js";

export type GraphPublishResult =
  | { ok: true; postId?: string; raw: unknown }
  | { ok: false; error: string; status?: number };

const GRAPH_BASE = "https://graph.facebook.com";

export async function publishPageFeedPost(params: {
  cfg: FoxFangConfig;
  message: string;
  link?: string;
}): Promise<GraphPublishResult> {
  const token = resolvePageAccessToken(params.cfg);
  const pageId = resolvePageId(params.cfg);
  if (!token) {
    return {
      ok: false,
      error:
        "social-post not configured. Set plugins.entries.social-post.config.pageAccessToken or META_PAGE_ACCESS_TOKEN.",
    };
  }
  if (!pageId) {
    return {
      ok: false,
      error: "Page ID required (plugins.entries.social-post.config.pageId).",
    };
  }

  const version = resolveGraphApiVersion(params.cfg);
  const url = new URL(`${GRAPH_BASE}/${version}/${pageId}/feed`);
  const body = new URLSearchParams();
  body.set("access_token", token);
  body.set("message", params.message);
  if (params.link?.trim()) {
    body.set("link", params.link.trim());
  }

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const raw = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || raw.error?.message) {
      return {
        ok: false,
        error: raw.error?.message ?? `Graph publish failed (${res.status})`,
        status: res.status,
      };
    }
    return { ok: true, postId: raw.id, raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
