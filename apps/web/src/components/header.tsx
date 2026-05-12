import { Link, useRouterState } from "@tanstack/react-router";
import { UserButton } from "@handeck/ui/components/auth/user/user-button";
import { cn } from "@handeck/ui/lib/utils";

const links = [
  { to: "/", label: "Home" },
  { to: "/templates", label: "Templates" },
  { to: "/decks", label: "Decks" },
] as const;

export default function Header() {
  const { location } = useRouterState();
  const currentPath = location.pathname;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-12 lg:px-24 xl:px-32">
      <div className="flex h-18 items-center justify-between px-4 w-full">
        <nav className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-3xl font-bold tracking-tight">🀄️</span>
          </Link>

          <div className="flex items-center gap-1">
            {links.map(({ to, label }) => {
              const isActive =
                currentPath === to ||
                (to !== "/" && currentPath.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-sm px-2.5 text-sm font-medium text-primary/70 outline-none transition-colors hover:text-primary",
                    "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 border border-transparent",
                    isActive ? "bg-secondary text-primary" : "bg-transparent",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <UserButton
            size="icon"
            visibleOptions={["sign-out", "account", "sign-in", "theme"]}
          />
        </div>
      </div>
    </header>
  );
}
