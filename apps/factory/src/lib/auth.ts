import { createHmac, timingSafeEqual } from "node:crypto";
import { FACTORY_PASSWORD, SESSION_SECRET } from "astro:env/server";

export const SESSION_COOKIE = "pf_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const authEnabled = Boolean(FACTORY_PASSWORD);

function sign(value: string): string {
  return createHmac("sha256", SESSION_SECRET || FACTORY_PASSWORD || "").update(value).digest("hex");
}

/** Changing FACTORY_PASSWORD or SESSION_SECRET invalidates existing sessions. */
export function sessionToken(): string {
  return sign(`session:v1:${FACTORY_PASSWORD}`);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(candidate: string): boolean {
  return authEnabled && safeEqual(sign(candidate), sign(FACTORY_PASSWORD!));
}

export function isValidSession(cookie: string | undefined): boolean {
  return !authEnabled || (cookie !== undefined && safeEqual(cookie, sessionToken()));
}
