import { NextRequest, NextResponse } from "next/server";

const TARGET = "https://app.coinfello.com/api/a2a";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const upstream = await fetch(TARGET, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") || "",
    },
    body,
  });

  // Check if this is a streaming response (SSE)
  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const res = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
    const setCookies = upstream.headers.getSetCookie();
    for (const c of setCookies) {
      res.headers.append("set-cookie", c);
    }
    return res;
  }

  const data = await upstream.text();
  const res = new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });

  const setCookies = upstream.headers.getSetCookie();
  for (const c of setCookies) {
    res.headers.append("set-cookie", c);
  }

  return res;
}
