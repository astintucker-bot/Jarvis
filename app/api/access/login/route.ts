import { NextRequest, NextResponse } from "next/server";
import { isAccessConfigured, setAccessSession, verifyAccessPassword } from "../../../../lib/accessAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAccessConfigured()) return NextResponse.json({ authenticated: true });
  const body = await request.json().catch(() => ({})) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || password.length > 200 || !verifyAccessPassword(password)) {
    return NextResponse.json({ error: "Incorrect Jarvis password." }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true });
  setAccessSession(response);
  return response;
}
