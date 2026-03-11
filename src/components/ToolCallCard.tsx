"use client";

import { useState } from "react";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { parseEther, encodeFunctionData, type Abi } from "viem";
import type { A2APart } from "@/lib/a2a";

interface ToolCallCardProps {
  part: A2APart;
  onResult: (callId: string, name: string, result: Record<string, unknown>) => void;
}

export default function ToolCallCard({ part, onResult }: ToolCallCardProps) {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const [status, setStatus] = useState<"pending" | "executing" | "done" | "error">("pending");
  const [error, setError] = useState<string | null>(null);

  const params = (part.parameters || {}) as Record<string, string | number | unknown[]>;
  const callId = part.id!;
  const name = part.name!;

  async function handleApprove() {
    setStatus("executing");
    setError(null);

    try {
      const chainId = (params.chainId as number) || 1;

      try {
        await switchChainAsync({ chainId });
      } catch {
        // chain might already be selected
      }

      let txHash: string | undefined;

      if (name === "send_native_gas_token") {
        txHash = await sendTransactionAsync({
          to: params.to as `0x${string}`,
          value: BigInt(params.value as string),
          chainId,
        });
      } else if (name === "call_smart_contract_function") {
        const abi = params.abi as Abi;
        const data = encodeFunctionData({
          abi,
          functionName: params.functionName as string,
          args: params.args as unknown[],
        });
        txHash = await sendTransactionAsync({
          to: params.to as `0x${string}`,
          data,
          value: params.value ? BigInt(params.value as string) : 0n,
          chainId,
        });
      } else if (name === "execute_lifi_swap") {
        // For LI.FI swaps, fetch quote from LI.FI API then execute
        const quoteParams = new URLSearchParams({
          fromChain: String(params.fromChainId),
          toChain: String(params.toChainId),
          fromToken: params.fromTokenAddress as string,
          toToken: params.toTokenAddress as string,
          fromAmount: params.fromAmount as string,
          fromAddress: address!,
          slippage: String(params.slippage || 0.005),
        });
        const quoteRes = await fetch(`https://li.quest/v1/quote?${quoteParams}`);
        if (!quoteRes.ok) throw new Error("Failed to get LI.FI quote");
        const quote = await quoteRes.json();

        txHash = await sendTransactionAsync({
          to: quote.transactionRequest.to as `0x${string}`,
          data: quote.transactionRequest.data as `0x${string}`,
          value: BigInt(quote.transactionRequest.value || "0"),
          chainId: params.fromChainId as number,
        });
      } else if (name === "transfer_nft") {
        // ERC-721 safeTransferFrom
        const data = encodeFunctionData({
          abi: [
            {
              name: "safeTransferFrom",
              type: "function",
              inputs: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "tokenId", type: "uint256" },
              ],
              outputs: [],
              stateMutability: "nonpayable",
            },
          ],
          functionName: "safeTransferFrom",
          args: [
            address!,
            params.toAddress as `0x${string}`,
            BigInt(params.tokenId as string),
          ],
        });
        txHash = await sendTransactionAsync({
          to: params.contractAddress as `0x${string}`,
          data,
          chainId,
        });
      } else if (name === "show_token_balance_ui") {
        // No tx needed — just acknowledge
        onResult(callId, name, { displayed: true });
        setStatus("done");
        return;
      } else {
        // For staking/aave/other tools, handle generically
        onResult(callId, name, { acknowledged: true, walletAddress: address });
        setStatus("done");
        return;
      }

      onResult(callId, name, { txHash: txHash || "0x" });
      setStatus("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setError(msg);
      setStatus("error");
    }
  }

  function handleReject() {
    onResult(callId, name, { error: "User rejected the action" });
    setStatus("done");
  }

  const chainNames: Record<number, string> = {
    1: "Ethereum",
    10: "Optimism",
    137: "Polygon",
    8453: "Base",
    42161: "Arbitrum",
  };

  return (
    <div className="my-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
          Tool Call
        </span>
        <span className="text-sm font-mono text-zinc-300">{name}</span>
      </div>

      <div className="mb-3 space-y-1 text-sm text-zinc-400">
        {name === "send_native_gas_token" && (
          <>
            <p>To: <span className="font-mono text-zinc-300">{params.to as string}</span></p>
            <p>Amount: <span className="text-zinc-300">{Number(BigInt(params.value as string)) / 1e18} ETH</span></p>
            <p>Chain: <span className="text-zinc-300">{chainNames[Number(params.chainId)] || String(params.chainId)}</span></p>
          </>
        )}
        {name === "execute_lifi_swap" && (
          <>
            <p>Swap: <span className="text-zinc-300">{String(params.fromTokenSymbol)} → {String(params.toTokenSymbol)}</span></p>
            <p>Amount: <span className="text-zinc-300">{Number(BigInt(String(params.fromAmount))) / 10 ** Number(params.fromTokenDecimals)} {String(params.fromTokenSymbol)}</span></p>
            <p>Chain: <span className="text-zinc-300">{chainNames[Number(params.fromChainId)] || String(params.fromChainId)}{params.fromChainId !== params.toChainId ? ` → ${chainNames[Number(params.toChainId)] || String(params.toChainId)}` : ""}</span></p>
          </>
        )}
        {name === "call_smart_contract_function" && (
          <>
            <p>Contract: <span className="font-mono text-zinc-300">{String(params.to)}</span></p>
            <p>Function: <span className="text-zinc-300">{String(params.functionName)}</span></p>
            <p>Chain: <span className="text-zinc-300">{chainNames[Number(params.chainId)] || String(params.chainId)}</span></p>
          </>
        )}
        {name === "show_token_balance_ui" && (
          <div className="space-y-1">
            <p>Total: <span className="text-zinc-300">${Number(params.totalValue).toFixed(2)}</span></p>
            {(params.balances as unknown as Array<{ symbol: string; amount: string; value: number }>)?.slice(0, 5).map((b, i) => (
              <p key={i} className="pl-2 text-xs">
                {b.symbol}: {b.amount} (${b.value?.toFixed(2)})
              </p>
            ))}
          </div>
        )}
        {!["send_native_gas_token", "execute_lifi_swap", "call_smart_contract_function", "show_token_balance_ui"].includes(name) && (
          <pre className="max-h-32 overflow-auto rounded bg-zinc-900 p-2 text-xs">
            {JSON.stringify(params, null, 2)}
          </pre>
        )}
      </div>

      {status === "pending" && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={handleReject}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-600 transition-colors"
          >
            Reject
          </button>
        </div>
      )}
      {status === "executing" && (
        <p className="text-sm text-amber-400 animate-pulse">Executing transaction...</p>
      )}
      {status === "done" && (
        <p className="text-sm text-emerald-400">Completed</p>
      )}
      {status === "error" && (
        <div>
          <p className="text-sm text-red-400">{error}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleApprove}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleReject}
              className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
