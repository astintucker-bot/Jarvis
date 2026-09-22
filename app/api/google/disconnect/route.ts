import { NextRequest, NextResponse } from "next/server";
import { clearGoogleSession } from "../../../../lib/googleCalendar";
import { requireJarvisAccess } from "../../../../lib/safetyPolicy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = requireJarvisAccess(request, { sideEffect: true });
  if (denied) return denied;
  const response = NextResponse.json({ disconnected: true });
  clearGoogleSession(response);
  return response;
}
