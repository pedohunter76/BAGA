import { useEffect, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import {
  cloudConfigured,
  cloudTransport,
  getSession,
  subscribeSession,
} from "./cloud";
import { syncDiary } from "./sync";

let status = { busy: false, error: "" };
const listeners = new Set<() => void>();
export const getSyncStatus = () => status;
export function subscribeSyncStatus(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
function setStatus(value: typeof status) {
  status = value;
  listeners.forEach((listener) => listener());
}
export async function runCloudSync(userId: string) {
  setStatus({ busy: true, error: "" });
  try {
    await syncDiary(userId, cloudTransport(userId));
    setStatus({ busy: false, error: "" });
  } catch {
    setStatus({
      busy: false,
      error:
        "Sync could not finish. Your records remain on this device. Reconnect or sign in again, then retry.",
    });
  }
}
export function CloudAutoSync() {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const meta = useLiveQuery(() => db.cloudMeta.get("account"));
  const changes = useLiveQuery(async () => {
    // Subscribe to all user tables, including edits that do not change row counts.
    await Promise.all([
      db.logs.toArray(),
      db.preferences.toArray(),
      db.checkins.toArray(),
      db.measurements.toArray(),
      db.variants.toArray(),
      db.cravings.toArray(),
    ]);
    return crypto.randomUUID();
  });
  useEffect(() => {
    if (
      !cloudConfigured ||
      !session ||
      !meta?.enabled ||
      meta.userId !== session.user.id
    )
      return;
    const sync = () => {
      if (navigator.onLine) void runCloudSync(session.user.id);
    };
    const timer = setTimeout(sync, 1500);
    const interval = setInterval(sync, 60_000);
    window.addEventListener("online", sync);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", sync);
    };
  }, [session, meta?.enabled, meta?.userId, changes]);
  return null;
}
