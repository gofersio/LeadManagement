import type { NextRequest } from "next/server";
import { google } from "googleapis";
import { decrypt, encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
  "profile",
] as const;

export function getGmailRedirectUri(request?: NextRequest | Request): string {
  if (request && process.env.NODE_ENV === "development") {
    return `${new URL(request.url).origin}/api/auth/google/callback`;
  }
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    "http://localhost:3000/api/auth/google/callback"
  );
}

export function getOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri ?? process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getGmailAuthUrl(state: string, redirectUri: string): string {
  const client = getOAuth2Client(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: false,
    scope: [...GMAIL_SCOPES],
    state,
  });
}

export function hasRequiredGmailScopes(scopeString: string | null | undefined): boolean {
  if (!scopeString) return false;
  return (
    scopeString.includes("gmail.send") &&
    (scopeString.includes("gmail.readonly") || scopeString.includes("gmail.modify"))
  );
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const client = getOAuth2Client(redirectUri);
  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
  return tokens;
}

export async function getAuthenticatedGmailClient(mailboxId: string) {
  const mailbox = await prisma.gmailMailbox.findUniqueOrThrow({
    where: { id: mailboxId },
  });

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: decrypt(mailbox.accessTokenEnc),
    refresh_token: decrypt(mailbox.refreshTokenEnc),
    expiry_date: mailbox.tokenExpiresAt.getTime(),
  });

  client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await prisma.gmailMailbox.update({
        where: { id: mailboxId },
        data: {
          accessTokenEnc: encrypt(tokens.access_token),
          tokenExpiresAt: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : new Date(Date.now() + 3600 * 1000),
          ...(tokens.refresh_token
            ? { refreshTokenEnc: encrypt(tokens.refresh_token) }
            : {}),
          ...(tokens.scope ? { tokenScope: tokens.scope } : {}),
        },
      });
    }
  });

  const gmail = google.gmail({ version: "v1", auth: client });
  return { gmail, mailbox, oauth2Client: client };
}
