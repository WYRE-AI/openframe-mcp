import { createHmac, timingSafeEqual } from "node:crypto";

export const S2S_HEADER = "x-openframe-s2s";
const HEADER_VALUE_RE = /^t=(\d{1,15}),v1=([0-9a-f]{64})$/;

export function verifyS2sHeader(
  headerValue: string | undefined,
  secret: string,
  maxSkewSeconds = 300,
): boolean {
  if (!secret || !headerValue) return false;
  const match = HEADER_VALUE_RE.exec(headerValue);
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > maxSkewSeconds) return false;
  const expected = createHmac("sha256", secret).update(`t=${timestamp}`).digest();
  const provided = Buffer.from(match[2], "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
