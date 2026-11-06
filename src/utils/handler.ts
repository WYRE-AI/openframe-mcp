/**
 * Shared OpenFrame tool-handler factory.
 */

import type { CallToolResult, DomainHandler, ToolSpec } from "./types.js";
import { executeOpenFrame } from "./client.js";
import { getEnabledTiers, isToolEnabled } from "../tiers.js";
import { TOOL_TIERS } from "../tool-tiers.js";

function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

export function toolArgs(spec: ToolSpec): Record<string, unknown> {
  const schemaProperties = (spec.tool.inputSchema.properties ?? {}) as Record<string, { type?: string }>;
  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(spec.body ?? {})) {
    if (key in schemaProperties) args[key] = value;
  }
  for (const [key, value] of Object.entries((spec.tool.inputSchema.properties ?? {}) as Record<string, unknown>)) {
    if (key in (spec.body ?? {})) continue;
    const property = (schemaProperties as Record<string, { type?: string }>)[key];
    if (property?.type === "string") args[key] = (value as { default?: unknown })?.default;
  }
  return args;
}

export function buildQuery(spec: ToolSpec, args: Record<string, unknown>): string {
  const query = new URLSearchParams();
  const properties = (spec.tool.inputSchema.properties ?? {}) as Record<string, { type?: string }>;
  for (const [key, property] of Object.entries(properties)) {
    const value = args[key];
    if (value === undefined) continue;
    if (property.type === "array") {
      if (Array.isArray(value) && value.length > 0) query.set(key, value.map(String).join(","));
      continue;
    }
    query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export function createDomainHandler(specs: readonly ToolSpec[]): DomainHandler {
  const byName = new Map(specs.map((spec) => [spec.tool.name, spec]));

  return {
    domain: "openframe",
    specs,
    getTools() {
      const enabled = getEnabledTiers();
      return specs.filter((spec) => isToolEnabled(spec.tool.name, enabled)).map((spec) => spec.tool);
    },
    async handleCall(name: string, rawArgs: Record<string, unknown>) {
      const spec = byName.get(name);
      if (!spec) return errorResult(`Unknown tool: ${name}`);
      let enabledTiers: ReturnType<typeof getEnabledTiers>;
      try {
        enabledTiers = getEnabledTiers();
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : "Invalid OPENFRAME_TOOL_TIERS");
      }
      const specForGate = byName.get(name);
      if (!specForGate || !isToolEnabled(name, enabledTiers)) {
        const tier = specForGate?.tool.name ? TOOL_TIERS[specForGate.tool.name]?.tier ?? "unknown" : TOOL_TIERS[name]?.tier ?? "unknown";
        return errorResult(
          `Tool ${name} requires the "${tier}" tier, which is not enabled. Enabled tiers: ${enabledTiers.join(", ")}.`,
        );
      }
      const args = rawArgs ?? {};
      const properties = (spec.tool.inputSchema.properties ?? {}) as Record<string, { type?: string }>;
      const unknown = Object.keys(args).filter((key) => !(key in properties));
      if (unknown.length > 0) {
        return errorResult(`Unknown argument(s) for ${name}: ${unknown.join(", ")}. Allowed: ${Object.keys(properties).join(", ") || "(none)"}.`);
      }
      const required = (spec.tool.inputSchema.required ?? []) as string[];
      const missing = required.filter((key) => args[key] === undefined || args[key] === null);
      if (missing.length > 0) {
        return errorResult(`Missing required argument(s) for ${name}: ${missing.join(", ")}.`);
      }

      const path = spec.path.replace(/\{([^}]+)\}/g, (_match, key: string) => encodeURIComponent(String(args[key] ?? "")));
      const method = spec.method;
      const hasBody = method !== "GET" && method !== "DELETE";
      const result = await executeOpenFrame({
        method,
        path: `${path}${method === "GET" ? buildQuery(spec, args) : ""}`,
        ...(hasBody ? { body: toolArgs(spec) } : {}),
      });
      if (!result.ok) return errorResult(result.error.message);
      if (method === "DELETE") return { content: [{ type: "text", text: JSON.stringify({ success: true }) }], isError: false };
      if (result.ok && (result.data === null || result.data === undefined)) {
        return { content: [{ type: "text", text: JSON.stringify({ success: true }) }], isError: false };
      }
      return { content: [{ type: "text", text: JSON.stringify(result.data) }], isError: false };
    },
  };
}
