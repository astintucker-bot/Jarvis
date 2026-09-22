import { NextRequest, NextResponse } from "next/server";
import { clearMicrosoftSession } from "../../../../lib/microsoftGraph";
import { requireJarvisAccess } from "../../../../lib/safetyPolicy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = requireJarvisAccess(request, { sideEffect: true });
  if (denied) return denied;
  const response = NextResponse.json({ connected: false });
  clearMicrosoftSession(response);
  return response;
}
