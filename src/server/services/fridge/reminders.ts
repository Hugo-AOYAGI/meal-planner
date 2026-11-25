import { eq } from "drizzle-orm";
import webpush from "web-push";
import type { Leftover, PushSubscriptionInput } from "@shared/schemas";
import { db } from "../../db";
import { pushSubscription, setting } from "../../db/schema";
import { listFridge } from "./leftovers";

/** A leftover this many days old or more is worth a reminder. */
export const REMIND_AFTER_DAYS = 2;
/** The reminder goes out once a day at this local hour. */
const REMIND_HOUR = 17;
const VAPID_KEY = "vapid";
/** Who to contact about the pushes, sent to the push services; override it with an address of yours. */
const SUBJECT = process.env.MEAL_PLANNER_PUSH_SUBJECT ?? "mailto:meal-planner@example.com";

/** The server's VAPID keys, made on first use and kept in the database. */
function vapid(): { publicKey: string; privateKey: string } {
  const row = db.select().from(setting).where(eq(setting.key, VAPID_KEY)).get();
  if (row) return row.value as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  db.insert(setting).values({ key: VAPID_KEY, value: keys }).onConflictDoNothing().run();
  return keys;
}

export const pushPublicKey = () => vapid().publicKey;

export function subscribe({ endpoint, keys }: PushSubscriptionInput): void {
  db.insert(pushSubscription)
    .values({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: { p256dh: keys.p256dh, auth: keys.auth } })
    .run();
}

export function unsubscribe(endpoint: string): void {
  db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint)).run();
}

const portions = (n: number) => `${n} part${n > 1 ? "s" : ""}`;

/** The reminder's text, or null when nothing in the fridge is old enough to remind of. */
export function reminderText(fridge: Leftover[]): string | null {
  const old = fridge.filter((l) => l.age >= REMIND_AFTER_DAYS);
  if (!old.length) return null;
  return `Au frigo : ${old.map((l) => `${l.name.toLowerCase()} (${portions(l.remaining)}, ${l.age} j)`).join(", ")}`;
}

/** Sends the reminder to every subscribed device; subscriptions the push service no longer knows are dropped. */
export async function sendReminder(): Promise<number> {
  const body = reminderText(listFridge());
  if (!body) return 0;
  const { publicKey, privateKey } = vapid();
  const payload = JSON.stringify({ title: "Restes", body, url: "/#planning" });
  let sent = 0;
  for (const s of db.select().from(pushSubscription).all()) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        vapidDetails: { subject: SUBJECT, publicKey, privateKey },
        // normal urgency: Android may hold it until the phone wakes, which is fine for a reminder
        TTL: 6 * 3600,
      });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) unsubscribe(s.endpoint);
      else console.error("push failed", status ?? e);
    }
  }
  return sent;
}

/** Sends the leftover reminder every day at 17:00 (local time), in-process. */
export function scheduleReminders(): void {
  const next = new Date();
  next.setHours(REMIND_HOUR, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    sendReminder()
      .catch((e) => console.error("reminder failed", e))
      .finally(scheduleReminders);
  }, next.getTime() - Date.now()).unref();
}
