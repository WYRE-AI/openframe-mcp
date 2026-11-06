#!/usr/bin/env node
// Smoke test: spawns the built OpenFrame MCP server over stdio against a local mock.
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { spawn } from "node:child_process";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_KEY = "test-key";
const failures = [];

function check(condition, message) {
  if (condition) console.log(`  ok   ${message}`);
  else {
    console.log(`  FAIL ${message}`);
    failures.push(message);
  }
}

const seen = [];
const GATEWAY_KEY = "fake-gateway-header-key";
const ENV_KEY = "fake-env-key-must-not-be-used";
const gatewayKeysSeen = [];
const mock = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    if (req.url.startsWith("/external-api") && req.headers["x-openframe-api-key"] === GATEWAY_KEY) {
      gatewayKeysSeen.push(req.headers["x-openframe-api-key"]);
    } else if (req.headers["x-openframe-api-key"] === ENV_KEY) {
      gatewayKeysSeen.push(ENV_KEY);
    }
    if (req.method !== "GET" || (req.headers["x-openframe-api-key"] !== TEST_KEY && req.headers["x-openframe-api-key"] !== GATEWAY_KEY)) {
      res.writeHead(401);
      res.end(JSON.stringify({ fault: { faultstring: "InvalidApiKey" } }));
      return;
    }
    seen.push({ method: req.method, url: req.url, headers: req.headers });
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, data: { filters: [] } }));
  });
});

await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const mockUrl = `http://127.0.0.1:${mock.address().port}`;

async function withServer(extraEnv, fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(root, "dist/index.js")],
    env: {
      ...getDefaultEnvironment(),
      OPENFRAME_BASE_URL: mockUrl,
      OPENFRAME_API_KEY: TEST_KEY,
      OPENFRAME_TOOL_TIERS: "read",
      AUTH_MODE: "env",
      MCP_TRANSPORT: "stdio",
      LOG_LEVEL: "warn",
      ...extraEnv,
    },
  });
  const client = new Client({ name: "openframe-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    await fn(client);
  } finally {
    await client.close();
  }
}

const textOf = (result) => result.content.map((content) => content.text ?? "").join("");

try {
  console.log("\n[1] default tiers (read only)");
  await withServer({}, async (client) => {
    const { tools } = await client.listTools();
    console.log(`  tools listed: ${tools.length}`);
    check(tools.length > 0, "tools are listed");
    check(tools.every((tool) => tool.annotations?.readOnlyHint === true), "every listed tool is read-only");
    const result = await client.callTool({ name: "openframe_tool_filters", arguments: {} });
    console.log(`  openframe_tool_filters -> ${textOf(result)}`);
    check(!result.isError, "read tool call succeeds");
  });

  console.log("\n[2] all tiers enabled");
  await withServer({ OPENFRAME_TOOL_TIERS: "read,write,admin" }, async (client) => {
    const { tools } = await client.listTools();
    console.log(`  tools listed: ${tools.length}`);
    check(tools.length > 0, "all-tier tools are listed");
  });

  console.log("\n[3] HTTP gateway mode: header credential reaches upstream");
  const gwPort = 18000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [resolve(root, "dist/index.js")], {
    env: {
      ...getDefaultEnvironment(),
      MCP_TRANSPORT: "http",
      MCP_HTTP_PORT: String(gwPort),
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_ALLOW_INSECURE_DEV: "1",
      AUTH_MODE: "gateway",
      OPENFRAME_BASE_URL: mockUrl,
      OPENFRAME_API_KEY: ENV_KEY,
      OPENFRAME_TOOL_TIERS: "read",
      LOG_LEVEL: "error",
    },
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${gwPort}/health`)).ok) break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const rpc = (headers) =>
      fetch(`http://127.0.0.1:${gwPort}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "openframe_tool_filters", arguments: {} } }),
      });
    const ok = await rpc({ "X-OpenFrame-Api-Key": GATEWAY_KEY });
    const okText = await ok.text();
    check(ok.status === 200 && !okText.includes('"isError":true'), "gateway call with mixed-case header succeeds");
    check(gatewayKeysSeen.length === 1 && gatewayKeysSeen[0] === GATEWAY_KEY, "mock upstream received the header credential");
    const missing = await rpc({});
    check(missing.status === 401, "gateway call without header is rejected");
    check(!gatewayKeysSeen.includes(ENV_KEY), "env credential never reached upstream in gateway mode");
  } finally {
    child.kill();
  }
} catch (error) {
  console.error("smoke test crashed:", error);
  failures.push("crash");
} finally {
  await new Promise((resolve) => mock.close(resolve));
}

if (failures.length > 0) {
  console.error(`\nSMOKE FAILED (${failures.length}): ${failures.join("; ")}`);
  process.exit(1);
}
console.log("\nSMOKE PASSED");
