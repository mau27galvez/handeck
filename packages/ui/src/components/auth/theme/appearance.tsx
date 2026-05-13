"use client";

import {
  ThemePreviewDark,
  ThemePreviewLight,
  ThemePreviewSystem,
  useAuthPlugin,
} from "@better-auth-ui/react";
import { themePlugin as coreThemePlugin } from "@better-auth-ui/core/plugins";
import { useEffect, useState, type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@handeck/ui/components/card";
import { Field, FieldContent, FieldGroup, FieldTitle } from "@handeck/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@handeck/ui/components/radio-group";
import { cn } from "@handeck/ui/lib/utils";

export type AppearanceProps = {
  className?: string;
};

type ThemePluginContext = {
  useTheme: () => {
    theme?: string;
    setTheme: (theme: string) => void;
    themes?: string[];
  };
  localization: {
    appearance: string;
    theme: string;
    system: string;
    light: string;
    dark: string;
  };
};

const previewWrapBase =
  "relative flex w-full items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 ring-1 ring-border/40";

/**
 * Theme selector card for account settings (registered via `themePlugin`).
 */
export function Appearance({ className }: AppearanceProps) {
  const { useTheme, localization } = useAuthPlugin(coreThemePlugin) as unknown as ThemePluginContext;
  const { theme, setTheme, themes = [] } = useTheme();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const value = theme ?? "system";

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>{localization.appearance}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldTitle>{localization.theme}</FieldTitle>
            <FieldContent>
              {!isMounted ? (
                <div className="text-sm text-muted-foreground">…</div>
              ) : (
                <RadioGroup
                  className="grid w-full grid-cols-1 justify-items-stretch gap-2 sm:mx-auto sm:max-w-xs md:max-w-sm lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-3"
                  value={value}
                  onValueChange={(v) => setTheme(String(v))}
                >
                  {themes.includes("system") && (
                    <ThemeOption
                      id="appearance-theme-system"
                      value="system"
                      label={localization.system}
                      selected={value === "system"}
                    >
                      <ThemePreviewSystem className="h-full w-full max-h-full object-contain object-center" />
                    </ThemeOption>
                  )}
                  {themes.includes("light") && (
                    <ThemeOption
                      id="appearance-theme-light"
                      value="light"
                      label={localization.light}
                      selected={value === "light"}
                    >
                      <ThemePreviewLight className="h-full w-full max-h-full object-contain object-center" />
                    </ThemeOption>
                  )}
                  {themes.includes("dark") && (
                    <ThemeOption
                      id="appearance-theme-dark"
                      value="dark"
                      label={localization.dark}
                      selected={value === "dark"}
                    >
                      <ThemePreviewDark className="h-full w-full max-h-full object-contain object-center" />
                    </ThemeOption>
                  )}
                </RadioGroup>
              )}
            </FieldContent>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function ThemeOption({
  id,
  value,
  label,
  selected,
  children,
}: {
  id: string;
  value: string;
  label: string;
  selected: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-w-0 cursor-pointer flex-col gap-2 rounded-lg border p-2.5 transition-colors sm:p-3",
        selected
          ? "border-primary bg-muted/50 shadow-sm"
          : "border-border bg-muted/5 hover:border-border hover:bg-muted/20",
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <RadioGroupItem value={value} id={id} className="shrink-0" />
        <span className="min-w-0 truncate text-sm font-medium leading-none">{label}</span>
      </div>
      <div
        className={cn(
          previewWrapBase,
          "mx-auto h-12 max-w-54 shrink-0 sm:h-14 sm:max-w-60",
          "lg:mx-0 lg:h-16 lg:max-w-none",
        )}
      >
        {children}
      </div>
    </label>
  );
}
