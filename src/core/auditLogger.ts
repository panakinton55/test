import type { AuditLogRecord } from "../domain.js";
import type { AlertSink } from "./alertSink.js";
import type { DataStore } from "../db/store.js";
import type { AppLogger } from "../utils/logger.js";

const UNSAFE_AUDIT = /@[a-z0-9.-]+\.[a-z]{2,}|BEGIN [A-Z0-9 ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}\./i;

export async function recordAudit(store: DataStore, entry: AuditLogRecord, logger: AppLogger, alertSink: AlertSink): Promise<void> {
  const blob = JSON.stringify({
    detection_results: entry.detectionResults,
    destination_domain: entry.destinationDomain,
    reason_code: entry.reasonCode,
  });
  if (UNSAFE_AUDIT.test(blob)) {
    logger.error({ requestId: entry.requestId }, "refusing audit entry that may contain sensitive content");
    return;
  }
  try {
    await store.createAuditLog(entry);
  } catch (error) {
    logger.error({ name: error instanceof Error ? error.name : "error", requestId: entry.requestId }, "audit log failed");
    return;
  }
  if (entry.action !== "block") return;
  try {
    await alertSink.notify(entry);
  } catch (error) {
    logger.error({ name: error instanceof Error ? error.name : "error", requestId: entry.requestId }, "alert delivery failed");
  }
}
