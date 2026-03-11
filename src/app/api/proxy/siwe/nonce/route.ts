import { NextRequest, NextResponse } from "next/server";

const TARGET = "https://app.coinfello.com/api/auth/siwe/nonce";

export async function POST(req: NextRequest) {
  console.log('hello')
  const body = await req.text();

  const upstream = await fetch(TARGET, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") || "",
    },
    body,
  });

  const data = await upstream.text();
  const res = new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });

  // Forward set-cookie headers from CoinFello
  const setCookies = upstream.headers.getSetCookie();
  for (const c of setCookies) {
    res.headers.append("set-cookie", c);
  }

  return res;
}
