import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "jarvis_access";
const ACCESS_VERSION = "jarvis-access-v1";

export function isAccessConfigured() {
  return Boolean(process.env.JARVIS_ACCESS_PASSWORD?.trim());
}

function expectedToken() {
  const password = process.env.JARVIS_ACCESS_PASSWORD?.trim();
  if (!password) return null;
  return createHmac("sha256", password).update(ACCESS_VERSION).digest("base64url");
}

function safelyEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function isAccessAuthorized(request: NextRequest) {
  const expected = expectedToken();
  if (!expected) return true;
  const supplied = request.cookies.get(ACCESS_COOKIE)?.value || "";
  return safelyEqual(supplied, expected);
}

export function verifyAccessPassword(candidate: string) {
  const expected = process.env.JARVIS_ACCESS_PASSWORD?.trim();
  return Boolean(expected && safelyEqual(candidate, expected));
}

export function setAccessSession(response: NextResponse) {
  const token = expectedToken();
  if (!token) return;
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
