// src/services/ct-custom-object.service.ts
import { apiRoot } from '../utils/custom-fields';

type CustomObjectResource = {
  id: string;
  version: number;
  container: string;
  key: string;
  value: any;
  [k: string]: any;
};

export class CustomObjectService {
  readonly DEFAULT_CONTAINER = "nn-private-data";

  // find by container+key using where query (stable)
  async findByContainerAndKey(container: string, key: string): Promise<CustomObjectResource | null> {
    const res = await apiRoot
      .customObjects()
      .get({
        queryArgs: {
          where: `container="${container}" and key="${key}"`,
          limit: 1,
        },
      })
      .execute()
      .catch(() => null);

    const body = (res as any)?.body ?? res;
    if (!body) return null;
    const results = body.results ?? [];
    return results.length ? results[0] : null;
  }

  // create (POST /custom-objects)
  async create(container: string, key: string, value: any) {
    return apiRoot.customObjects().post({
      body: { container, key, value },
    }).execute();
  }

  // upsert: POST /custom-objects (create or replace)
  async upsert(container: string, key: string, value: any) {
    return apiRoot.customObjects().post({
      body: { container, key, value },
    }).execute();
  }

  // get resource (or null)
  async get(container: string, key: string): Promise<CustomObjectResource | null> {
    return this.findByContainerAndKey(container, key);
  }

  /**
   * clear the object's value by overwriting it with `null` (or {} if you prefer).
   * This avoids SDK delete semantics and is safe across SDK versions.
   */
  async clearSensitiveForPayment(paymentId: string, interactionId: string) {
    if (!paymentId) throw new Error("paymentId required");
    if (!interactionId) throw new Error("interactionId required");
    const key = `${paymentId}-${interactionId}`;
    // set value to null (or {} if you prefer)
    return this.upsert(this.DEFAULT_CONTAINER, key, null);
  }

  /**
   * Best-effort delete: attempts to delete using .withId(...).delete(...) if supported by the SDK.
   * If not supported it will log and return null (non-throwing).
   * Use only if you really need to remove the object rather than clearing the value.
   */
  async deleteIfSupported(container: string, key: string) {
    const existing = await this.findByContainerAndKey(container, key);
    if (!existing) return null;

    try {
      // many SDKs expose .withId(...).delete(...) — try it, but catch TypeError if missing
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof apiRoot.customObjects().withId === "function") {
        // @ts-ignore - we call it in a try/catch because typings may not show it
        return apiRoot.customObjects().withId({ ID: existing.id }).delete({ queryArgs: { version: existing.version } }).execute();
      } else {
        // fallback: SDK doesn't expose withId - return null (caller can clear instead)
        console.warn("SDK does not support .withId(...).delete(...). Falling back to clear (upsert null).");
        return this.upsert(container, key, null);
      }
    } catch (err) {
      console.warn("deleteIfSupported failed - falling back to clear (upsert null).", err);
      return this.upsert(container, key, null);
    }
  }

  // helpers tailored to payments
  buildKey(paymentId: string, interactionId: string) {
    return `${paymentId}-${interactionId}`;
  }

  async storeSensitiveForPayment(paymentId: string, interactionId: string, data: Record<string, any>) {
    if (!paymentId) throw new Error("paymentId required");
    if (!interactionId) throw new Error("interactionId required");
    const key = this.buildKey(paymentId, interactionId);
    return this.upsert(this.DEFAULT_CONTAINER, key, data);
  }

  async getSensitiveForPayment(paymentId: string, interactionId: string) {
    if (!paymentId) throw new Error("paymentId required");
    if (!interactionId) throw new Error("interactionId required");
    const key = this.buildKey(paymentId, interactionId);
    return this.get(this.DEFAULT_CONTAINER, key);
  }

  // clear by upserting null value
  async clearSensitiveForPaymentByKeys(paymentId: string, interactionId: string) {
    return this.clearSensitiveForPayment(paymentId, interactionId);
  }
}

export default new CustomObjectService();
