import type { AuthPlugin as TypedAuthPlugin, AuthPluginComponents } from "@better-auth-ui/react";

/** Props the shadcn `<Auth>` router spreads onto plugin-contributed auth views. */
export type AuthViewProps = {
  className?: string;
  socialLayout?: "auto" | "horizontal" | "vertical" | "grid";
  socialPosition?: "top" | "bottom";
};

/** Props the shadcn `<Settings>` router spreads onto plugin-contributed settings views. */
export type SettingsViewProps = {
  className?: string;
};

/** Shadcn plugin type. Plugin authors import this from `@handeck/ui/lib/auth/auth-plugin`. */
export type AuthPlugin = TypedAuthPlugin<AuthPluginComponents, AuthViewProps, SettingsViewProps>;

declare module "@better-auth-ui/core" {
  /** Widens `useAuth().plugins` to the shadcn-typed `AuthPlugin`. */
  interface AuthPluginRegister {
    shadcn: AuthPlugin;
  }
}
