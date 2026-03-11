"use client";

import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { mainnet, arbitrum, optimism, polygon, base } from "@reown/appkit/networks";
import { wagmiAdapter, projectId } from "@/config/wagmi";

const queryClient = new QueryClient();

if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: [mainnet, arbitrum, optimism, polygon, base],
    defaultNetwork: mainnet,
    metadata: {
      name: "CoinFello BYOF Demo",
      description: "Bring Your Own Frontend demo for CoinFello A2A",
      url: "http://localhost:3000",
      icons: [],
    },
    features: {
      analytics: false,
    },
  });
}

export default function Providers({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: State;
}) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
