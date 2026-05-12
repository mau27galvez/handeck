import { redirect } from "@tanstack/react-router";

const REDIRECT_FALLBACK = "/";
const REDIRECT_PARSE_BASE = new URL("https://redirect_normalize.invalid/");

type RequireAuthParams = {
  context: { isAuthenticated?: boolean };
  location: { pathname: string; searchStr: string; hash: string };
};

/** In-app paths only: decode loop + URL resolution catch `//host` and encoded `%2F%2F` tricks. Rejects `/auth` targets to avoid post-login loops. */
export function sanitizeRedirectTo(input: string | null | undefined): string {
  if (input == null) return REDIRECT_FALLBACK;

  let s = input.trim();
  if (!s) return REDIRECT_FALLBACK;

  try {
    for (let i = 0; i < 4; i++) {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    }
  } catch {
    return REDIRECT_FALLBACK;
  }

  if (!s.startsWith("/") || s.startsWith("//") || s.includes("://") || /[\\\r\n]/.test(s)) {
    return REDIRECT_FALLBACK;
  }

  try {
    const resolved = new URL(s, REDIRECT_PARSE_BASE);
    if (resolved.origin !== REDIRECT_PARSE_BASE.origin) return REDIRECT_FALLBACK;
    const path = resolved.pathname;
    if (path === "/auth" || path.startsWith("/auth/")) {
      return REDIRECT_FALLBACK;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return REDIRECT_FALLBACK;
  }
}

export function coerceSearchRedirect(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

/** True when `redirectTo` is already the minimal safe form (omit when `/`, exact path when not). */
export function isCanonicalAuthRedirectSearch(
  search: Record<string, unknown> | undefined,
): boolean {
  const raw = coerceSearchRedirect(search?.redirectTo);
  const sanitized = sanitizeRedirectTo(raw ?? undefined);
  if (sanitized === REDIRECT_FALLBACK) {
    return raw === undefined;
  }
  return raw === sanitized;
}

/**
 * Returns search params with a sanitized `redirectTo` (or removed when `/`).
 * When already canonical, `search` is returned unchanged.
 */
export function withCanonicalAuthRedirectSearch(
  searchRecord: Record<string, unknown>,
): { canonical: boolean; search: Record<string, unknown> } {
  if (isCanonicalAuthRedirectSearch(searchRecord)) {
    return { canonical: true, search: searchRecord };
  }
  const raw = coerceSearchRedirect(searchRecord.redirectTo);
  const sanitized = sanitizeRedirectTo(raw ?? undefined);
  const nextSearch: Record<string, unknown> = { ...searchRecord };
  if (sanitized === "/") {
    delete nextSearch.redirectTo;
  } else {
    nextSearch.redirectTo = sanitized;
  }
  return { canonical: false, search: nextSearch };
}

export function requireAuth({ context, location }: RequireAuthParams) {
  if (!context.isAuthenticated) {
    const redirectTo = sanitizeRedirectTo(
      `${location.pathname}${location.searchStr}${location.hash}`,
    );

    throw redirect({
      to: "/auth/$path",
      params: { path: "sign-in" },
      search: { redirectTo },
    });
  }
}
