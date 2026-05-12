import { createFileRoute } from "@tanstack/react-router";

import { requireAuth } from "@/lib/route-auth";

export const Route = createFileRoute("/templates/")({
  beforeLoad: requireAuth,
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/templates/"!</div>;
}
