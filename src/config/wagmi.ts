import { cookieStorage, createStorage } from "wagmi";
import { mainnet, arbitrum, optimism, polygon, base } from "wagmi/chains";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export const chains = [mainnet, arbitrum, optimism, polygon, base] as const;

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks: [...chains],
});
