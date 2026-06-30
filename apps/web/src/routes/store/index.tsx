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
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ExternalLink, History, ReceiptText, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { KuaiBadge } from "@/components/kuai-badge";
import { authClient } from "@/lib/auth-client";
import { requireAuth } from "@/lib/route-auth";

const packs = [
  {
    name: "Mini",
    kuais: 600,
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
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(context.orpc.billing.getKuaiAccount.queryOptions());
  },
  component: Store,
});

function Store() {
  const { orpc } = Route.useRouteContext();
  const { data: kuaiAccount } = useSuspenseQuery(orpc.billing.getKuaiAccount.queryOptions());
  const createPortalSession = useMutation(
    orpc.billing.createCustomerPortalSession.mutationOptions(),
  );
  const [pendingSlug, setPendingSlug] = useState<PackSlug | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

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

  async function openCustomerPortal() {
    setOpeningPortal(true);

    try {
      const portal = await createPortalSession.mutateAsync(undefined);
      window.location.href = portal.url;
    } catch (error) {
      setOpeningPortal(false);
      const message =
        error instanceof Error ? error.message : "Unable to open the customer portal.";
      toast.error(message);
    }
  }

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">Buy Kuais</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Choose a pack and complete payment through Dodo Payments. Your Kuai balance and account
            history come from Dodo credit entitlements.
          </p>
        </div>
        <Button variant="outline" disabled={openingPortal} onClick={openCustomerPortal}>
          {openingPortal ? (
            <>
              <Spinner />
              Opening portal
            </>
          ) : (
            <>
              Manage billing
              <ExternalLink className="size-3.5" />
            </>
          )}
        </Button>
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

      <section className="mt-8 grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Wallet className="size-4" />
              Kuai balance
            </CardTitle>
            <CardDescription>
              {kuaiAccount.customer
                ? `Dodo customer: ${kuaiAccount.customer.email}`
                : "No Dodo customer record yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-3 rounded-md bg-muted p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Available</p>
                <p className="mt-1 text-3xl font-bold leading-none tracking-tight">
                  {kuaiFormatter.format(kuaiAccount.balance.balance)}
                </p>
              </div>
              <KuaiBadge cost={kuaiAccount.balance.balance} />
            </div>
            {kuaiAccount.balance.overage > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Overage tracked by Dodo: {kuaiFormatter.format(kuaiAccount.balance.overage)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <History className="size-4" />
              Recent Kuai ledger
            </CardTitle>
            <CardDescription>Credits and debits from Dodo credit entitlements.</CardDescription>
          </CardHeader>
          <CardContent>
            {kuaiAccount.ledger.length > 0 ? (
              <div className="divide-y rounded-md border">
                {kuaiAccount.ledger.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {entry.description ?? formatLedgerType(entry.transactionType)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.createdAt)} · Balance after{" "}
                        {kuaiFormatter.format(entry.balanceAfter)}
                      </p>
                    </div>
                    <span
                      className={
                        entry.isCredit
                          ? "text-sm font-semibold text-emerald-500"
                          : "text-sm font-semibold text-amber-500"
                      }
                    >
                      {entry.isCredit ? "+" : "-"}
                      {kuaiFormatter.format(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No Kuai ledger entries yet. Completed purchases will appear here after Dodo grants
                credits.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ReceiptText className="size-4" />
              Purchase history
            </CardTitle>
            <CardDescription>Recent successful payments from Dodo.</CardDescription>
          </CardHeader>
          <CardContent>
            {kuaiAccount.payments.length > 0 ? (
              <div className="divide-y rounded-md border">
                {kuaiAccount.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-medium">{formatPaymentAmount(payment)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.createdAt)}
                        {payment.method ? ` · ${payment.method}` : ""}
                      </p>
                    </div>
                    {payment.invoiceUrl ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={payment.invoiceUrl} target="_blank" rel="noreferrer">
                          Invoice
                          <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{payment.status}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No successful Dodo payments yet. Detailed billing records are also available in the
                Dodo customer portal.
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button variant="outline" disabled={openingPortal} onClick={openCustomerPortal}>
              Open Dodo portal
              <ExternalLink className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function formatLedgerType(transactionType: string) {
  return transactionType
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function formatPaymentAmount(payment: { amount: number; currency: string }) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: payment.currency,
  }).format(payment.amount / 100);
}
