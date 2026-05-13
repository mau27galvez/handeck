"use client";

import {
  type MultiSessionAuthClient,
  useAuth,
  useSession,
  useSetActiveSession,
} from "@better-auth-ui/react";
import {
  ChevronsUpDown,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserPlus2,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  type ComponentType,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@handeck/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@handeck/ui/components/dropdown-menu";
import { cn } from "@handeck/ui/lib/utils";
import { UserAvatar } from "./user-avatar";
import { UserView } from "./user-view";

/** Auth states a `UserButton` link can be visible in. */
export type UserButtonLinkVisibility = "authenticated" | "unauthenticated" | "always";

/** A simple link entry rendered as a `DropdownMenuItem` in the `UserButton` menu. */
export type UserButtonLink = {
  /** Visible label. */
  label: ReactNode;
  /** Destination URL. */
  href: string;
  /** Optional leading icon. Sized/coloured to match built-in items. */
  icon?: ReactNode;
  /** Forwarded to the underlying `DropdownMenuItem`. */
  variant?: "default" | "destructive";
  /**
   * When this link is visible based on auth state.
   * @default "always"
   */
  visibility?: UserButtonLinkVisibility;
};

/** Built-in menu sections controlled by `visibleOptions`. */
export type UserButtonVisibleOption = "theme" | "account" | "sign-in" | "sign-up" | "sign-out";

function defaultVisibleOptions(
  isAuthenticated: boolean,
  emailPasswordEnabled: boolean,
): readonly UserButtonVisibleOption[] {
  if (isAuthenticated) {
    return ["account", "sign-out"];
  }
  const guest: UserButtonVisibleOption[] = ["sign-in"];
  if (emailPasswordEnabled) guest.push("sign-up");
  return guest;
}

export type UserButtonProps = {
  className?: string;
  align?: "center" | "end" | "start" | undefined;
  sideOffset?: number;
  size?: "default" | "icon";
  variant?: "default" | "destructive" | "ghost" | "link" | "outline" | "secondary";
  /** Additional menu entries rendered above the built-in items. */
  links?: (UserButtonLink | ReactElement)[];
  /**
   * When `true`, the built-in Settings (account) link is hidden even if
   * `visibleOptions` includes `"account"`.
   */
  hideSettings?: boolean;
  /**
   * Which built-in sections to show. When omitted, matches legacy behavior:
   * signed-in users get account + sign-out; guests get sign-in and sign-up
   * only if email/password is enabled.
   */
  visibleOptions?: readonly UserButtonVisibleOption[];
};

function renderUserLink(
  link: UserButtonLink | ReactElement,
  Link: ComponentType<{ href: string; children?: ReactNode }>,
  fallbackKey: string,
): ReactNode {
  if (isValidElement(link)) return link;

  const { label, href, icon, variant } = link;
  return (
    <DropdownMenuItem key={fallbackKey} variant={variant} render={<Link href={href} />}>
      {icon}
      {label}
    </DropdownMenuItem>
  );
}

function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <DropdownMenuRadioGroup value="system">
        <DropdownMenuRadioItem value="system" inset>
          <Monitor className="text-muted-foreground" />
          System
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    );
  }

  return (
    <DropdownMenuRadioGroup
      value={theme ?? "system"}
      onValueChange={(v) => {
        setTheme(v);
      }}
    >
      <DropdownMenuRadioItem value="light" inset>
        <Sun className="text-muted-foreground" />
        Light
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark" inset>
        <Moon className="text-muted-foreground" />
        Dark
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="system" inset>
        <Monitor className="text-muted-foreground" />
        System
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}

type AuthPluginLike = {
  id: string;
  userMenuItems?: readonly ComponentType[] | null;
};

function pluginUserMenuItems(plugins: readonly AuthPluginLike[]) {
  return plugins.flatMap((plugin) => {
    const items = plugin.userMenuItems;
    if (!items?.length) return [];
    return items.map((Item, index) => <Item key={`${plugin.id}-${index.toString()}`} />);
  });
}

