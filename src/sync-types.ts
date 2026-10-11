export const cloudKinds = [
  "logs",
  "preferences",
  "checkins",
  "measurements",
  "variants",
  "cravings",
] as const;
export type CloudKind = (typeof cloudKinds)[number];
export type Payload = Record<string, unknown> | null;
export interface CloudRow {
  key: string;
  kind: CloudKind;
  record_id: string;
  payload: Payload;
  revision: number;
}
export interface CloudMeta {
  id: "account";
  userId: string;
  enabled: boolean;
  lastSync?: string;
}
export interface SyncRecord {
  key: string;
  revision: number;
  baseline: string;
}
export interface SyncOperation {
  key: string;
  operationId: string;
  kind: CloudKind;
  recordId: string;
  payload: Payload;
  expectedRevision: number;
  snapshot: string;
  retries: number;
}
export interface SyncConflict {
  key: string;
  remote: CloudRow;
  local: Payload;
}
export interface SyncResult {
  operation_id: string;
  status: "applied" | "conflict";
  row: CloudRow;
}
export interface SyncTransport {
  pull(): Promise<CloudRow[]>;
  push(operations: SyncOperation[]): Promise<SyncResult[]>;
}
