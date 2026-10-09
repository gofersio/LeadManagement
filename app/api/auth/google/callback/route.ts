import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { encrypt } from "@/lib/crypto";
import {
  exchangeCodeForTokens,
  getOAuth2Client,
  getGmailRedirectUri,
  hasRequiredGmailScopes,
} from "@/lib/gmail/oauth";
import { prisma } from "@/lib/prisma";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/constants";
import { getAppUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", getAppUrl(request)));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const grantedScope = searchParams.get("scope");
  const storedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const redirectUri = getGmailRedirectUri(request);

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/dashboard/mailboxes?error=invalid_state", getAppUrl(request)),
    );
  }

  if (!hasRequiredGmailScopes(grantedScope)) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/mailboxes?error=missing_gmail_scopes",
        getAppUrl(request),
      ),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Missing tokens from Google");
    }

    if (!hasRequiredGmailScopes(tokens.scope ?? grantedScope)) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/mailboxes?error=missing_gmail_scopes",
          getAppUrl(request),
        ),
      );
    }

    const client = getOAuth2Client(redirectUri);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userInfo = await oauth2.userinfo.get();
    const googleAccountId = userInfo.data.id!;
    const email = userInfo.data.email!;

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await prisma.gmailMailbox.upsert({
      where: {
        userId_googleAccountId: {
          userId: user.profile.id,
          googleAccountId,
        },
      },
      create: {
        userId: user.profile.id,
        googleAccountId,
        email,
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        tokenScope: tokens.scope ?? grantedScope ?? null,
      },
      update: {
        email,
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        tokenScope: tokens.scope ?? grantedScope ?? null,
        isActive: true,
      },
    });

    const response = NextResponse.redirect(
      new URL("/dashboard/mailboxes?connected=1", getAppUrl(request)),
    );
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/mailboxes?error=oauth_failed", getAppUrl(request)),
    );
  }
}