/**
 * User menu: profile, optional settings link, theme (when listed), plugins,
 * and sign-in / sign-up / sign-out based on `visibleOptions` and auth state.
 * Guest **Sign in** opens the app auth route (e.g. `/auth/sign-in`), not inline OAuth.
 */
export function UserButton({
  className,
  align,
  sideOffset,
  size = "default",
  variant = "ghost",
  links,
  hideSettings = false,
  visibleOptions: visibleOptionsProp,
}: UserButtonProps) {
  const { authClient, basePaths, viewPaths, localization, plugins, Link, emailAndPassword } =
    useAuth();

  const { isPending: settingActiveSession } = useSetActiveSession(
    authClient as MultiSessionAuthClient,
  );
  const { data: session, isPending: sessionPending } = useSession(authClient);

  const emailPasswordEnabled = emailAndPassword?.enabled ?? false;

  const resolvedVisibleOptions = useMemo(() => {
    return visibleOptionsProp ?? defaultVisibleOptions(!!session, emailPasswordEnabled);
  }, [visibleOptionsProp, session, emailPasswordEnabled]);

  const show = (key: UserButtonVisibleOption) => resolvedVisibleOptions.includes(key);

  const showAccount = !hideSettings && show("account") && !!session && !!viewPaths.settings;

  const userLinks = links?.flatMap((link, index) => {
    if (!isValidElement(link)) {
      const visibility = link.visibility ?? "always";
      if (visibility === "authenticated" && !session) return [];
      if (visibility === "unauthenticated" && session) return [];
    }
    return [renderUserLink(link, Link, `user-button-link-${index.toString()}`)];
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(size === "icon" && "rounded-full", size === "icon" && className)}
      >
        {size === "icon" ? (
          <UserAvatar />
        ) : (
          <Button
            variant={variant}
            className={cn("h-auto py-2.5 font-normal", className)}
            size="lg"
          >
            {session || sessionPending || settingActiveSession ? (
              <UserView isPending={!!settingActiveSession} />
            ) : (
              <>
                <UserAvatar />

                <div className="grid flex-1 text-left text-sm leading-tight">
                  {localization.auth.account}
                </div>
              </>
            )}

            <ChevronsUpDown className="ml-auto" />
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-40 max-w-[48svw] md:min-w-56"
        sideOffset={sideOffset}
        align={align}
      >
        {session && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-sm font-normal">
              <UserView />
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        )}

        {session ? (
          <>
            {userLinks}

            {show("theme") && (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Sun className="text-muted-foreground" />
                    Theme
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <ThemeMenuItems />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}

            {showAccount && (
              <DropdownMenuItem
                render={<Link href={`${basePaths.settings}/${viewPaths.settings.account}`} />}
              >
                <Settings className="text-muted-foreground" />
                {localization.settings.settings}
              </DropdownMenuItem>
            )}

            {pluginUserMenuItems(plugins as readonly AuthPluginLike[])}

            {show("sign-out") && (
              <>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  render={<Link href={`${basePaths.auth}/${viewPaths.auth.signOut}`} />}
                >
                  <LogOut className="text-muted-foreground" />
                  {localization.auth.signOut}
                </DropdownMenuItem>
              </>
            )}
          </>
        ) : (
          <>
            {userLinks}

            {show("theme") && (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Sun className="text-muted-foreground" />
                    Theme
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <ThemeMenuItems />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}

            {show("sign-in") && (
              <DropdownMenuItem
                render={<Link href={`${basePaths.auth}/${viewPaths.auth.signIn}`} />}
              >
                <LogIn className="text-muted-foreground" />
                {localization.auth.signIn}
              </DropdownMenuItem>
            )}

            {show("sign-up") && emailPasswordEnabled && (
              <DropdownMenuItem
                render={<Link href={`${basePaths.auth}/${viewPaths.auth.signUp}`} />}
              >
                <UserPlus2 className="text-muted-foreground" />
                {localization.auth.signUp}
              </DropdownMenuItem>
            )}

            {pluginUserMenuItems(plugins as readonly AuthPluginLike[])}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
