import { ConnectGmailLink } from "@/components/mailboxes/connect-gmail-link";

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  missing_gmail_scopes: {
    title: "Gmail permissions were not granted",
    body: "Google returned without gmail.send / gmail.readonly. On the warning screen click Advanced → Go to Gofer Outreach (unsafe), then approve all Gmail permissions. Also add your email as a Test user in Google Cloud → Audience.",
  },
  invalid_state: {
    title: "Session expired",
    body: "Please click Connect Gmail again.",
  },
  oauth_failed: {
    title: "OAuth failed",
    body: "Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and redirect URI in .env.local match Google Cloud Console.",
  },
};

export function MailboxAlerts({
  connected,
  error,
}: {
  connected?: string;
  error?: string;
}) {
  if (connected) {
    return (
      <div className="mb-4 p-4 bg-primary-fixed text-primary rounded text-body-md">
        Gmail connected successfully with send + read permissions.
      </div>
    );
  }

  if (!error) return null;

  const info = ERROR_MESSAGES[error] ?? {
    title: "Connection failed",
    body: "Please try again.",
  };

  return (
    <div className="mb-4 p-4 bg-error-container text-on-error-container rounded space-y-2">
      <p className="font-bold text-body-md">{info.title}</p>
      <p className="text-body-sm">{info.body}</p>
      {error === "missing_gmail_scopes" && (
        <ConnectGmailLink className="mt-2">Try again</ConnectGmailLink>
      )}
    </div>
  );
}

export function GoogleOAuthHelp({ redirectUri }: { redirectUri: string }) {
  return (
    <div className="mb-6 p-6 bg-surface-container-low border border-outline-variant rounded space-y-4">
      <h3 className="text-headline-sm text-on-surface">
        Google shows &quot;App not verified&quot;?
      </h3>
      <p className="text-body-sm text-on-surface-variant">
        This is normal for development. Gmail access requires sensitive scopes.
        Follow these steps:
      </p>
      <ol className="list-decimal list-inside space-y-2 text-body-sm text-on-surface">
        <li>
          On the Google warning screen, click <strong>Advanced</strong> →{" "}
          <strong>Go to Gofer Outreach (unsafe)</strong> — do not click Back to safety.
        </li>
        <li>
          Google Cloud → <strong>Audience</strong> → add your email as a{" "}
          <strong>Test user</strong> (if app is External + Testing).
        </li>
        <li>
          If you use <strong>@gofers.io</strong> Workspace, set Audience to{" "}
          <strong>Internal</strong> — removes the warning for your org.
        </li>
        <li>
          Use a <strong>separate OAuth client</strong> for Gmail (not the same one as
          Supabase login). Redirect URI:{" "}
          <code className="text-label-sm bg-surface-container-high px-1 rounded">
            {redirectUri}
          </code>
        </li>
        <li>
          Google Cloud → <strong>Data Access</strong> → ensure{" "}
          <code className="text-label-sm">gmail.send</code> and{" "}
          <code className="text-label-sm">gmail.readonly</code> are added.
        </li>
        <li>Enable <strong>Gmail API</strong> in APIs &amp; Services → Library.</li>
      </ol>
    </div>
  );
}
