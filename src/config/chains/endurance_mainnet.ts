import { defineChain } from "viem";
export const endurance_mainnet = defineChain({
  id: 6480000002,
  name: "Endurance-Mainnet",
  network: "Endurance-Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "ACE",
    symbol: "ACE",
  },
  rpcUrls: {
    public: { http: ["https://rpc-endurance.fusionist.io"] },
    default: { http: ["https://rpc-endurance.fusionist.io"] },
  },
  blockExplorers: {
    default: {
      name: "EnduExplorer",
      url: "https://explorer-endurance.fusionist.io",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 342215,
    },
  },
});
