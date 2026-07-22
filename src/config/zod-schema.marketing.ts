import { z } from "zod";

export const MarketingSchema = z
  .object({
    defaultBrandId: z.string().optional(),
    defaultMetaAdAccountId: z.string().optional(),
    requireBrandContext: z.boolean().optional(),
    brandKitPath: z.string().optional(),
    /** When true, message sends must include marketingPostDraftId with an approved draft. */
    requireApprovedDraftForMessageSend: z.boolean().optional(),
  })
  .strict()
  .optional();
