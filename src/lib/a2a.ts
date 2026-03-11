const A2A_URL = "/api/proxy/a2a";

let rpcId = 0;
function nextId() {
  return ++rpcId;
}

export interface A2APart {
  type: string;
  text?: string;
  name?: string;
  id?: string;
  parameters?: Record<string, unknown>;
  result?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
}

export interface A2AMessage {
  role: "user" | "agent";
  parts: A2APart[];
}

export interface A2ATask {
  id: string;
  status: { state: string; message?: A2AMessage };
  history?: A2AMessage[];
}

export interface A2AResponse {
  jsonrpc: string;
  id: number;
  result?: A2ATask;
  error?: { code: number; message: string };
}

export async function sendMessage(
  text: string,
  agentId: number,
  taskId?: string,
): Promise<A2AResponse> {
  const params: Record<string, unknown> = {
    configuration: { agentId },
    message: {
      role: "user",
      parts: [{ type: "text", text }],
    },
  };
  if (taskId) params.taskId = taskId;

  const res = await fetch(A2A_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId(),
      method: "message/send",
      params,
    }),
  });
  return res.json();
}

export async function sendFunctionReturn(
  callId: string,
  name: string,
  result: Record<string, unknown>,
  agentId: number,
  taskId: string,
): Promise<A2AResponse> {
  const res = await fetch(A2A_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId(),
      method: "message/send",
      params: {
        configuration: { agentId },
        taskId,
        message: {
          role: "user",
          parts: [
            {
              type: "functionReturn",
              id: callId,
              name,
              result,
            },
          ],
        },
      },
    }),
  });
  return res.json();
}

export interface StreamEvent {
  jsonrpc: string;
  id: number;
  result?: {
    type: string;
    taskId?: string;
    status?: { state: string; message?: A2AMessage };
    part?: A2APart;
  };
  error?: { code: number; message: string };
}

export async function streamMessage(
  text: string,
  agentId: number,
  taskId: string | undefined,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const params: Record<string, unknown> = {
    configuration: { agentId },
    message: {
      role: "user",
      parts: [{ type: "text", text }],
    },
  };
  if (taskId) params.taskId = taskId;

  const res = await fetch(A2A_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId(),
      method: "message/stream",
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`Stream request failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const data = trimmed.slice(5).trim();
        if (data) {
          try {
            onEvent(JSON.parse(data));
          } catch {
            // skip malformed events
          }
        }
      }
    }
  }
}

export async function streamFunctionReturn(
  callId: string,
  name: string,
  result: Record<string, unknown>,
  agentId: number,
  taskId: string,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const res = await fetch(A2A_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId(),
      method: "message/stream",
      params: {
        configuration: { agentId },
        taskId,
        message: {
          role: "user",
          parts: [
            {
              type: "functionReturn",
              id: callId,
              name,
              result,
            },
          ],
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Stream request failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const data = trimmed.slice(5).trim();
        if (data) {
          try {
            onEvent(JSON.parse(data));
          } catch {
            // skip malformed events
          }
        }
      }
    }
  }
}
