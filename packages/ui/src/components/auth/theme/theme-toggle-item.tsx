"use client";

import { useAuthPlugin } from "@better-auth-ui/react";
import { themePlugin as coreThemePlugin } from "@better-auth-ui/core/plugins";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@handeck/ui/components/dropdown-menu";

type ThemePluginContext = {
  useTheme: () => {
    theme?: string;
    setTheme: (theme: string) => void;
    themes?: string[];
  };
  localization: {
    theme: string;
    light: string;
    dark: string;
    system: string;
  };
};

/**
 * Theme submenu for `UserButton` (registered via `themePlugin`).
 */
export function ThemeToggleItem() {
  const { useTheme, localization } = useAuthPlugin(
    coreThemePlugin,
  ) as unknown as ThemePluginContext;
  const { theme, setTheme, themes = [] } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const value = mounted ? (theme ?? "system") : "system";

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Palette className="text-muted-foreground" />
        {localization.theme}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => {
            setTheme(String(v));
          }}
        >
          {themes.includes("light") && (
            <DropdownMenuRadioItem value="light" inset>
              <Sun className="text-muted-foreground" />
              {localization.light}
            </DropdownMenuRadioItem>
          )}
          {themes.includes("dark") && (
            <DropdownMenuRadioItem value="dark" inset>
              <Moon className="text-muted-foreground" />
              {localization.dark}
            </DropdownMenuRadioItem>
          )}
          {themes.includes("system") && (
            <DropdownMenuRadioItem value="system" inset>
              <Monitor className="text-muted-foreground" />
              {localization.system}
            </DropdownMenuRadioItem>
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
