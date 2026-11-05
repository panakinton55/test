import type { AuditLogRecord } from "../domain.js";

export type AlertSink = {
  notify(entry: AuditLogRecord): Promise<void>;
};

export function createNoopAlertSink(): AlertSink {
  return { async notify() {} };
}

export function createWebhookAlertSink(url: string, fetchImpl: typeof fetch = fetch): AlertSink {
  return {
    async notify(entry) {
      if (entry.action !== "block") return;
      const categories = [...new Set(entry.detectionResults.map((item) => item.category))];
      // TODO(security): sign this payload and pin the webhook host before production use.
      await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "policy_violation",
          request_id: entry.requestId,
          tenant_id: entry.tenantId,
          agent_id: entry.agentId,
          policy_id: entry.policyId,
          reason_code: entry.reasonCode,
          action: entry.action,
          destination_domain: entry.destinationDomain,
          categories,
          timestamp: entry.timestamp.toISOString(),
        }),
        signal: AbortSignal.timeout(2000),
      });
    },
  };
}
