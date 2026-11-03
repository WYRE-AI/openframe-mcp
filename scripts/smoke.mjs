#!/usr/bin/env node
// Smoke test: spawns the built OpenFrame MCP server over stdio against a local mock.
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
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
const mock = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    if (req.method !== "GET" || req.headers["x-openframe-api-key"] !== TEST_KEY) {
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
