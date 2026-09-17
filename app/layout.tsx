'use client';
// Must come first: neutralizes Node's non-functional `localStorage` global
// before RainbowKit's module loads and feature-detects it during SSR.
import '@/lib/nodeStorageShim';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mainnet, polygon, arbitrum } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { TopNavBar } from '@/components/TopNavBar';

// 1. Setup the Config (The "Settings")
// 2. Move the shardeum object OUTSIDE the config
// 3. Define Mezame OUTSIDE the config
const shardeumMezame = {
  id: 8119, // Matches your wallet screenshot!
  name: 'Shardeum Mezame',
  nativeCurrency: { name: 'SHM', symbol: 'SHM', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api-mezame.shardeum.org'] },
  },
  blockExplorers: {
    default: { name: 'Mezame Explorer', url: 'https://explorer-mezame.shardeum.org/' },
  },
} as const;

const shardeum = {
  id: 8082, // Updated to Sphinx 1.X Chain ID
  name: 'Shardeum Sphinx',
  nativeCurrency: { name: 'SHM', symbol: 'SHM', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sphinx.shardeum.org/'] },
  },
  blockExplorers: {
    default: { name: 'Shardeum Explorer', url: 'https://explorer-sphinx.shardeum.org/' },
  },
} as const;

// 2. Pass it into the config
const config = getDefaultConfig({
  appName: 'Kredence: DeFi Wallet Evaluator',
  projectId: 'd7b162fc2310de90b4cb55ee42751d2b',
  chains: [mainnet, polygon, arbitrum, shardeumMezame], 
  ssr: true,
});

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL,GRAD,opsz@100..700,0..1,-50..200,20..48&display=block" rel="stylesheet" />
      </head>
      <body className="bg-background text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container">
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider theme={darkTheme()}>
              <TopNavBar />
              {children}
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}