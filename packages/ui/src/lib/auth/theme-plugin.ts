import { createAuthPlugin } from "@better-auth-ui/core";
import {
  themePlugin as coreThemePlugin,
  type ThemeLocalization,
} from "@better-auth-ui/core/plugins";

import "./auth-plugin";
import { Appearance } from "@handeck/ui/components/auth/theme/appearance";
import { ThemeToggleItem } from "@handeck/ui/components/auth/theme/theme-toggle-item";

/**
 * Hook shape compatible with `next-themes`' `useTheme` and similar APIs. The
 * hook is invoked inside the plugin factory so consumers can register the
 * plugin in the same component as their `ThemeProvider` without an extra
 * inner component.
 */
export type UseThemeHook = () => {
  theme?: string;
  setTheme: (theme: string) => void;
  themes?: string[];
};

type CommonThemeOptions = {
  /**
   * Override the plugin's default localization strings.
   * @remarks `ThemeLocalization`
   */
  localization?: Partial<ThemeLocalization>;
  /**
   * Available theme options.
   * @default ["system", "light", "dark"]
   */
  themes?: string[];
};

export type ThemePluginOptions = CommonThemeOptions &
  (
    | {
        /**
         * A theme hook (e.g. next-themes' `useTheme`) called inside the
         * plugin's slot components on every render. The hook owns the live
         * theme value, so `theme`/`setTheme` are not accepted in this form.
         */
        useTheme: UseThemeHook;
        theme?: never;
        setTheme?: never;
      }
    | {
        /**
         * Current theme value. Required when not using a hook so slot
         * components can highlight the active option.
         */
        theme: string;
        /** Setter that updates the value `theme` is read from. */
        setTheme: (theme: string) => void;
        useTheme?: never;
      }
  );

export const themePlugin = createAuthPlugin(coreThemePlugin.id, (options: ThemePluginOptions) => {
  const { useTheme, ...rest } = options;
  const base = coreThemePlugin({ setTheme: () => {}, ...rest });
  return {
    ...base,
    useTheme:
      useTheme ??
      (() => ({
        theme: base.theme,
        setTheme: base.setTheme,
        themes: base.themes,
      })),
    userMenuItems: [ThemeToggleItem],
    accountCards: [Appearance],
  };
});
