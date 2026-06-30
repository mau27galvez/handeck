import { ORPCError } from "@orpc/server";

import { dodoPayments } from "@handeck/auth";
import { env } from "@handeck/env/server";

export function parseCreditAmount(amount: string | null | undefined) {
  const value = Number(amount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function getCurrentDodoCustomer(email: string) {
  const customers = await dodoPayments.customers.list({
    email,
    page_size: 1,
  });

  return customers.items[0] ?? null;
}

export async function getOrCreateDodoCustomer({ email, name }: { email: string; name: string }) {
  const customer = await getCurrentDodoCustomer(email);

  if (customer) return customer;

  return dodoPayments.customers.create({
    email,
    name,
  });
}

export async function getKuaiBalance(customerId: string) {
  const entitlements = await dodoPayments.customers.listCreditEntitlements(customerId);
  const kuaiEntitlement = entitlements.items.find(
    (entitlement) =>
      entitlement.credit_entitlement_id === env.DODO_PAYMENTS_KUAI_CREDIT_ENTITLEMENT_ID,
  );

  if (!kuaiEntitlement) {
    return {
      balance: 0,
      overage: 0,
      unit: "Kuais",
    };
  }

  return {
    balance: parseCreditAmount(kuaiEntitlement.balance),
    overage: parseCreditAmount(kuaiEntitlement.overage),
    unit: kuaiEntitlement.unit,
  };
}

export async function assertEnoughKuais({
  amount,
  userEmail,
  userName,
}: {
  amount: number;
  userEmail: string;
  userName: string;
}) {
  if (amount <= 0) return await getOrCreateDodoCustomer({ email: userEmail, name: userName });

  const customer = await getOrCreateDodoCustomer({ email: userEmail, name: userName });
  const balance = await getKuaiBalance(customer.customer_id);

  if (balance.balance < amount) {
    throw new ORPCError("PAYMENT_REQUIRED", {
      message: `Not enough Kuais. This generation costs ${amount} Kuais, but you have ${balance.balance}.`,
    });
  }

  return customer;
}

export async function debitKuais({
  amount,
  idempotencyKey,
  reason,
  userEmail,
  userName,
}: {
  amount: number;
  idempotencyKey: string;
  reason: string;
  userEmail: string;
  userName: string;
}) {
  if (amount <= 0) return;

  const customer = await assertEnoughKuais({ amount, userEmail, userName });

  await dodoPayments.creditEntitlements.balances.createLedgerEntry(customer.customer_id, {
    credit_entitlement_id: env.DODO_PAYMENTS_KUAI_CREDIT_ENTITLEMENT_ID,
    amount: String(amount),
    entry_type: "debit",
    reason,
    idempotency_key: idempotencyKey,
  });
}
