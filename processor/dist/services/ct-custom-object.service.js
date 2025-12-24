"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomObjectService = void 0;
// src/services/ct-custom-object.service.ts
const custom_fields_1 = require("../utils/custom-fields");
class CustomObjectService {
    DEFAULT_CONTAINER = "nn-private-data";
    // find by container+key using where query (stable)
    async findByContainerAndKey(container, key) {
        const res = await custom_fields_1.apiRoot
            .customObjects()
            .get({
            queryArgs: {
                where: `container="${container}" and key="${key}"`,
                limit: 1,
            },
        })
            .execute()
            .catch(() => null);
        const body = res?.body ?? res;
        if (!body)
            return null;
        const results = body.results ?? [];
        return results.length ? results[0] : null;
    }
    // create (POST /custom-objects)
    async create(container, key, value) {
        return custom_fields_1.apiRoot.customObjects().post({
            body: { container, key, value },
        }).execute();
    }
    // upsert: POST /custom-objects (create or replace)
    async upsert(container, key, value) {
        return custom_fields_1.apiRoot.customObjects().post({
            body: { container, key, value },
        }).execute();
    }
    // get resource (or null)
    async get(container, key) {
        return this.findByContainerAndKey(container, key);
    }
    /**
     * clear the object's value by overwriting it with `null` (or {} if you prefer).
     * This avoids SDK delete semantics and is safe across SDK versions.
     */
    async clearSensitiveForPayment(paymentId, interactionId) {
        if (!paymentId)
            throw new Error("paymentId required");
        if (!interactionId)
            throw new Error("interactionId required");
        const key = `${paymentId}-${interactionId}`;
        // set value to null (or {} if you prefer)
        return this.upsert(this.DEFAULT_CONTAINER, key, null);
    }
    /**
     * Best-effort delete: attempts to delete using .withId(...).delete(...) if supported by the SDK.
     * If not supported it will log and return null (non-throwing).
     * Use only if you really need to remove the object rather than clearing the value.
     */
    async deleteIfSupported(container, key) {
        const existing = await this.findByContainerAndKey(container, key);
        if (!existing)
            return null;
        try {
            // many SDKs expose .withId(...).delete(...) — try it, but catch TypeError if missing
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (typeof custom_fields_1.apiRoot.customObjects().withId === "function") {
                // @ts-ignore - we call it in a try/catch because typings may not show it
                return custom_fields_1.apiRoot.customObjects().withId({ ID: existing.id }).delete({ queryArgs: { version: existing.version } }).execute();
            }
            else {
                // fallback: SDK doesn't expose withId - return null (caller can clear instead)
                console.warn("SDK does not support .withId(...).delete(...). Falling back to clear (upsert null).");
                return this.upsert(container, key, null);
            }
        }
        catch (err) {
            console.warn("deleteIfSupported failed - falling back to clear (upsert null).", err);
            return this.upsert(container, key, null);
        }
    }
    // helpers tailored to payments
    buildKey(paymentId, interactionId) {
        return `${paymentId}-${interactionId}`;
    }
    async storeSensitiveForPayment(paymentId, interactionId, data) {
        if (!paymentId)
            throw new Error("paymentId required");
        if (!interactionId)
            throw new Error("interactionId required");
        const key = this.buildKey(paymentId, interactionId);
        return this.upsert(this.DEFAULT_CONTAINER, key, data);
    }
    async getSensitiveForPayment(paymentId, interactionId) {
        if (!paymentId)
            throw new Error("paymentId required");
        if (!interactionId)
            throw new Error("interactionId required");
        const key = this.buildKey(paymentId, interactionId);
        return this.get(this.DEFAULT_CONTAINER, key);
    }
    // clear by upserting null value
    async clearSensitiveForPaymentByKeys(paymentId, interactionId) {
        return this.clearSensitiveForPayment(paymentId, interactionId);
    }
}
exports.CustomObjectService = CustomObjectService;
exports.default = new CustomObjectService();
