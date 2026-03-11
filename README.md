# CoinFello BYOF Demo

A "Bring Your Own Frontend" demo that integrates with the [CoinFello](https://app.coinfello.com) AI agent via the [A2A (Agent-to-Agent) protocol](http://docs.coinfello.com/agent/byof). Users connect a wallet, authenticate with SIWE (Sign-In With Ethereum), and chat with the CoinFello agent for DeFi operations like swaps, bridging, staking, and portfolio management.

## Architecture

- **Next.js** frontend with React 19 and Tailwind CSS
- **Reown AppKit + Wagmi** for wallet connection (Ethereum, Arbitrum, Optimism, Polygon, Base)
- **SIWE** authentication flow (nonce → sign → verify)
- **A2A proxy** (`/api/proxy/a2a`) forwards JSON-RPC requests to the CoinFello backend, supporting both request/response and SSE streaming
- **Agent discovery** via the [agent card](https://app.coinfello.com/agent/chat/.well-known/agent-card.json) — the agent skill ID is fetched dynamically at runtime

## Getting Started

### Prerequisites

- Node.js 18+
- A WalletConnect project ID from [Reown Cloud](https://cloud.reown.com)

### Setup

```bash
cp .env.example .env.local
# Edit .env.local and set your WalletConnect project ID
```

### Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/proxy/a2a/   # A2A reverse proxy to CoinFello backend
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Chat.tsx          # Main chat UI
│   ├── Providers.tsx     # Wagmi + AppKit + React Query providers
│   ├── AppContent.tsx    # App shell
│   └── ToolCallCard.tsx  # Renders agent tool calls (e.g. swap confirmations)
└── lib/
    ├── a2a.ts            # A2A JSON-RPC client (send, stream, function returns)
    └── siwe.ts           # SIWE auth helpers (nonce, message, verify)
```
