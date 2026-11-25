import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/actions/switch";
import { Label } from "@/components/ui/inputs/label";
import { api, unwrap } from "@/lib/api/api";

/** Push needs the service worker (installed by the production build) and the Push API (on iPhone: the app on the home screen). */
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const registration = () => navigator.serviceWorker.getRegistration();

/** The server's VAPID public key (base64url) as the bytes `subscribe` wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function enable(): Promise<boolean> {
  const reg = await registration();
  if (!reg) throw new Error("Rappels indisponibles ici : ouvrez l’app installée.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications refusées dans le navigateur.");
  const { key } = await unwrap(api.push.key.$get());
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  const { endpoint, keys } = sub.toJSON();
  await unwrap(api.push.subscription.$post({ json: { endpoint: endpoint!, keys: { p256dh: keys!.p256dh!, auth: keys!.auth! } } }));
  return true;
}

async function disable(): Promise<boolean> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (sub) {
    await unwrap(api.push.unsubscribe.$post({ json: { endpoint: sub.endpoint } }));
    await sub.unsubscribe();
  }
  return false;
}

/** This device's leftover reminder (one a day at 17:00 when a leftover waits for 2 days or more): each device opts in. */
export function ReminderSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supported()) return;
    void registration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setOn(Boolean(sub) && Notification.permission === "granted"));
  }, []);
  if (!supported()) return null;

  const toggle = (next: boolean) => {
    setBusy(true);
    (next ? enable() : disable())
      .then(setOn)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <Label className="flex min-h-8 items-center justify-between gap-2 border-t border-border pt-3 text-xs font-normal max-md:min-h-11 max-md:text-sm">
      Rappels restes sur cet appareil
      <Switch checked={on ?? false} disabled={on === null || busy} onCheckedChange={toggle} />
    </Label>
  );
}
