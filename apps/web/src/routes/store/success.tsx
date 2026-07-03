import { Button } from "@handeck/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@handeck/ui/components/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { requireAuth } from "@/lib/route-auth";

export const Route = createFileRoute("/store/success")({
  beforeLoad: requireAuth,
  component: StoreSuccess,
});

function StoreSuccess() {
  return (
    <div className="flex justify-center px-4 py-12 md:px-12 lg:px-24 xl:px-32">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <CheckCircle2 className="size-10 text-primary" />
          <CardTitle className="text-xl font-semibold">Payment complete</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Thanks for buying Kuais. Balance updates and spending controls will be added next.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild>
              <Link to="/store">Back to store</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/decks">Go to decks</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
