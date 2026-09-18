import { NextRequest, NextResponse } from "next/server";
import { isAccessAuthorized, isAccessConfigured } from "../../../../lib/accessAuth";
import { createMicrosoftAuthorization, MICROSOFT_STATE_COOKIE, MICROSOFT_VERIFIER_COOKIE } from "../../../../lib/microsoftGraph";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAccessConfigured() || !isAccessAuthorized(request)) return NextResponse.redirect(new URL("/?calendar_error=Unlock+Jarvis+before+connecting+Microsoft.", request.url));
  try {
    const authorization = createMicrosoftAuthorization(request);
    const response = NextResponse.redirect(authorization.url);
    const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
    response.cookies.set(MICROSOFT_STATE_COOKIE, authorization.state, options);
    response.cookies.set(MICROSOFT_VERIFIER_COOKIE, authorization.verifier, options);
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL(`/?word_error=${encodeURIComponent(error instanceof Error ? error.message : "Microsoft Word connection failed.")}`, request.url));
  }
}
