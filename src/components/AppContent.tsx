"use client";

import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import Chat from "./Chat";

export default function AppContent() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-zinc-100">CoinFello</h1>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
            BYOF Demo
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <button
                onClick={() => open({ view: "Account" })}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </button>
              <button
                onClick={() => disconnect()}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => open()}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      </header>

      {/* Chat */}
      <main className="flex-1 overflow-hidden">
        <Chat />
      </main>
    </div>
  );
}
