import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";
import { getApiBaseUrl } from "@/lib/api-base-url";

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl(): string {
  const url = getApiBaseUrl();
  if (!url) {
    throw new Error(
      "EXPO_PUBLIC_RORK_API_BASE_URL is not set or invalid. Use an HTTP(S) origin (e.g. http://localhost:3000). See TROUBLESHOOTING.md for \"Cannot GET /node_modules/...\".",
    );
  }
  const raw = process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim() ?? '';
  if (raw.includes('.exp.direct') || raw.includes('ngrok')) {
    console.warn('[tRPC] Using ngrok tunnel. If you see ERR_NGROK_3200, restart the dev server with --tunnel.');
  }
  return url;
}

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});
