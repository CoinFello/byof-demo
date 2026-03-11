const BASE_URL = "/api/proxy";

export async function fetchNonce(walletAddress: string, chainId: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/siwe/nonce`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, chainId }),
  });
  if (!res.ok) throw new Error(`Nonce request failed: ${res.status}`);
  const data = await res.json();
  return data.nonce;
}

export function createSiweMessage(
  address: string,
  nonce: string,
  chainId: number,
): string {
  const issuedAt = new Date().toISOString();
  return [
    `app.coinfello.com wants you to sign in with your Ethereum account:`,
    address,
    ``,
    `URI: https://app.coinfello.com`,
    `Version: 1`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export async function verifySiwe(
  message: string,
  signature: string,
  walletAddress: string,
  chainId: number,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/siwe/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature, walletAddress, chainId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SIWE verify failed (${res.status}): ${text}`);
  }
}
