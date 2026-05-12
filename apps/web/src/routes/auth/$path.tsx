import { createFileRoute, redirect } from "@tanstack/react-router";

import { Auth } from "@handeck/ui/components/auth/auth";

import { withCanonicalAuthRedirectSearch } from "@/lib/route-auth";
import { isAllowedAuthPath } from "@/lib/auth-ui-config";

export const Route = createFileRoute("/auth/$path")({
  beforeLoad({ context, location, params }) {
    const { path } = params;

    const search = location.search ?? ({} satisfies Record<string, unknown>);
    const searchRecord = search as Record<string, unknown>;

    if (!isAllowedAuthPath(path)) {
      const { search: nextSearch } = withCanonicalAuthRedirectSearch(searchRecord);
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
        search: nextSearch as never,
        replace: true,
      });
    }

    if (context.isAuthenticated && path !== "sign-out") {
      throw redirect({
        to: "/",
        replace: true,
      });
    }

    const { canonical, search: nextSearch } = withCanonicalAuthRedirectSearch(searchRecord);
    if (canonical) {
      return;
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
