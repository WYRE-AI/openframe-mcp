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

  it("forwards write arguments as the body, excluding path params", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "n1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.OPENFRAME_API_KEY = "openframe-test-key";
    process.env.OPENFRAME_TOOL_TIERS = "read,write";
    const result = await callTool("openframe_ticket_note_add", { id: "t1", content: "hello" });
    expect(result.isError).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toMatch(/\/external-api\/tickets\/t1\/notes$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ content: "hello" });
  });

  it("rejects dot-segment path arguments before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.OPENFRAME_API_KEY = "openframe-test-key";
    process.env.OPENFRAME_TOOL_TIERS = "read,write";
    const result = await callTool("openframe_ticket_note_update", { id: "t1", noteId: "..", content: "x" });
    expect(result.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
