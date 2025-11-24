// src/services/order.service.ts
import type { Order } from '@commercetools/platform-sdk';
import type { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { getApiRoot } from '../utils/ct-client.js';

/** Small safe logger to avoid huge dumps */
function safeSnippet(obj: any, max = 1000) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    return s.length > max ? s.slice(0, max) + '... (truncated)' : s;
  } catch {
    return String(obj).slice(0, max);
  }
}

/**
 * Attempts several strategies to find an Order:
 * 1) withOrderNumber (direct)
 * 2) where orderNumber="..." (fallback)
 * 3) where paymentInfo(payments(id="...")) when paymentId provided
 * 4) optional: order search (index-based) -> returns IDs -> fetch by id
 */
export async function findOrder({
  orderNumber,
  paymentId,
  useSearch = false,
}: {
  orderNumber?: string;
  paymentId?: string;
  useSearch?: boolean;
}): Promise<Order | null> {
  const trimmed = (orderNumber ?? '').toString().trim();
  const apiRoot: ByProjectKeyRequestBuilder = getApiRoot();

  // 1) Direct endpoint: /orders/order-number=...
  if (trimmed) {
    try {
      const resp = await apiRoot.orders().withOrderNumber({ orderNumber: trimmed }).get().execute();
      console.log('[CT] withOrderNumber status:', (resp as any)?.statusCode ?? '(unknown)');
      console.log('[CT] withOrderNumber body snippet:', safeSnippet(resp?.body, 1500));
      const order = resp?.body as Order | undefined;
      if (order?.id) return order;
    } catch (err: any) {
      const status = err?.statusCode ?? err?.response?.statusCode ?? err?.response?.status;
      console.warn('[CT] withOrderNumber failed status:', status);
      if (status === 404) {
        console.log(`[CT] withOrderNumber: not found for "${trimmed}"`);
      } else {
        console.warn('[CT] withOrderNumber error:', safeSnippet(err?.response?.body ?? err?.message ?? err));
      }
      // continue to fallback
    }

    // 2) Fallback: where query on orderNumber
    try {
      const q = await apiRoot.orders().get({ queryArgs: { where: `orderNumber="${trimmed}"`, limit: 1 } }).execute();
      console.log('[CT] where query status:', (q as any)?.statusCode ?? '(unknown)');
      console.log('[CT] where query body snippet:', safeSnippet(q?.body, 1500));
      const found = q?.body?.results?.[0];
      if (found?.id) return found as Order;
    } catch (qerr: any) {
      console.error('[CT] where query error:', safeSnippet(qerr?.response?.body ?? qerr?.message ?? qerr));
    }
  }

  // 3) PaymentId lookup (recommended when integrating a payment connector)
  if (paymentId) {
    try {
      const q2 = await apiRoot.orders().get({
        queryArgs: { where: `paymentInfo(payments(id="${paymentId}"))`, limit: 1 },
      }).execute();
      console.log('[CT] paymentId query status:', (q2 as any)?.statusCode ?? '(unknown)');
      console.log('[CT] paymentId body snippet:', safeSnippet(q2?.body, 1500));
      const f = q2?.body?.results?.[0];
      if (f?.id) return f as Order;
    } catch (perr: any) {
      console.error('[CT] paymentId query error:', safeSnippet(perr?.response?.body ?? perr?.message ?? perr));
    }
  }

  // 4) Optional: Order Search (index-based) — returns IDs only for indexed orders (recent)
  if (useSearch && trimmed) {
    try {
      // SDK may expose orders().search() — if not, cast to any
      const sresp = await (apiRoot as any).orders().search({ queryArgs: { text: trimmed, limit: 1 } }).execute();
      console.log('[CT] search status:', (sresp as any)?.statusCode ?? '(unknown)');
      console.log('[CT] search body snippet:', safeSnippet(sresp?.body, 1500));
      const ids = sresp?.body?.results?.map((r: any) => r?.id).filter(Boolean);
      if (ids?.length) {
        const getResp = await apiRoot.orders().withId({ ID: ids[0] }).get().execute();
        if (getResp?.body?.id) return getResp.body as Order;
      }
    } catch (serr: any) {
      console.warn('[CT] order search error (may be not enabled):', safeSnippet(serr?.response?.body ?? serr?.message ?? serr));
    }
  }

  console.info('[CT] No order found using configured strategies');
  return null;
}

export async function getOrderIdFromOrderNumber(orderNumber?: string): Promise<string | null> {
  const order = await findOrder({ orderNumber });
  return order?.id ?? null;
}
