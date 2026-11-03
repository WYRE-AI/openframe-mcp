import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listEnabledTools } from "../domains/index.js";
import { getEnabledTiers } from "../tiers.js";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL };
  delete process.env.OPENFRAME_TOOL_TIERS;
});

describe("OpenFrame MCP tools", () => {
  it("lists read, write, and admin tools according to the enabled tiers", () => {
    const read = listEnabledTools();
    expect(read.length).toBeGreaterThan(0);
    expect(read.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);

    process.env.OPENFRAME_TOOL_TIERS = "read,write,admin";
    const all = listEnabledTools();
    expect(all.length).toBeGreaterThanOrEqual(50);
    expect(new Set(all.map((tool) => tool.name)).size).toBe(all.length);

    process.env.OPENFRAME_TOOL_TIERS = "invalid";
    expect(() => getEnabledTiers()).toThrow();
  });

  it("executes one mocked read tool end to end", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ filters: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.OPENFRAME_API_KEY = "openframe-test-key";
    const result = await callTool("openframe_tool_filters", {});
    expect(result.isError).toBe(false);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]?.type).toBe("text");
    expect(JSON.parse(content[0]?.text ?? "{}")).toEqual({ filters: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
