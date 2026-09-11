import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type RiskAlert = { id: string; alertType: string; severity: "info" | "warning" | "critical"; message: string; transactionIds: string[]; evidence: Record<string, unknown>; status: "pending_human_review"; createdAt: string };

export function detectSyntheticRisks(db: Database.Database): RiskAlert[] {
  const rows = db.prepare("SELECT id, customer_ref AS customerRef, occurred_at AS occurredAt, amount, beneficiary, country FROM transactions ORDER BY occurred_at, id").all() as Array<{ id: string; customerRef: string; occurredAt: string; amount: number; beneficiary: string; country: string }>;
  const alerts: RiskAlert[] = [];
  const insert = db.prepare("INSERT OR IGNORE INTO risk_alerts (id, alert_type, severity, message, transaction_ids, evidence, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending_human_review', ?)");
  const now = new Date().toISOString();
  const byCustomer = new Map<string, typeof rows>();
  for (const row of rows) byCustomer.set(row.customerRef, [...(byCustomer.get(row.customerRef) ?? []), row]);
  for (const customerRows of byCustomer.values()) {
    for (const row of customerRows) {
      const nearby = customerRows.filter((candidate) => Math.abs(Date.parse(candidate.occurredAt) - Date.parse(row.occurredAt)) <= 5 * 60 * 1000);
      if (nearby.length >= 3) alerts.push({ id: `velocity-${row.customerRef}`, alertType: "high_frequency", severity: "warning", message: "Varias operaciones del mismo cliente ocurrieron en pocos minutos.", transactionIds: nearby.map((item) => item.id), evidence: { windowMinutes: 5, count: nearby.length }, status: "pending_human_review", createdAt: now });
      if (row.amount >= 4000 || row.country !== "PA") alerts.push({ id: `anomaly-${row.id}`, alertType: "unusual_transaction", severity: "critical", message: "La operación requiere revisión por monto o país fuera del patrón sintético.", transactionIds: [row.id], evidence: { amount: row.amount, country: row.country }, status: "pending_human_review", createdAt: now });
      if (row.beneficiary.startsWith("new-")) alerts.push({ id: `new-beneficiary-${row.id}`, alertType: "new_beneficiary", severity: "warning", message: "La operación usa un destinatario nuevo.", transactionIds: [row.id], evidence: { beneficiary: row.beneficiary }, status: "pending_human_review", createdAt: now });
    }
  }
  for (const alert of alerts) insert.run(alert.id, alert.alertType, alert.severity, alert.message, JSON.stringify(alert.transactionIds), JSON.stringify(alert.evidence), now);
  return alerts;
}
