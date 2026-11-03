/**
 * Shared types for the OpenFrame MCP server.
 */

import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type { Tool, CallToolResult };

export const OPENFRAME_DOMAIN = "openframe" as const;

export type OpenFrameDomain = typeof OPENFRAME_DOMAIN;

export type Tier = "read" | "write" | "admin";

export interface OpenFrameCredentials {
  apiKey: string;
}

export interface ToolSpec {
  tool: Tool;
  operation: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** API path relative to the gateway prefix, with `{param}` placeholders. */
  path: string;
  /** Request body for POST/PUT/PATCH. */
  body?: Record<string, unknown>;
}

export interface DomainHandler {
  readonly domain: OpenFrameDomain;
  readonly specs: readonly ToolSpec[];
  getTools(): Tool[];
  handleCall(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
}
