import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import {
  MARKETING_STORE_DIR,
  MARKETING_STORE_FILENAME,
  MARKETING_STORE_VERSION,
} from "./constants.js";
import type {
  Approval,
  Brand,
  Campaign,
  ContentPlan,
  Insight,
  Lead,
  MarketingStore,
  PostDraft,
  Product,
} from "./types.js";

function emptyStore(): MarketingStore {
  return {
    version: MARKETING_STORE_VERSION,
    brands: [],
    products: [],
    campaigns: [],
    contentPlans: [],
    postDrafts: [],
    approvals: [],
    insights: [],
    leads: [],
  };
}

export function resolveMarketingStorePath(stateDir?: string): string {
  const base = stateDir ?? resolveStateDir();
  return path.join(base, MARKETING_STORE_DIR, MARKETING_STORE_FILENAME);
}

export async function loadMarketingStore(stateDir?: string): Promise<MarketingStore> {
  const filePath = resolveMarketingStorePath(stateDir);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as MarketingStore;
    if (parsed?.version !== MARKETING_STORE_VERSION) {
      return emptyStore();
    }
    return {
      ...emptyStore(),
      ...parsed,
      brands: parsed.brands ?? [],
      products: parsed.products ?? [],
      campaigns: parsed.campaigns ?? [],
      contentPlans: parsed.contentPlans ?? [],
      postDrafts: parsed.postDrafts ?? [],
      approvals: parsed.approvals ?? [],
      insights: parsed.insights ?? [],
      leads: parsed.leads ?? [],
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return emptyStore();
    }
    throw err;
  }
}

export async function saveMarketingStore(store: MarketingStore, stateDir?: string): Promise<void> {
  const filePath = resolveMarketingStorePath(stateDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload: MarketingStore = { ...store, version: MARKETING_STORE_VERSION };
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function createMarketingId(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${suffix}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertBrand(brand: Brand, stateDir?: string): Promise<MarketingStore> {
  const store = await loadMarketingStore(stateDir);
  const idx = store.brands.findIndex((b) => b.id === brand.id);
  if (idx >= 0) {
    store.brands[idx] = brand;
  } else {
    store.brands.push(brand);
  }
  await saveMarketingStore(store, stateDir);
  return store;
}

export function findBrand(store: MarketingStore, brandId: string): Brand | undefined {
  return store.brands.find((b) => b.id === brandId);
}

export function findProduct(store: MarketingStore, productId: string): Product | undefined {
  return store.products.find((p) => p.id === productId);
}

export function findCampaign(store: MarketingStore, campaignId: string): Campaign | undefined {
  return store.campaigns.find((c) => c.id === campaignId);
}

export function findPostDraft(store: MarketingStore, draftId: string): PostDraft | undefined {
  return store.postDrafts.find((d) => d.id === draftId);
}

export function findApproval(store: MarketingStore, approvalId: string): Approval | undefined {
  return store.approvals.find((a) => a.id === approvalId);
}
