"use client";

import { Button } from "@handeck/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@handeck/ui/components/card";
import { Spinner } from "@handeck/ui/components/spinner";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { KuaiBadge } from "@/components/kuai-badge";
import { authClient } from "@/lib/auth-client";
import { requireAuth } from "@/lib/route-auth";

const packs = [
  {
    name: "Mini",
    kuais: 1_600,
    slug: "kuai-mini",
    imageSrc: "/Mini.png",
    description: "A focused top-up for smaller deck runs.",
    highlighted: false,
  },
  {
    name: "Regular",
    kuais: 3_000,
    slug: "kuai-regular",
    imageSrc: "/Regular.png",
    description: "A balanced pack for steady studying.",
    highlighted: true,
  },
  {
    name: "Imperial",
    kuais: 12_000,
    slug: "kuai-imperial",
    imageSrc: "/Imperial.png",
    description: "A larger reserve for building many decks.",
    highlighted: false,
  },
] as const;

type PackSlug = (typeof packs)[number]["slug"];

const kuaiFormatter = new Intl.NumberFormat("en-US");

export const Route = createFileRoute("/store/")({
  beforeLoad: requireAuth,
  component: Store,
});

function Store() {
  const [pendingSlug, setPendingSlug] = useState<PackSlug | null>(null);

  async function startCheckout(slug: PackSlug) {
    setPendingSlug(slug);

    const { data: session, error } = await authClient.dodopayments.checkoutSession({
      slug,
      referenceId: crypto.randomUUID(),
    });

    if (error) {
      setPendingSlug(null);
      toast.error(error.message || "Unable to start checkout.");
      return;
    }

    if (!session?.url) {
      setPendingSlug(null);
      toast.error("Dodo did not return a checkout URL.");
      return;
    }

    window.location.href = session.url;
  }

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <div className="mb-8 flex flex-col gap-3">
        <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">Buy Kuais</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Choose a pack and complete payment through Dodo Payments. Kuai balance and spending
          management will be added separately.
        </p>
      </div>

      <div className="grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-3">
        {packs.map((pack) => {
          const isPending = pendingSlug === pack.slug;
          const disabled = pendingSlug !== null;

          return (
            <Card
              key={pack.slug}
              className={
                pack.highlighted
                  ? "relative gap-0 p-0 ring-2 ring-primary/25"
                  : "relative gap-0 p-0"
              }
            >
              {pack.highlighted ? (
                <div className="absolute right-3 top-3 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground shadow-sm">
                  Popular
                </div>
              ) : null}

              <div className="border-b bg-muted/30 p-4">
                <img
                  src={pack.imageSrc}
                  alt={`${pack.name} Kuai pack`}
                  className="mx-auto h-44 w-full object-contain drop-shadow-sm"
                />
              </div>

              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-base font-semibold">{pack.name}</CardTitle>
                <CardDescription>{pack.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col gap-3">
                <div className="rounded-md bg-muted p-3">
                  <span className="text-xs font-medium text-muted-foreground">Includes</span>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="text-2xl font-bold leading-none tracking-tight">
                      {kuaiFormatter.format(pack.kuais)}
                    </p>
                    <KuaiBadge cost={pack.kuais} />
                  </div>
                </div>
                <p className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  Secure hosted checkout
                </p>
              </CardContent>

              <CardFooter className="mt-auto">
                <Button
                  className="w-full"
                  disabled={disabled}
                  onClick={() => startCheckout(pack.slug)}
                >
                  {isPending ? (
                    <>
                      <Spinner />
                      Redirecting
                    </>
                  ) : (
                    <>
                      Buy {pack.name}
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
