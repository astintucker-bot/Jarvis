import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, JARVIS_SESSION_COOKIE, JARVIS_SESSION_MAX_AGE, verifyPassword } from "../../../../lib/auth";
import { checkRateLimit, rateLimitResponse, requestIdentity } from "../../../../lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const limit = checkRateLimit("login", requestIdentity(request), 10, 15 * 60 * 1_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  const configuredPassword = process.env.JARVIS_ACCESS_PASSWORD || "";
  if (!configuredPassword) return NextResponse.json({ error: "JARVIS access is not configured. Add JARVIS_ACCESS_PASSWORD in Vercel." }, { status: 503 });

  if (Number(request.headers.get("content-length") || 0) > 2_000) return NextResponse.json({ error: "Invalid request." }, { status: 413 });
  const body = await request.json().catch(() => ({})) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length > 256 || !(await verifyPassword(password, configuredPassword))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: JARVIS_SESSION_COOKIE,
    value: await createSessionToken(configuredPassword),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: JARVIS_SESSION_MAX_AGE,
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
