import { env } from "@handeck/env/server";
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "handeck",
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  isDev: env.INNGEST_DEV,
});
