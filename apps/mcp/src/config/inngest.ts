/**
 * Inngest configuration - LOCAL ONLY.
 *
 * Inngest runs in local dev mode exclusively. No cloud connections.
 * Run `npx inngest-cli@latest dev` to start the local Inngest dev server.
 */

import { z } from "zod";

/**
 * Inngest configuration schema - local dev mode only.
 */
export const inngestConfigSchema = z.object({
  /** Always true - local dev mode only */
  dev: z.literal(true).default(true),
});

export type InngestConfig = z.infer<typeof inngestConfigSchema>;

/**
 * Inngest configuration - always local dev mode.
 */
export const inngestConfig: InngestConfig = {
  dev: true,
};
