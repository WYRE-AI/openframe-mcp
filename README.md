# OpenFrame MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server for the OpenFrame External API. It exposes OpenFrame ticket, device, customer, knowledge-base, log, and integrated-tool operations as MCP tools.

## Installation

```bash
npm install
npm run build
npm start
```

## Configuration

Copy [`.env.example`](.env.example) and set the variables below. The stdio transport reads `OPENFRAME_API_KEY` from the environment and does not use HTTP service-to-service auth.

| Variable | Description |
| --- | --- |
| `OPENFRAME_BASE_URL` | Set this to your OpenFrame gateway URL. The default, `https://openframe.example.com`, is a placeholder. |
| `OPENFRAME_API_KEY` | OpenFrame API key for stdio and `AUTH_MODE=env`. |
| `OPENFRAME_TOOL_TIERS` | Comma-separated `read`, `write`, or `admin`. Defaults to `read`. |
| `AUTH_MODE` | HTTP auth mode: `env` or `gateway`. |
| `CONDUIT_S2S_SECRET` | Gateway service-to-service secret. Required for HTTP gateway mode. |
| `MCP_TRANSPORT` | Transport: `stdio` or `http`. |
| `MCP_HTTP_PORT` | HTTP port. Defaults to `8080`. |
| `MCP_HTTP_HOST` | HTTP bind host. Defaults to loopback. |
| `LOG_LEVEL` | Log level: `debug`, `info`, `warn`, or `error`. |

In `AUTH_MODE=gateway`, `/mcp` requires the `X-OpenFrame-Api-Key` request header carrying the user's OpenFrame API key. Gateway mode never falls back to the environment key.

## Usage

### stdio

```bash
OPENFRAME_BASE_URL=https://openframe.example.com \
OPENFRAME_API_KEY=your-openframe-api-key \
OPENFRAME_TOOL_TIERS=read \
npm start
```

### HTTP

```bash
MCP_TRANSPORT=http \
MCP_HTTP_PORT=8080 \
MCP_HTTP_HOST=127.0.0.1 \
AUTH_MODE=gateway \
CONDUIT_S2S_SECRET=openssl-rand-hex-32 \
OPENFRAME_BASE_URL=https://openframe.example.com \
npm start
```

## Tool tiers

OpenFrame tools are grouped into `read`, `write`, and `admin` tiers. Only enabled tiers are listed or callable. The default is `read`.

## Available tools

The server currently exposes OpenFrame operations for:

- Customers and devices
- Tickets, notes, tags, assignments, transitions, and attachments
- Knowledge-base folders, articles, tags, archive, and deletion
- Logs, integrated tools, and tool filters

## Upstream license

OpenFrame is under the Flamingo AI Unified License v1.1, a custom source-available license. Section 5.1 does not permit offering Flamingo Software as a Commercial Managed Service. Section 5.2 does not permit relicensing. Section 5.3 requires attribution. This MCP server is an independent client of the OpenFrame public API and does not copy Flamingo code.

Any upstream contribution would be subject to the Flamingo AI Unified License v1.1 and its contributing terms. Ask legal before contributing.

This repository is MIT-licensed like the other `*mcp` repositories.

## Development

```bash
npm ci
npm run build
npm test
npm run lint
npm run lint:destructive
npm run smoke
```
