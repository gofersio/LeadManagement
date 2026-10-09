import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/constants";
import { getGmailAuthUrl, getGmailRedirectUri } from "@/lib/gmail/oauth";
import { getAppUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", getAppUrl(request)));
  }

  const redirectUri = getGmailRedirectUri(request);
  const state = randomBytes(32).toString("hex");
  const authUrl = getGmailAuthUrl(state, redirectUri);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
