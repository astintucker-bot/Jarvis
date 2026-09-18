import { NextRequest, NextResponse } from "next/server";
import { isAccessAuthorized, isAccessConfigured } from "../../../../lib/accessAuth";
import { createGoogleAuthorization, GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE } from "../../../../lib/googleCalendar";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAccessConfigured() || !isAccessAuthorized(request)) return NextResponse.redirect(new URL("/?calendar_error=Unlock+Jarvis+before+connecting+Google+Calendar.", request.url));
  try {
    const authorization = createGoogleAuthorization(request);
    const response = NextResponse.redirect(authorization.url);
    const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
    response.cookies.set(GOOGLE_STATE_COOKIE, authorization.state, options);
    response.cookies.set(GOOGLE_VERIFIER_COOKIE, authorization.verifier, options);
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL(`/?calendar_error=${encodeURIComponent(error instanceof Error ? error.message : "Google Calendar connection failed.")}`, request.url));
  }
}
