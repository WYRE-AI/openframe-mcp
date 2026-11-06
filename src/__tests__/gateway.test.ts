import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { startHttpTransport } from "../index.js";
import { resolveGatewayCredentials, runWithCredentials, getCredentials } from "../utils/client.js";

const ORIGINAL = { ...process.env };
const ENV_KEY = "fake-env-key-must-not-be-used";
const HEADER_KEY = "fake-gateway-header-key";
const UPSTREAM = "http://127.0.0.1:1";

let server: HttpServer | undefined;
let upstreamKeys: Array<string | undefined>;

beforeEach(() => {
  process.env = { ...ORIGINAL };
  process.env.AUTH_MODE = "gateway";
  process.env.OPENFRAME_API_KEY = ENV_KEY;
  process.env.OPENFRAME_BASE_URL = UPSTREAM;
  process.env.OPENFRAME_TOOL_TIERS = "read";
  process.env.MCP_HTTP_PORT = "0";
  process.env.MCP_ALLOW_INSECURE_DEV = "1";
  delete process.env.CONDUIT_S2S_SECRET;
  upstreamKeys = [];
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith(UPSTREAM)) {
      upstreamKeys.push((init?.headers as Record<string, string>)["x-openframe-api-key"]);
      return new Response(JSON.stringify({ ok: true, data: { filters: [] } }), { status: 200 });
    }
    return realFetch(input, init);
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
  process.env = { ...ORIGINAL };
});

async function callTool(headers: Record<string, string>): Promise<Response> {
  server = await startHttpTransport();
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "openframe_tool_filters", arguments: {} },
    }),
  });
}

describe("gateway mode credentials", () => {
  it("passes the header credential (mixed-case header name) to the upstream request", async () => {
    const res = await callTool({ "X-OpenFrame-Api-Key": HEADER_KEY });
    expect(res.status).toBe(200);
    expect(upstreamKeys).toEqual([HEADER_KEY]);
  });

  it("never uses the env credential: missing header is rejected, no upstream call", async () => {
    const res = await callTool({});
    expect(res.status).toBe(401);
    expect(upstreamKeys).toEqual([]);
  });

  it("looks up header names case-insensitively", () => {
    const headers: Record<string, string> = { "x-openframe-api-key": HEADER_KEY };
    const lookup = (name: string) => headers[name.toLowerCase()];
    expect(resolveGatewayCredentials(lookup).credentials).toEqual({ apiKey: HEADER_KEY });
  });

  it("getCredentials ignores env in gateway mode outside a request scope", () => {
    expect(getCredentials()).toBeNull();
    expect(runWithCredentials({ apiKey: HEADER_KEY }, () => getCredentials())).toEqual({ apiKey: HEADER_KEY });
  });
});
