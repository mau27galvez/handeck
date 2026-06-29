import { createDb } from "@handeck/db";
import * as schema from "@handeck/db/schema/auth";
import { env, getAppOrigin, getTrustedOrigins } from "@handeck/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { v4 } from "uuid";
import { dodopayments, checkout, portal, webhooks, usage } from "@dodopayments/better-auth";
import DodoPayments from "dodopayments";

const kuaiProducts = [
  {
    productId: env.DODO_PAYMENTS_MINI_PRODUCT_ID,
    slug: "kuai-mini",
  },
  {
    productId: env.DODO_PAYMENTS_REGULAR_PRODUCT_ID,
    slug: "kuai-regular",
  },
  {
    productId: env.DODO_PAYMENTS_IMPERIAL_PRODUCT_ID,
    slug: "kuai-imperial",
  },
];

export const dodoPayments = new DodoPayments({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  environment: "test_mode", // or "live_mode" for production
});

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: getAppOrigin(),
    plugins: [
      tanstackStartCookies(),
      dodopayments({
        client: dodoPayments,
        createCustomerOnSignUp: true,
        use: [
          checkout({
            products: kuaiProducts,
            successUrl: "/store/success",
            authenticatedUsersOnly: true,
          }),
          portal(),
          webhooks({
            webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_SECRET!,
            onPayload: async (payload) => {
              console.log("Received webhook:", payload.type);
            },
          }),
          usage(),
        ],
      }),
    ],
    advanced: {
      database: {
        generateId: () => v4(),
      },
    },
  });
}

export const auth = createAuth();
