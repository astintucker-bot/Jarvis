import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE, setGoogleSession } from "../../../../lib/googleCalendar";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error_description");
  const savedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(GOOGLE_VERIFIER_COOKIE)?.value;
  if (error || !code || !state || !savedState || state !== savedState || !verifier) {
    return NextResponse.redirect(new URL(`/?calendar_error=${encodeURIComponent(error || "Google authorization could not be verified.")}`, request.url));
  }
  try {
    const session = await exchangeGoogleCode(request, code, verifier);
    const response = NextResponse.redirect(new URL("/?google_calendar_connected=1", request.url));
    setGoogleSession(response, session);
    const expired = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 0 };
    response.cookies.set(GOOGLE_STATE_COOKIE, "", expired);
    response.cookies.set(GOOGLE_VERIFIER_COOKIE, "", expired);
    return response;
  } catch (caught) {
    return NextResponse.redirect(new URL(`/?calendar_error=${encodeURIComponent(caught instanceof Error ? caught.message : "Google authorization failed.")}`, request.url));
  }
}
