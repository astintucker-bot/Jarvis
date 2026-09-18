import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";

export const MICROSOFT_SESSION_COOKIE = "jarvis_ms_session";
export const MICROSOFT_STATE_COOKIE = "jarvis_ms_oauth_state";
export const MICROSOFT_VERIFIER_COOKIE = "jarvis_ms_pkce";
const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

export type MicrosoftSession = { accessToken: string; refreshToken: string; expiresAt: number; displayName?: string };
export type WordDriveItem = { id: string; name: string; webUrl?: string; lastModifiedDateTime?: string; size?: number; folder?: unknown; file?: unknown };

export class MicrosoftConnectionError extends Error {
  constructor(message = "Connect your Microsoft account before accessing OneDrive Word documents.") { super(message); }
}

class GraphError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function sessionSecret() {
  const value = process.env.MICROSOFT_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("MICROSOFT_SESSION_SECRET must contain at least 32 characters.");
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
  if (bytes.length < 29) throw new Error("Invalid Microsoft session.");
  const decipher = createDecipheriv("aes-256-gcm", sessionSecret(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(inflateRawSync(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()])).toString("utf8")) as T;
}

function tenant() { return process.env.MICROSOFT_TENANT_ID || "common"; }
function redirectUri(request: NextRequest) { return process.env.MICROSOFT_REDIRECT_URI || `${request.nextUrl.origin}/api/microsoft/callback`; }

export function microsoftIsConfigured() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_SESSION_SECRET);
}

export function createMicrosoftAuthorization(request: NextRequest) {
  if (!microsoftIsConfigured()) throw new Error("Microsoft Word access is not configured on the server yet.");
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!, response_type: "code", redirect_uri: redirectUri(request),
    response_mode: "query", scope: "openid profile offline_access Files.ReadWrite", state,
    code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
  });
  return { url: `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${params}`, state, verifier };
}

async function tokenRequest(params: URLSearchParams, fallbackRefreshToken?: string) {
  const response = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params,
  });
  const payload = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  const refreshToken = payload.refresh_token || fallbackRefreshToken;
  if (!response.ok || !payload.access_token || !refreshToken) throw new Error(payload.error_description || "Microsoft authorization failed.");
  return { accessToken: payload.access_token, refreshToken, expiresAt: Date.now() + (payload.expires_in || 3600) * 1000 } satisfies MicrosoftSession;
}

export async function exchangeMicrosoftCode(request: NextRequest, code: string, verifier: string) {
  return tokenRequest(new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!, client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    grant_type: "authorization_code", code, redirect_uri: redirectUri(request), code_verifier: verifier,
  }));
}

async function refreshMicrosoftSession(session: MicrosoftSession) {
  return tokenRequest(new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!, client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    grant_type: "refresh_token", refresh_token: session.refreshToken, scope: "openid profile offline_access Files.ReadWrite",
  }), session.refreshToken);
}

export async function getMicrosoftSession(request: NextRequest) {
  const raw = request.cookies.get(MICROSOFT_SESSION_COOKIE)?.value;
  if (!raw) throw new MicrosoftConnectionError();
  let session: MicrosoftSession;
  try { session = decrypt<MicrosoftSession>(raw); } catch { throw new MicrosoftConnectionError("Your Microsoft connection expired. Please reconnect it."); }
  let refreshed = false;
  if (session.expiresAt < Date.now() + 90_000) {
    try { session = await refreshMicrosoftSession(session); refreshed = true; }
    catch { throw new MicrosoftConnectionError("Your Microsoft connection expired. Please reconnect it."); }
  }
  return { session, refreshed };
}

