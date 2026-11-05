export type ProxyForward = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  proof: string;
};

export type ProxyResult = {
  status: number;
  bodyText: string;
};

export type ProxyClient = {
  forward(input: ProxyForward): Promise<ProxyResult>;
};

const HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-connection",
]);

export function createFetchProxyClient(fetchImpl: typeof fetch = fetch): ProxyClient {
  return {
    async forward(input) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(input.headers)) {
        if (HOP.has(key.toLowerCase())) continue;
        headers.set(key, value);
      }
      headers.set("X-AgentSecure-Context", input.proof);
      const sendBody = input.body !== undefined && input.method !== "GET";
      if (sendBody && !headers.has("content-type")) headers.set("content-type", "application/json");
      const response = await fetchImpl(input.url, {
        method: input.method,
        headers,
        body: sendBody ? (typeof input.body === "string" ? input.body : JSON.stringify(input.body)) : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      // TODO(security): redirects are rejected so a destination cannot bounce to an unapproved host.
      if (response.status >= 300 && response.status < 400) {
        throw new Error("upstream redirect rejected");
      }
      const bodyText = await response.text();
      if (bodyText.length > 1_000_000) {
        return { status: response.status, bodyText: "[REDACTED:UPSTREAM_BODY_TOO_LARGE]" };
      }
      return { status: response.status, bodyText };
    },
  };
}
