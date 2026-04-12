import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";

import type { AppRouter } from "../server/router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Local development — use your machine's LAN IP when testing on device
  return "http://localhost:3000";
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      headers() {
        // Token is injected here once auth is wired up
        return {};
      },
    }),
  ],
});
