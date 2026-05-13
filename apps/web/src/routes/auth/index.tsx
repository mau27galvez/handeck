import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/")({
  beforeLoad() {
    throw redirect({
      to: "/auth/$path",
      params: { path: "sign-in" },
      replace: true,
    });
  },
  component: () => null,
});
