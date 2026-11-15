import { hc } from "hono/client";
import type { ApiType } from "@server/routes";

/** Names this tab on its writes, so the live-update event they trigger is ignored here (see use-live-updates). */
export const clientId = Math.random().toString(36).slice(2);

/** Typed client for the JSON API: `api.meals.$get({ query: {} })`, `api.meals[":id"].$get({ param: { id: "1" } })`. */
export const api = hc<ApiType>("/api", { headers: { "x-client-id": clientId } });

/**
 * Awaits a typed call, returns the parsed JSON body and throws `Error(message)` on a non-2xx
 * response (message = the API's `{ error }` in French when present). Use it inside queryFn / mutationFn.
 */
export async function unwrap<R extends { ok: boolean; status: number; json(): Promise<any> }>(call: Promise<R>) {
  const res = await call;
  const body = await res.json();
  if (!res.ok) {
    const error = (body as { error?: unknown } | null)?.error;
    throw new Error(typeof error === "string" ? error : `Erreur ${res.status}`);
  }
  return body as Exclude<Awaited<ReturnType<R["json"]>>, { success: false }>;
}
