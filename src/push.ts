import { cloudConfigured, cloudFunction } from "./cloud";
import type { ReminderSchedule } from "./notification-schedule";
import { nextReminder } from "./notification-schedule";
const key = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || "";
export const pushConfigured =
  cloudConfigured && /^[A-Za-z0-9_-]{80,100}$/.test(key);
export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window &&
  window.isSecureContext;
export async function enablePush(
  schedule: Omit<ReminderSchedule, "category">,
  categories: ("daily" | "weekly")[],
) {
  if (!pushConfigured || !pushSupported())
    throw new Error(
      "Background reminders are unavailable here. In-app reminders are still available in Settings.",
    );
  if (!categories.length)
    throw new Error("Choose at least one reminder category.");
  categories.forEach((category) =>
    nextReminder({ ...schedule, category }, new Date()),
  );
  // Readiness comes before permission so development mode never prompts uselessly.
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active)
    throw new Error(
      "Open the installed or production version of BAGA first. The offline service must be ready before enabling reminders.",
    );
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error(
      "Notification permission was not granted. In-app reminders are still available.",
    );
  const old = await registration.pushManager.getSubscription();
  const bytes = Uint8Array.from(
    atob(key.replaceAll("-", "+").replaceAll("_", "/")),
    (char) => char.charCodeAt(0),
  );
  const subscription =
    old ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    }));
  try {
    await cloudFunction("push-subscription", {
      action: "save",
      subscription: subscription.toJSON(),
      schedule,
      categories,
    });
  } catch (error) {
    if (!old) await subscription.unsubscribe();
    throw error;
  }
}
export async function disablePush() {
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await cloudFunction("push-subscription", { action: "remove", endpoint });
}
