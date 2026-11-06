import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeOpenFrame, getBaseUrl, getCredentials, resolveBaseUrl, resolveGatewayCredentials } from "../utils/client.js";

const ORIGINAL = { ...process.env };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  process.env = { ...ORIGINAL };
  delete process.env.OPENFRAME_BASE_URL;
  delete process.env.OPENFRAME_API_KEY;
  delete process.env.AUTH_MODE;
  delete process.env.OPENFRAME_TOOL_TIERS;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
});

describe("OpenFrame base URL safety", () => {
  it("requires HTTPS except for localhost", () => {
    expect(() => resolveBaseUrl("https://openframe.example.com")).not.toThrow();
    expect(() => resolveBaseUrl("http://localhost:8080")).not.toThrow();
    expect(() => resolveBaseUrl("http://openframe.example.com")).toThrow();
    expect(() => resolveBaseUrl("https://user:secret@openframe.example.com")).toThrow();
    expect(() => resolveBaseUrl("https://openframe.example.com/path#fragment")).toThrow();
  });

  it("defaults to the OpenFrame gateway base URL", () => {
    expect(getBaseUrl({})).toBe("https://openframe.example.com");
  });
});

describe("OpenFrame REST client", () => {
  it("sends the API key in the gateway header and never follows redirects", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ filters: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await executeOpenFrame({
      method: "GET",
      path: "/tools/filters",
      apiKey: "openframe-test-key",
      baseUrl: "https://openframe.example.com",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ filters: [] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://openframe.example.com/external-api/tools/filters");
    expect((init.headers as Record<string, string>)["x-openframe-api-key"]).toBe("openframe-test-key");
    expect(init.redirect).toBe("error");
  });

  it("maps authentication failures without echoing the key", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ fault: { faultstring: "InvalidApiKey" } }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const result = await executeOpenFrame({ method: "GET", path: "/tools", apiKey: "openframe-test-key" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth");
      expect(result.error.message).not.toContain("openframe-test-key");
      expect(result.error.message).toContain("HTTP 401: InvalidApiKey");
    }
  });

  it("surfaces the vendor status on rate limits", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 429)));
    const result = await executeOpenFrame({ method: "GET", path: "/tools", apiKey: "openframe-test-key" });
    expect(!result.ok && result.error.message).toContain("HTTP 429");
  });

  it("returns credentials from gateway headers only in gateway mode", () => {
    expect(resolveGatewayCredentials(() => "openframe-gateway-key")).toEqual({
      credentials: { apiKey: "openframe-gateway-key" },
    });
    expect(getCredentials({ AUTH_MODE: "gateway", OPENFRAME_API_KEY: "openframe-env-key" })).toBeNull();
    expect(getCredentials({ AUTH_MODE: "env", OPENFRAME_API_KEY: "openframe-env-key" })).toEqual({ apiKey: "openframe-env-key" });
  });
});
