"use client";

import { AuthProvider } from "@handeck/ui/components/auth/auth-provider";
import { themePlugin } from "@handeck/ui/lib/auth/theme-plugin";
import type { QueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ThemeProvider, useTheme } from "next-themes";
import type { PropsWithChildren } from "react";

import { authClient } from "@/lib/auth-client";
import { useAuthBaseUrl } from "@/lib/auth-app-origin";
import { authUiConfig } from "@/lib/auth-ui-config";

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
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AppProvidersInner queryClient={queryClient}>{children}</AppProvidersInner>
    </ThemeProvider>
  );
}

function AppProvidersInner({
  children,
  queryClient,
}: PropsWithChildren<{ queryClient: QueryClient }>) {
  const navigate = useNavigate({ from: "/" });
  const authBaseUrl = useAuthBaseUrl();

  return (
    <AuthProvider
      authClient={authClient}
      queryClient={queryClient}
      navigate={({ to, replace }) => {
        void navigate({ to, replace });
      }}
      Link={BetterAuthLink}
      baseURL={authBaseUrl}
      redirectTo="/"
      {...authUiConfig}
      plugins={[themePlugin({ useTheme })]}
    >
      {children}
    </AuthProvider>
  );
}
