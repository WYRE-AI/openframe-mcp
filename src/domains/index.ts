/**
 * OpenFrame domain handler index.
 */

import type { CallToolResult, DomainHandler, Tool, ToolSpec } from "../utils/types.js";
import { openframeDomainHandler } from "./openframe.js";

export const DOMAIN_HANDLERS: readonly DomainHandler[] = [openframeDomainHandler];

/** Every ToolSpec, regardless of enabled tiers (used by tests and docs). */
export function getAllSpecs(): readonly ToolSpec[] {
  return openframeDomainHandler.specs;
}

/** Tools whose tier is enabled via OPENFRAME_TOOL_TIERS (default: read). */
export function listEnabledTools(): Tool[] {
  return openframeDomainHandler.getTools();
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  return openframeDomainHandler.handleCall(name, args);
}
