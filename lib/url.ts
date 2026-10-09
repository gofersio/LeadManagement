import type { NextRequest } from "next/server";

/** Resolves app base URL; in dev uses the request origin so port 3003 etc. works. */
export function getAppUrl(request?: NextRequest | Request): string {
  if (request && process.env.NODE_ENV === "development") {
    return new URL(request.url).origin;
  }
  return process.env.APP_URL ?? "http://localhost:3000";
}
