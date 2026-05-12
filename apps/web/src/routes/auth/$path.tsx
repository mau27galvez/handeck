import { createFileRoute, redirect } from "@tanstack/react-router";

import { Auth } from "@handeck/ui/components/auth/auth";

import {
  coerceSearchRedirect,
  isCanonicalAuthRedirectSearch,
  sanitizeRedirectTo,
} from "@/lib/route-auth";
import { isAllowedAuthPath } from "@/lib/auth-ui-config";

export const Route = createFileRoute("/auth/$path")({
  beforeLoad({ context, location, params }) {
    const { path } = params;

    if (!isAllowedAuthPath(path)) {
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
        replace: true,
      });
    }

    if (context.isAuthenticated && path !== "sign-out") {
      throw redirect({
        to: "/",
        replace: true,
      });
    }

    const search = location.search ?? ({} satisfies Record<string, unknown>);

    const searchRecord = search as Record<string, unknown>;

    if (isCanonicalAuthRedirectSearch(searchRecord)) {
      return;
    }

    const raw = coerceSearchRedirect(searchRecord.redirectTo);
    const sanitized = sanitizeRedirectTo(raw ?? undefined);
    const nextSearch: Record<string, unknown> = { ...search };

    if (sanitized === "/") {
      delete nextSearch.redirectTo;
    } else {
      nextSearch.redirectTo = sanitized;
    }

    throw redirect({
      to: "/auth/$path",
      params: { path },
      search: nextSearch as never,
      replace: true,
    });
  },
  component: AuthPage,
});

function AuthPage() {
  const { path } = Route.useParams();

  return (
    <div className="flex justify-center my-auto p-4 md:p-6">
      <Auth path={path} />
    </div>
  );
}
