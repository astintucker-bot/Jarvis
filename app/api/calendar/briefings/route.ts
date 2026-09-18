import { NextRequest, NextResponse } from "next/server";
import { isAccessAuthorized, isAccessConfigured } from "../../../../lib/accessAuth";
import { BriefingEvent, normalizeGoogleEvents, normalizeMicrosoftEvents } from "../../../../lib/calendarBriefings";
import { getGoogleSession, googleIsConfigured, GoogleConnectionError, listGoogleCalendarEvents, setGoogleSession } from "../../../../lib/googleCalendar";
import { getMicrosoftSession, listMicrosoftCalendarEvents, microsoftIsConfigured, MicrosoftConnectionError, setMicrosoftSession } from "../../../../lib/microsoftGraph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAccessConfigured() || !isAccessAuthorized(request)) return NextResponse.json({ error: "Unlock Jarvis to continue." }, { status: 401 });
  const now = new Date(); const end = new Date(now.getTime() + 3 * 24 * 60 * 60_000);
  const connections = {
    microsoft: { configured: microsoftIsConfigured(), connected: false, error: undefined as string | undefined },
    google: { configured: googleIsConfigured(), connected: false, error: undefined as string | undefined },
  };
  let microsoftSession: Awaited<ReturnType<typeof getMicrosoftSession>> | null = null;
  let googleSession: Awaited<ReturnType<typeof getGoogleSession>> | null = null;
  let events: BriefingEvent[] = [];

  if (connections.microsoft.configured) {
    try {
      microsoftSession = await getMicrosoftSession(request);
      events.push(...normalizeMicrosoftEvents(await listMicrosoftCalendarEvents(microsoftSession.session.accessToken, now, end), now));
      connections.microsoft.connected = true;
    } catch (error) {
      connections.microsoft.error = error instanceof MicrosoftConnectionError ? undefined : "Reconnect Microsoft to approve read-only calendar access.";
    }
  }
  if (connections.google.configured) {
    try {
      googleSession = await getGoogleSession(request);
      events.push(...normalizeGoogleEvents(await listGoogleCalendarEvents(googleSession.session.accessToken, now, end), now));
      connections.google.connected = true;
    } catch (error) {
      connections.google.error = error instanceof GoogleConnectionError ? undefined : "Reconnect Google Calendar.";
    }
  }

  events = events.sort((left, right) => left.start.localeCompare(right.start)).slice(0, 8);
  const response = NextResponse.json({ connections, events }, { headers: { "Cache-Control": "private, no-store" } });
  if (microsoftSession?.refreshed) setMicrosoftSession(response, microsoftSession.session);
  if (googleSession?.refreshed) setGoogleSession(response, googleSession.session);
  return response;
}
