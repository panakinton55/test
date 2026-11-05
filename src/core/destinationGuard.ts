const BLOCKED_SUFFIXES = [".localhost", ".local", ".localdomain", ".internal", ".intranet", ".nip.io", ".sslip.io"];

export function isUnsafeHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host === "metadata.google.internal") return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  // TODO(security): resolve DNS and reject private, link-local, and metadata addresses after resolution.
  if (host.includes(":")) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  return false;
}

export function domainAllowed(hostname: string, allowed: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return allowed.some((rule) => {
    const normalized = rule.toLowerCase().replace(/\.$/, "");
    if (normalized.startsWith("*.")) {
      const suffix = normalized.slice(1);
      return host.endsWith(suffix) && host.length > suffix.length;
    }
    return host === normalized;
  });
}
