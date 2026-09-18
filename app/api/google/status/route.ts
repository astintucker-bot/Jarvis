import { NextRequest, NextResponse } from "next/server";
import { isAccessAuthorized, isAccessConfigured } from "../../../../lib/accessAuth";
import { getGoogleProfile, getGoogleSession, googleIsConfigured, GoogleConnectionError, setGoogleSession } from "../../../../lib/googleCalendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAccessConfigured() || !isAccessAuthorized(request)) return NextResponse.json({ error: "Unlock Jarvis to continue." }, { status: 401 });
  if (!googleIsConfigured()) return NextResponse.json({ configured: false, connected: false });
  try {
    const { session, refreshed } = await getGoogleSession(request);
    const profile = await getGoogleProfile(session.accessToken);
    const response = NextResponse.json({ configured: true, connected: true, name: profile.name, account: profile.email });
    if (refreshed) setGoogleSession(response, session);
    return response;
  } catch (error) {
    if (error instanceof GoogleConnectionError) return NextResponse.json({ configured: true, connected: false });
    return NextResponse.json({ configured: true, connected: false, error: "Google status is temporarily unavailable." }, { status: 503 });
  }
}
