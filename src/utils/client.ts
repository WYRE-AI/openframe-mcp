/**
 * OpenFrame External API REST client.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { OpenFrameCredentials } from "./types.js";

export const DEFAULT_BASE_URL = "https://openframe.example.com";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const GATEWAY_API_KEY_HEADER = "x-openframe-api-key";
export const API_KEY_HEADER = "x-openframe-api-key";
export const API_PREFIX = "/external-api";
const MAX_API_KEY_LENGTH = 512;

export type ClientErrorKind = "config" | "auth" | "http" | "timeout" | "network";

export interface ClientError {
  kind: ClientErrorKind;
  message: string;
}

export type ClientResult =
  | { ok: true; data: unknown }
  | { ok: false; error: ClientError };

export interface OpenFrameRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

const credentialStore = new AsyncLocalStorage<OpenFrameCredentials>();

export function runWithCredentials<T>(credentials: OpenFrameCredentials, fn: () => T): T {
  return credentialStore.run(credentials, fn);
}

function isPlausibleApiKey(value: string): boolean {
  return value.length > 0 && value.length <= MAX_API_KEY_LENGTH && /^[\x21-\x7e]+$/.test(value);
}

export function getCredentials(env: NodeJS.ProcessEnv = process.env): OpenFrameCredentials | null {
  const scoped = credentialStore.getStore();
  if (scoped) return scoped;
  if (env.AUTH_MODE === "gateway") return null;
  const apiKey = (env.OPENFRAME_API_KEY ?? "").trim();
  return isPlausibleApiKey(apiKey) ? { apiKey } : null;
}

export function resolveGatewayCredentials(
  getHeader: (name: string) => string | string[] | undefined,
): { credentials?: OpenFrameCredentials; error?: string } {
  const raw = getHeader(GATEWAY_API_KEY_HEADER);
  const apiKey = typeof raw === "string" ? raw.trim() : "";
  if (!apiKey) {
    return { error: "Missing X-OpenFrame-Api-Key header (gateway mode requires the user API key on every request)." };
  }
  if (!isPlausibleApiKey(apiKey)) {
    return { error: "Invalid X-OpenFrame-Api-Key header value." };
  }
  return { credentials: { apiKey } };
}

export function resolveBaseUrl(raw?: string): string {
  const value = (raw ?? "").trim();
  if (!value) return DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid OPENFRAME_BASE_URL: not a valid URL.");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("Invalid OPENFRAME_BASE_URL: userinfo and fragments are not allowed.");
  }
  const host = url.hostname.toLowerCase();
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Invalid OPENFRAME_BASE_URL: only HTTPS is allowed, except HTTP for localhost.");
  }
  if (url.protocol === "https:" && url.port !== "" && url.port !== "443") {
    throw new Error("Invalid OPENFRAME_BASE_URL: HTTPS must use the default port.");
  }
  if (url.protocol === "http:" && !loopback) {
    throw new Error("Invalid OPENFRAME_BASE_URL: HTTP is allowed only for localhost.");
  }
  return value;
}

export function getBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return resolveBaseUrl(env.OPENFRAME_BASE_URL);
}

function redact(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join("[redacted]") : text;
}

export const AUTH_ERROR_MESSAGE =
  "Invalid or missing OpenFrame API key. Create a key in the OpenFrame gateway and pass it as X-OpenFrame-Api-Key.";

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function executeOpenFrame(request: OpenFrameRequest): Promise<ClientResult> {
  let apiKey = request.apiKey;
  if (!apiKey) {
    const credentials = getCredentials();
    if (!credentials) {
      return { ok: false, error: { kind: "auth", message: "No OpenFrame API key configured. Set OPENFRAME_API_KEY or send X-OpenFrame-Api-Key." } };
    }
    apiKey = credentials.apiKey;
  }

  let url: URL;
  try {
    const baseUrl = request.baseUrl ? resolveBaseUrl(request.baseUrl) : getBaseUrl();
    url = new URL(`${baseUrl.replace(/\/$/, "")}${API_PREFIX}${request.path}`);
  } catch (error) {
    return { ok: false, error: { kind: "config", message: error instanceof Error ? error.message : "Invalid OpenFrame API URL." } };
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  let bodyText: string;
  try {
    response = await fetch(url, {
      method: request.method,
      headers: {
        Accept: "application/json",
        ...(request.body !== undefined ? { "Content-Type": "application/json" } : {}),
        [API_KEY_HEADER]: apiKey,
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
      redirect: "error",
    });
    bodyText = await response.text();
  } catch (error) {
    if (controller.signal.aborted) {
      return { ok: false, error: { kind: "timeout", message: `OpenFrame API request timed out after ${Math.round(timeoutMs / 1000)}s.` } };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { kind: "network", message: `OpenFrame API request failed: ${redact(message, apiKey)}` } };
  } finally {
    clearTimeout(timer);
  }

  const body = tryParseJson(bodyText);
  const fault = isRecord(body) && isRecord(body.fault) ? body.fault : undefined;
  const detail = fault && typeof fault.faultstring === "string" ? `: ${redact(fault.faultstring, apiKey)}` : "";
  if (response.status === 401 || (fault && response.status === 403)) {
    return { ok: false, error: { kind: "auth", message: `${AUTH_ERROR_MESSAGE} (HTTP ${response.status}${detail})` } };
  }
  if (response.status === 429) {
    return { ok: false, error: { kind: "http", message: `OpenFrame API quota or rate limit exceeded (HTTP 429${detail}). Try again later.` } };
  }
  if (!response.ok) {
    return { ok: false, error: { kind: "http", message: `OpenFrame API returned HTTP ${response.status}${detail}` } };
  }
  if (request.method === "DELETE") return { ok: true, data: null };
  if (!isRecord(body)) {
    return { ok: false, error: { kind: "http", message: "OpenFrame API response was not JSON." } };
  }
  return { ok: true, data: body };
}
