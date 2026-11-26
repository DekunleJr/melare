import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/*
 * Private links let people act on one record without signing in. A token is
 * `<id>.<signature>`; the signature covers a random per-record nonce and is keyed
 * with the server secret, so the database alone cannot produce a link, yet later
 * emails can rebuild it at any time.
 */
export type TokenKind = "booking" | "order" | "payment" | "unsubscribe" | "cart";

export const newNonce = () => randomBytes(16).toString("hex");

const hmac = (text: string) =>
  createHmac("sha256", env.authSecret).update(text).digest("base64url");

type Signed = { id: number; tokenNonce: string };

export function manageToken(kind: TokenKind, record: Signed): string {
  return `${record.id}.${hmac(`manage:${kind}:${record.id}:${record.tokenNonce}`)}`;
}

const paths: Record<TokenKind, string> = {
  booking: "/manage/booking",
  order: "/manage/order",
  payment: "/pay",
  unsubscribe: "/unsubscribe",
  cart: "/cart/restore",
};

export function manageUrl(kind: TokenKind, record: Signed): string {
  return `${env.siteUrl}${paths[kind]}/${manageToken(kind, record)}`;
}

export function parseTokenId(token: string): number | null {
  const match = /^([1-9]\d{0,9})\.[A-Za-z0-9_-]{43}$/.exec(token);
  return match ? Number(match[1]) : null;
}

function safeEqual(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyToken(kind: TokenKind, token: string, record: Signed): boolean {
  return safeEqual(manageToken(kind, record), token);
}

/** Calendar feed links: "<scope>.<id>.<signature>" */
export type FeedScope = "admin" | "staff" | "user";

export function feedToken(scope: FeedScope, id: string, nonce = ""): string {
  return `${scope}.${id}.${hmac(`calendar:${scope}:${id}:${nonce}`)}`;
}

export function parseFeedToken(token: string) {
  const match = /^(admin|staff|user)\.([A-Za-z0-9_-]{1,40})\.[A-Za-z0-9_-]{43}$/.exec(token);
  return match ? { scope: match[1] as FeedScope, id: match[2] } : null;
}

export function verifyFeedToken(token: string, nonce = ""): boolean {
  const parsed = parseFeedToken(token);
  return parsed !== null && safeEqual(feedToken(parsed.scope, parsed.id, nonce), token);
}

// No 0/O/1/I so references are easy to read out over the phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newReference(prefix: string): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${out}`;
}
