/** Channel adaptation for cross-platform social drafts (features_cross_platform_social_post.md). */

export type SocialChannelId =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "x"
  | "telegram"
  | "discord"
  | "slack"
  | "generic";

export type ChannelFormatSpec = {
  id: SocialChannelId;
  maxBodyChars: number;
  maxHashtags?: number;
  toneHint: string;
};

export const CHANNEL_FORMAT_SPECS: Record<SocialChannelId, ChannelFormatSpec> = {
  facebook: {
    id: "facebook",
    maxBodyChars: 63206,
    toneHint: "conversational, clear CTA, optional link",
  },
  instagram: {
    id: "instagram",
    maxBodyChars: 2200,
    maxHashtags: 30,
    toneHint: "visual-first caption, hashtags at end",
  },
  linkedin: {
    id: "linkedin",
    maxBodyChars: 3000,
    toneHint: "professional, insight-led, minimal hashtags",
  },
  tiktok: {
    id: "tiktok",
    maxBodyChars: 2200,
    toneHint: "short hook, trending-friendly, light hashtags",
  },
  x: {
    id: "x",
    maxBodyChars: 280,
    toneHint: "punchy, one idea, 1–2 hashtags max",
  },
  telegram: {
    id: "telegram",
    maxBodyChars: 4096,
    toneHint: "direct update, markdown-friendly",
  },
  discord: {
    id: "discord",
    maxBodyChars: 2000,
    toneHint: "community tone, optional thread context",
  },
  slack: {
    id: "slack",
    maxBodyChars: 4000,
    toneHint: "internal/workplace concise update",
  },
  generic: {
    id: "generic",
    maxBodyChars: 10000,
    toneHint: "neutral marketing copy",
  },
};

export function normalizeSocialChannelId(raw: string): SocialChannelId {
  const key = raw.trim().toLowerCase();
  if (key in CHANNEL_FORMAT_SPECS) {
    return key as SocialChannelId;
  }
  if (key === "twitter" || key === "twitter/x") {
    return "x";
  }
  if (key === "fb" || key === "meta" || key === "fanpage") {
    return "facebook";
  }
  if (key === "ig") {
    return "instagram";
  }
  return "generic";
}

function truncateWithEllipsis(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  if (maxChars <= 3) {
    return trimmed.slice(0, maxChars);
  }
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

function limitHashtags(body: string, maxHashtags: number): string {
  const tags = body.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/gu) ?? [];
  if (tags.length <= maxHashtags) {
    return body;
  }
  let remaining = maxHashtags;
  return body.replace(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/gu, (tag) => {
    if (remaining > 0) {
      remaining -= 1;
      return tag;
    }
    return tag.replace("#", "");
  });
}

/**
 * Best-effort adaptation without an LLM: trim length, cap hashtags, prepend tone hint as HTML comment for agents.
 */
export function adaptBodyForChannel(params: { body: string; channel: string; title?: string }): {
  channel: SocialChannelId;
  body: string;
  truncated: boolean;
  spec: ChannelFormatSpec;
} {
  const channelId = normalizeSocialChannelId(params.channel);
  const spec = CHANNEL_FORMAT_SPECS[channelId];
  let body = params.body.trim();
  if (params.title?.trim()) {
    body = `${params.title.trim()}\n\n${body}`;
  }
  if (spec.maxHashtags != null) {
    body = limitHashtags(body, spec.maxHashtags);
  }
  const beforeLen = body.length;
  body = truncateWithEllipsis(body, spec.maxBodyChars);
  const truncated = body.length < beforeLen;
  return { channel: channelId, body, truncated, spec };
}

export function adaptMasterCopyToChannels(params: {
  body: string;
  channels: string[];
  title?: string;
}): Array<{ channel: string; body: string; truncated: boolean; toneHint: string }> {
  const unique = [...new Set(params.channels.map((c) => c.trim()).filter(Boolean))];
  return unique.map((channel) => {
    const adapted = adaptBodyForChannel({ body: params.body, channel, title: params.title });
    return {
      channel,
      body: adapted.body,
      truncated: adapted.truncated,
      toneHint: adapted.spec.toneHint,
    };
  });
}