export function setMicrosoftSession(response: NextResponse, session: MicrosoftSession) {
  response.cookies.set(MICROSOFT_SESSION_COOKIE, encrypt(session), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export function clearMicrosoftSession(response: NextResponse) {
  response.cookies.set(MICROSOFT_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

async function graphFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${GRAPH_ROOT}${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) }, redirect: "follow" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new GraphError(response.status, payload.error?.message || "Microsoft Graph request failed.");
  }
  return response;
}

export async function getMicrosoftProfile(accessToken: string) {
  return (await (await graphFetch(accessToken, "/me?$select=displayName,userPrincipalName")).json()) as { displayName?: string; userPrincipalName?: string };
}

export async function listWordDocuments(accessToken: string, query?: string) {
  const path = query?.trim()
    ? `/me/drive/root/search(q='${encodeURIComponent(query.trim().replace(/'/g, "''"))}')?$select=id,name,webUrl,lastModifiedDateTime,size,file&$top=20`
    : "/me/drive/recent?$select=id,name,webUrl,lastModifiedDateTime,size,file&$top=20";
  const payload = await (await graphFetch(accessToken, path)).json() as { value?: Array<WordDriveItem & { remoteItem?: WordDriveItem }> };
  return (payload.value || []).map(item => item.remoteItem || item).filter(item => /\.docx$/i.test(item.name)).slice(0, 10);
}

export async function downloadDriveItem(accessToken: string, itemId: string) {
  const response = await graphFetch(accessToken, `/me/drive/items/${encodeURIComponent(itemId)}/content`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error("The Word document must be smaller than 10 MB.");
  return bytes;
}

export async function getDriveItem(accessToken: string, itemId: string) {
  const response = await graphFetch(accessToken, `/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,webUrl,lastModifiedDateTime,size,file`);
  return (await response.json()) as WordDriveItem;
}

export async function uploadWordDocument(accessToken: string, filename: string, bytes: Buffer) {
  const stem = filename.replace(/\.docx$/i, "");
  let availableName = filename;
  for (let index = 0; index < 100; index += 1) {
    try {
      await graphFetch(accessToken, `/me/drive/root:/${encodeURIComponent(availableName)}?$select=id`);
      availableName = `${stem} (${index + 2}).docx`;
    } catch (error) {
      if (error instanceof GraphError && error.status === 404) break;
      throw error;
    }
  }
  const response = await graphFetch(accessToken, `/me/drive/root:/${encodeURIComponent(availableName)}:/content`, { method: "PUT", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, body: new Uint8Array(bytes) });
  return (await response.json()) as WordDriveItem;
}

async function getOrCreateDraftFolder(accessToken: string) {
  try { return (await (await graphFetch(accessToken, "/me/drive/root:/JARVIS Drafts?$select=id,name")).json()) as WordDriveItem; }
  catch (error) {
    if (!(error instanceof GraphError) || error.status !== 404) throw error;
    const response = await graphFetch(accessToken, "/me/drive/root/children", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "JARVIS Drafts", folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
    });
    return (await response.json()) as WordDriveItem;
  }
}

type PendingEdit = { targetId: string; targetName: string; draftId: string; exp: number };

function signPendingEdit(data: PendingEdit) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyPendingEdit(token: string) {
  const [body, supplied] = token.split(".");
  if (!body || !supplied) throw new Error("That edit confirmation is invalid.");
  const expected = createHmac("sha256", sessionSecret()).update(body).digest();
  const actual = Buffer.from(supplied, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("That edit confirmation is invalid.");
  const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PendingEdit;
  if (data.exp < Date.now()) throw new Error("That edit confirmation expired. Ask JARVIS to prepare it again.");
  return data;
}

export async function prepareWordEdit(accessToken: string, target: WordDriveItem, bytes: Buffer) {
  const folder = await getOrCreateDraftFolder(accessToken);
  const draftName = `${target.name.replace(/\.docx$/i, "")}-JARVIS-draft-${Date.now()}.docx`;
  const response = await graphFetch(accessToken, `/me/drive/items/${encodeURIComponent(folder.id)}:/${encodeURIComponent(draftName)}:/content`, { method: "PUT", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, body: new Uint8Array(bytes) });
  const draft = (await response.json()) as WordDriveItem;
  return { draft, confirmationToken: signPendingEdit({ targetId: target.id, targetName: target.name, draftId: draft.id, exp: Date.now() + 30 * 60_000 }) };
}

export async function applyWordEdit(accessToken: string, confirmationToken: string) {
  const pending = verifyPendingEdit(confirmationToken);
  const bytes = await downloadDriveItem(accessToken, pending.draftId);
  const response = await graphFetch(accessToken, `/me/drive/items/${encodeURIComponent(pending.targetId)}/content`, { method: "PUT", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, body: new Uint8Array(bytes) });
  const updated = (await response.json()) as WordDriveItem;
  await graphFetch(accessToken, `/me/drive/items/${encodeURIComponent(pending.draftId)}`, { method: "DELETE" }).catch(() => undefined);
  return updated;
}

export async function cancelWordEdit(accessToken: string, confirmationToken: string) {
  const pending = verifyPendingEdit(confirmationToken);
  await graphFetch(accessToken, `/me/drive/items/${encodeURIComponent(pending.draftId)}`, { method: "DELETE" }).catch(() => undefined);
  return { cancelled: true, name: pending.targetName };
}
