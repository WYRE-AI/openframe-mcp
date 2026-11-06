import { TOOL_TIERS } from "./tool-tiers.js";
import type { Tier } from "./utils/types.js";

const DEFAULT_TIERS: readonly Tier[] = ["read"];

export function getEnabledTiers(env: NodeJS.ProcessEnv = process.env): Tier[] {
  const raw = (env.OPENFRAME_TOOL_TIERS ?? "read").trim();
  if (!raw) return [...DEFAULT_TIERS];
  const tiers = raw.split(",").map((tier) => tier.trim().toLowerCase());
  const valid = new Set<Tier>(["read", "write", "admin"]);
  if (tiers.length === 0 || tiers.some((tier) => !valid.has(tier as Tier))) {
    throw new Error(`Invalid OPENFRAME_TOOL_TIERS: ${raw}. Use a comma-separated list of read, write, or admin.`);
  }
  return [...new Set(tiers)] as Tier[];
}

export function isToolEnabled(toolName: string, tiers: readonly Tier[]): boolean {
  const info = TOOL_TIERS[toolName];
  if (!info) throw new Error(`Unknown tool tier: ${toolName}`);
  return tiers.includes(info.tier);
}
