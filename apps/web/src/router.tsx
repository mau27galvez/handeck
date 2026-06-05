import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import Loader from "./components/loader";

import "./index.css";
import { routeTree } from "./routeTree.gen";
import { createQueryClient, orpc } from "./utils/orpc";

export function getRouter() {
  const queryClient = createQueryClient();

  const router = createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    context: { queryClient, orpc },
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
