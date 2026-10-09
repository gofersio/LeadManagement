import { google } from "googleapis";
import { decrypt } from "@/lib/crypto";
import { getOAuth2Client, hasRequiredGmailScopes } from "@/lib/gmail/oauth";
import { prisma } from "@/lib/prisma";

export type ScopeCheckResult = {
  ok: boolean;
  scope: string | null;
  missing: string[];
};

/** Fast scope check using stored token only — no Google API call. */
export function checkMailboxScopesFromStored(
  tokenScope: string | null | undefined,
): ScopeCheckResult {
  if (hasRequiredGmailScopes(tokenScope)) {
    return { ok: true, scope: tokenScope ?? null, missing: [] };
  }

  const scope = tokenScope ?? null;
  return {
    ok: false,
    scope,
    missing: [
      ...(!scope?.includes("gmail.send") ? ["gmail.send"] : []),
      ...(!scope?.includes("gmail.readonly") && !scope?.includes("gmail.modify")
        ? ["gmail.readonly"]
        : []),
    ],
  };
}

/** Full verification — calls Google only when stored scope is missing or invalid. */
export async function verifyMailboxScopes(mailboxId: string): Promise<ScopeCheckResult> {
  const mailbox = await prisma.gmailMailbox.findUniqueOrThrow({
    where: { id: mailboxId },
  });

  const stored = checkMailboxScopesFromStored(mailbox.tokenScope);
  if (stored.ok) return stored;

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: decrypt(mailbox.accessTokenEnc),
    refresh_token: decrypt(mailbox.refreshTokenEnc),
    expiry_date: mailbox.tokenExpiresAt.getTime(),
  });

  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const token = (await client.getAccessToken()).token;
    if (!token) {
      return {
        ok: false,
        scope: mailbox.tokenScope,
        missing: ["gmail.send", "gmail.readonly"],
      };
    }

    const info = await oauth2.tokeninfo({ access_token: token });
    const scope = info.data.scope ?? mailbox.tokenScope ?? null;

    if (scope) {
      await prisma.gmailMailbox.update({
        where: { id: mailboxId },
        data: { tokenScope: scope },
      });
    }

    return checkMailboxScopesFromStored(scope);
  } catch {
    return {
      ok: false,
      scope: mailbox.tokenScope,
      missing: ["gmail.send", "gmail.readonly"],
    };
  }
}

export function isInsufficientScopeError(message: string): boolean {
  return /insufficient authentication scopes|insufficientPermissions|403/i.test(message);
}

/**
 * Google returns `invalid_grant` when a stored OAuth refresh token was revoked,
 * expired, or belongs to a changed Google OAuth client. Retrying cannot repair
 * that state; the mailbox must be reconnected to obtain a new token.
 */
export function isGmailAuthenticationError(message: string): boolean {
  return isInsufficientScopeError(message) || /invalid_grant|invalid credentials|unauthorized/i.test(message);
}
