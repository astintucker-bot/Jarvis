import { NextRequest, NextResponse } from "next/server";
import { isAccessAuthorized, isAccessConfigured } from "../../../../lib/accessAuth";
import { getMicrosoftProfile, getMicrosoftSession, microsoftIsConfigured, MicrosoftConnectionError, setMicrosoftSession } from "../../../../lib/microsoftGraph";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAccessConfigured() || !isAccessAuthorized(request)) return NextResponse.json({ error: "Unlock Jarvis to continue." }, { status: 401 });
  if (!microsoftIsConfigured()) return NextResponse.json({ configured: false, connected: false });
  try {
    const { session, refreshed } = await getMicrosoftSession(request);
    const profile = await getMicrosoftProfile(session.accessToken);
    const response = NextResponse.json({ configured: true, connected: true, name: profile.displayName, account: profile.userPrincipalName });
    if (refreshed) setMicrosoftSession(response, session);
    return response;
  } catch (error) {
    if (error instanceof MicrosoftConnectionError) return NextResponse.json({ configured: true, connected: false });
    return NextResponse.json({ configured: true, connected: false, error: "Microsoft status is temporarily unavailable." }, { status: 503 });
  }
}
