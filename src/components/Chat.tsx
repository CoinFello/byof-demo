"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { fetchNonce, createSiweMessage, verifySiwe } from "@/lib/siwe";
import {
  sendMessage,
  streamFunctionReturn,
  type A2APart,
  type StreamEvent,
} from "@/lib/a2a";
import ToolCallCard from "./ToolCallCard";

const AGENT_CARD_URL =
  "https://app.coinfello.com/agent/chat/.well-known/agent-card.json";

/** Expand `data` parts with `client_tool_calls` into individual `functionCall` parts. */
function expandParts(parts: A2APart[]): A2APart[] {
  const result: A2APart[] = [];
  for (const part of parts) {
    if (
      part.type === "data" &&
      part.data?.type === "client_tool_calls" &&
      Array.isArray(part.data.toolCalls)
    ) {
      for (const tc of part.data.toolCalls) {
        result.push({
          type: "functionCall",
          id: tc.callId,
          name: tc.name,
          parameters: typeof tc.arguments === "string"
            ? JSON.parse(tc.arguments)
            : tc.arguments,
        });
      }
    } else {
      result.push(part);
    }
  }
  return result;
}

interface ChatMessage {
  role: "user" | "agent";
  parts: A2APart[];
}

export default function Chat() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { open } = useAppKit();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | undefined>();
  const [streamingText, setStreamingText] = useState("");
  const [agentId, setAgentId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchAgentId() {
      try {
        const res = await fetch(AGENT_CARD_URL);
        const card = await res.json();
        setAgentId(Number(card.skills[0].id));
      } catch (err) {
        console.error("Failed to fetch agent card:", err);
      }
    }
    fetchAgentId();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Reset auth when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setIsAuthed(false);
      setMessages([]);
      setTaskId(undefined);
    }
  }, [isConnected]);

  async function handleSignIn() {
    if (!address || !chainId) return;
    setAuthLoading(true);
    try {
      const nonce = await fetchNonce(address, chainId);
      const message = createSiweMessage(address, nonce, chainId);
      const signature = await signMessageAsync({ message });
      await verifySiwe(message, signature, address, chainId);
      setIsAuthed(true);
    } catch (err) {
      console.error("SIWE auth failed:", err);
    } finally {
      setAuthLoading(false);
    }
  }

  const processStreamEvents = useCallback(
    (currentParts: A2APart[]) => {
      return (event: StreamEvent) => {
        if (event.error) {
          console.error("Stream error:", event.error);
          return;
        }
        const r = event.result;
        if (!r) return;

        if (r.taskId && !taskId) {
          setTaskId(r.taskId);
        }

        if (r.type === "task/artifact-update" && r.part) {
          if (r.part.type === "text" && r.part.text) {
            setStreamingText((prev) => prev + r.part!.text);
          } else {
            currentParts.push(...expandParts([r.part]));
          }
        }

        if (r.type === "task/status-update" && r.status?.message) {
          // Status update with final message — accumulate any parts
          for (const p of expandParts(r.status.message.parts)) {
            if (p.type === "text" && p.text) {
              setStreamingText((prev) => prev + p.text);
            } else {
              currentParts.push(p);
            }
          }
        }
      };
    },
    [taskId],
  );

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", parts: [{ type: "text", text }] }]);
    setIsLoading(true);
    setStreamingText("");

    const collectedParts: A2APart[] = [];

    try {
      if (agentId === null){
        throw new Error('null agent id')
      }
      const response = await sendMessage(text, agentId, taskId);
      console.log("[chat] sendMessage response:", JSON.stringify(response, null, 2));
      if (response.error) {
        console.error("Send failed:", response.error);
        collectedParts.push({ type: "text", text: response.error.message });
      } else if (response.result) {
        if (response.result.id && !taskId) {
          setTaskId(response.result.id);
        }
        if (response.result.status?.message) {
          collectedParts.push(...expandParts(response.result.status.message.parts));
        }
      }
    } catch (err) {
      console.error("Send failed:", err);
      collectedParts.push({ type: "text", text: "Connection error. Please try again." });
    }

    if (collectedParts.length > 0) {
      setMessages((prev) => [...prev, { role: "agent", parts: collectedParts }]);
    }
    setStreamingText("");

    setIsLoading(false);
    inputRef.current?.focus();
  }

  async function handleToolResult(
    callId: string,
    name: string,
    result: Record<string, unknown>,
  ) {
    if (!taskId) return;
    setIsLoading(true);
    setStreamingText("");

    const collectedParts: A2APart[] = [];

    try {
      await streamFunctionReturn(
        callId,
        name,
        result,
        agentId!,
        taskId,
        processStreamEvents(collectedParts),
      );
    } catch (err) {
      console.error("Function return failed:", err);
      collectedParts.push({ type: "text", text: "Failed to send result. Please try again." });
    }

    setStreamingText((currentStreamText) => {
      const finalParts: A2APart[] = [];
      if (currentStreamText) {
        finalParts.push({ type: "text", text: currentStreamText });
      }
      finalParts.push(...collectedParts);

      if (finalParts.length > 0) {
        setMessages((prev) => [...prev, { role: "agent", parts: finalParts }]);
      }
      return "";
    });

    setIsLoading(false);
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-zinc-100">Connect your wallet</h2>
          <p className="mt-2 text-zinc-400">Connect a wallet to start chatting with CoinFello</p>
        </div>
        <button
          onClick={() => open()}
          className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  // Connected but not authenticated
  if (!isAuthed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-zinc-100">Sign in</h2>
          <p className="mt-2 text-zinc-400">
            Sign a message with your wallet to authenticate with CoinFello
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>
        <button
          onClick={handleSignIn}
          disabled={authLoading}
          className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
        >
          {authLoading ? "Signing..." : "Sign In with Ethereum"}
        </button>
      </div>
    );
  }

  // Authenticated — chat
  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-zinc-500">Ask CoinFello anything about DeFi, swaps, yields, or your portfolio.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-200"
              }`}
            >
              {msg.parts.map((part, j) => {
                if (part.type === "text") {
                  return (
                    <p key={j} className="whitespace-pre-wrap text-sm leading-relaxed">
                      {part.text}
                    </p>
                  );
                }
                if (part.type === "functionCall") {
                  return (
                    <ToolCallCard
                      key={j}
                      part={part}
                      onResult={handleToolResult}
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {(isLoading || streamingText) && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl bg-zinc-800 px-4 py-3 text-zinc-200">
              {streamingText ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{streamingText}</p>
              ) : (
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about swaps, yields, balances..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
