import { createFileRoute, notFound } from "@tanstack/react-router";
import { Settings } from "@handeck/ui/components/auth/settings/settings";
import { isAllowedSettingsPath } from "@/lib/auth-ui-config";
import { requireAuth } from "@/lib/route-auth";

export const Route = createFileRoute("/settings/$path")({
  beforeLoad({ context, location, params: { path } }) {
    if (!isAllowedSettingsPath(path)) {
      throw notFound();
    }
    requireAuth({ context, location });
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { path } = Route.useParams();

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-6">
      <Settings path={path} />
    </div>
  );
}
