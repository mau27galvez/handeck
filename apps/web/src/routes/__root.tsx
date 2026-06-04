import { Toaster } from "@handeck/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import type { orpc } from "@/utils/orpc";

import { AppProviders } from "../components/providers";
import { RootShell } from "../components/root-shell";

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
  orpc: typeof orpc;
  /** Set by root `beforeLoad` after reading the session. */
  isAuthenticated?: boolean;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "My App",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(
      context.orpc.auth.getSession.queryOptions(),
    );
    return {
      isAuthenticated: !!session?.user,
    };
  },
});

function RootDocument() {
  const context = useRouteContext({ from: Route.id });
  return (
    <AppProviders queryClient={context.queryClient}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body>
          <RootShell>
            <Outlet />
          </RootShell>
          <Toaster richColors />
          <TanStackRouterDevtools position="bottom-left" />
          <Scripts />
        </body>
      </html>
    </AppProviders>
  );
}
