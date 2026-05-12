"use client";

import { AuthProvider } from "@handeck/ui/components/auth/auth-provider";
import type { QueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";

import { authClient } from "@/lib/auth-client";
import { useAuthBaseUrl } from "@/lib/auth-app-origin";

function BetterAuthLink({
  href,
  to,
  className,
  children,
}: PropsWithChildren<{ className?: string; href: string; to?: string }>) {
  return (
    <Link to={to ?? href} className={className}>
      {children}
    </Link>
  );
}

export function AppProviders({
  children,
  queryClient,
}: PropsWithChildren<{ queryClient: QueryClient }>) {
  const navigate = useNavigate({ from: "/" });
  const authBaseUrl = useAuthBaseUrl();

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AuthProvider
        authClient={authClient}
        queryClient={queryClient}
        navigate={({ to, replace }) => {
          void navigate({ to, replace });
        }}
        Link={BetterAuthLink}
        baseURL={authBaseUrl}
        redirectTo="/"
        socialProviders={["google"]}
        emailAndPassword={{
          enabled: false,
        }}
      >
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
