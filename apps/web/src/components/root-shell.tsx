"use client";

import { useRouterState } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

import Header from "./header";

export function RootShell({ children }: PropsWithChildren) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showHeader = !pathname.startsWith("/auth");

  return (
    <div className={showHeader ? "grid h-svh grid-rows-[auto_1fr]" : "grid h-svh grid-rows-[1fr]"}>
      {showHeader ? <Header /> : null}
      <div className="min-h-0">{children}</div>
    </div>
  );
}
