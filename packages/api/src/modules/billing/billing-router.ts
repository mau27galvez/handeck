import { dodoPayments } from "@handeck/auth";
import { env, getAppOrigin } from "@handeck/env/server";

import { protectedProcedure } from "../../index";
import {
  getCurrentDodoCustomer,
  getKuaiBalance,
  getOrCreateDodoCustomer,
  parseCreditAmount,
} from "./billing-use-cases";

const KUAI_LEDGER_PAGE_SIZE = 10;
const PAYMENT_HISTORY_PAGE_SIZE = 10;

async function listKuaiLedger(customerId: string) {
  try {
    const ledger = await dodoPayments.creditEntitlements.balances.listLedger(customerId, {
      credit_entitlement_id: env.DODO_PAYMENTS_KUAI_CREDIT_ENTITLEMENT_ID,
      page_size: KUAI_LEDGER_PAGE_SIZE,
      page_number: 0,
    });

    return ledger.items.map((entry) => ({
      id: entry.id,
      amount: parseCreditAmount(entry.amount),
      balanceAfter: parseCreditAmount(entry.balance_after),
      createdAt: entry.created_at,
      description: entry.description ?? null,
      isCredit: entry.is_credit,
      transactionType: entry.transaction_type,
      referenceId: entry.reference_id ?? null,
      referenceType: entry.reference_type ?? null,
    }));
  } catch {
    return [];
  }
}

async function listPayments(customerId: string) {
  const payments = await dodoPayments.payments.list({
    customer_id: customerId,
    page_size: PAYMENT_HISTORY_PAGE_SIZE,
    page_number: 0,
    status: "succeeded",
  });

  return payments.items.map((payment) => ({
    id: payment.payment_id,
    amount: payment.total_amount,
    currency: payment.currency,
    createdAt: payment.created_at,
    invoiceUrl: payment.invoice_url ?? null,
    method: payment.payment_method ?? payment.payment_method_type ?? null,
    status: payment.status ?? null,
  }));
}

export const billingRouter = {
  createCustomerPortalSession: protectedProcedure.handler(async ({ context }) => {
    const customer = await getOrCreateDodoCustomer({
      email: context.session.user.email,
      name: context.session.user.name,
    });

    const session = await dodoPayments.customers.customerPortal.create(customer.customer_id, {
      return_url: `${getAppOrigin()}/store`,
    });

    return {
      url: session.link,
    };
  }),

  getKuaiAccount: protectedProcedure.handler(async ({ context }) => {
    const customer = await getCurrentDodoCustomer(context.session.user.email);

    if (!customer) {
      return {
        customer: null,
        balance: {
          balance: 0,
          overage: 0,
          unit: "Kuais",
        },
        ledger: [],
        payments: [],
      };
    }

    const [balance, ledger, payments] = await Promise.all([
      getKuaiBalance(customer.customer_id),
      listKuaiLedger(customer.customer_id),
      listPayments(customer.customer_id),
    ]);

    return {
      customer: {
        id: customer.customer_id,
        email: customer.email,
        name: customer.name,
      },
      balance,
      ledger,
      payments,
    };
  }),
};
