import { inngest } from "@handeck/api/inngest/inngest-client";
import { inngestFunctions } from "@handeck/api/inngest/inngest-functions";
import { createFileRoute } from "@tanstack/react-router";
import { serve } from "inngest/edge";

const handler = serve({
  client: inngest,
  functions: inngestFunctions,
});

function handle({ request }: { request: Request }) {
  return handler(request);
}

export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
    },
  },
});
