import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";

export const GOOGLE_SESSION_COOKIE = "jarvis_google_session";
export const GOOGLE_STATE_COOKIE = "jarvis_google_oauth_state";
export const GOOGLE_VERIFIER_COOKIE = "jarvis_google_pkce";

export type GoogleSession = { accessToken: string; refreshToken: string; expiresAt: number };
export type GoogleCalendarEvent = {
  id: string; summary?: string; description?: string; location?: string; htmlLink?: string; status?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string }; end?: { dateTime?: string; date?: string; timeZone?: string };
  organizer?: { displayName?: string; email?: string; self?: boolean };
  attendees?: Array<{ displayName?: string; email?: string; responseStatus?: string; self?: boolean }>;
};

export class GoogleConnectionError extends Error {
  constructor(message = "Connect Google Calendar before accessing events.") { super(message); }
}

function sessionSecret() {
  const value = process.env.GOOGLE_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("GOOGLE_SESSION_SECRET must contain at least 32 characters.");
  return createHash("sha256").update(value).digest();
}

function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(deflateRawSync(Buffer.from(JSON.stringify(value), "utf8"))), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function decrypt<T>(value: string): T {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < 29) throw new Error("Invalid Google session.");
  const decipher = createDecipheriv("aes-256-gcm", sessionSecret(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(inflateRawSync(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()])).toString("utf8")) as T;
}

function redirectUri(request: NextRequest) { return process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/google/callback`; }

export function googleIsConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_SESSION_SECRET);
}

export function createGoogleAuthorization(request: NextRequest) {
  if (!googleIsConfigured()) throw new Error("Google Calendar access is not configured on the server yet.");
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, response_type: "code", redirect_uri: redirectUri(request),
    scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly", state,
    code_challenge: challenge, code_challenge_method: "S256", access_type: "offline", prompt: "consent",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, state, verifier };
}

async function tokenRequest(params: URLSearchParams, fallbackRefreshToken?: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params,
  });
  const payload = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  const refreshToken = payload.refresh_token || fallbackRefreshToken;
  if (!response.ok || !payload.access_token || !refreshToken) throw new Error(payload.error_description || "Google authorization failed.");
  return { accessToken: payload.access_token, refreshToken, expiresAt: Date.now() + (payload.expires_in || 3600) * 1000 } satisfies GoogleSession;
}

export async function exchangeGoogleCode(request: NextRequest, code: string, verifier: string) {
  return tokenRequest(new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "authorization_code", code, redirect_uri: redirectUri(request), code_verifier: verifier,
  }));
}

async function refreshGoogleSession(session: GoogleSession) {
  return tokenRequest(new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token", refresh_token: session.refreshToken,
  }), session.refreshToken);
}

export async function getGoogleSession(request: NextRequest) {
  const raw = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  if (!raw) throw new GoogleConnectionError();
  let session: GoogleSession;
  try { session = decrypt<GoogleSession>(raw); } catch { throw new GoogleConnectionError("Your Google connection expired. Please reconnect it."); }
  let refreshed = false;
  if (session.expiresAt < Date.now() + 90_000) {
    try { session = await refreshGoogleSession(session); refreshed = true; }
    catch { throw new GoogleConnectionError("Your Google connection expired. Please reconnect it."); }
  }
  return { session, refreshed };
}

export function setGoogleSession(response: NextResponse, session: GoogleSession) {
  response.cookies.set(GOOGLE_SESSION_COOKIE, encrypt(session), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export function clearGoogleSession(response: NextResponse) {
  response.cookies.set(GOOGLE_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

async function googleFetch(accessToken: string, url: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Google Calendar request failed.");
  return response;
}

export async function getGoogleProfile(accessToken: string) {
  return await (await googleFetch(accessToken, "https://www.googleapis.com/oauth2/v3/userinfo")).json() as { name?: string; email?: string };
}

export async function listGoogleCalendarEvents(accessToken: string, start: Date, end: Date) {
  const params = new URLSearchParams({
    timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "50",
  });
  const payload = await (await googleFetch(accessToken, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`)).json() as { items?: GoogleCalendarEvent[] };
  return (payload.items || []).filter(event => event.status !== "cancelled" && !event.attendees?.some(attendee => attendee.self && attendee.responseStatus === "declined"));
}
