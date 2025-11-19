//  import { getApiRoot } from '../utils/ct-client';
// import { Order } from '@commercetools/platform-sdk';

// export async function getOrderByOrderNumber(orderNumber: string): Promise<any | null> {
//   try {
//     // Lazy import to prevent bundler from resolving SDK during build
//     const { getApiRoot } = await import('../utils/ct-client.js');
//     const apiRoot = getApiRoot();

//     const response = await apiRoot
//       .orders()
//       .withOrderNumber({ orderNumber })
//       .get()
//       .execute();

//     return response.body;
//   } catch (error: any) {
//     // Optional: handle specific 404 cases
//     if (error?.statusCode === 404) return null;
//     console.error('Error fetching order:', error);
//     return null;
//   }
// }

// export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
//   const order = await getOrderByOrderNumber(orderNumber);
//   return order?.id ?? null;
// }
// src/services/order-service.ts (or your current file)


// import type { Order } from '@commercetools/platform-sdk';

// export async function getOrderByOrderNumber(orderNumber: string): Promise<any | null> {
//   try {
//     // Import dummy getApiRoot
//     const { getApiRoot } = await import('../utils/ct-client.js');
//     const apiRoot = getApiRoot();

//     const response = await apiRoot
//       .orders()
//       .withOrderNumber({ orderNumber })
//       .get()
//       .execute();

//     console.log('Mock API response:', response.body);

//     return response.body;
//   } catch (error: any) {
//     console.log('Error fetching order (mock):', error);
//     return null;
//   }
// }

// export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
//   const order = await getOrderByOrderNumber(orderNumber);
//   return order?.id ?? null;
// }


// src/services/order.service.ts
import type { Order } from '@commercetools/platform-sdk';
import { getApiRoot } from '../utils/ct-client.js';

/* ---------- helpers ---------- */
function safeSnippet(obj: any, max = 800) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    return s.length > max ? s.slice(0, max) + '... (truncated)' : s;
  } catch {
    return String(obj).slice(0, max);
  }
}

function hexDump(s: string) {
  const arr: string[] = [];
  for (let i = 0; i < s.length; i++) {
    arr.push('\\u' + ('0000' + s.charCodeAt(i).toString(16)).slice(-4));
  }
  return arr.join(' ');
}

/** Normalize / clean input orderNumber: trim and remove control characters (but keep visible punctuation) */
function cleanOrderNumber(input: string) {
  const raw = input ?? '';
  const trimmed = raw.toString().trim();
  // remove control characters (including zero-width control chars)
  const cleaned = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');
  return { raw, trimmed, cleaned };
}

/* ---------- main: get order by orderNumber ---------- */
/**
 * Returns the Order object or null when not found.
 * Strategy:
 * 1) try withOrderNumber (direct)
 * 2) try query where orderNumber="..."
 * 3) client-side scan of recent orders for fuzzy/format matches
 */
export async function getOrderByOrderNumber(orderNumber: string): Promise<Order | null> {
  const { raw, trimmed, cleaned } = cleanOrderNumber(orderNumber);

  console.log('getOrderByOrderNumber input raw:', JSON.stringify(raw));
  console.log('trimmed:', JSON.stringify(trimmed));
  if (trimmed !== cleaned) {
    console.log('cleaned (control chars removed):', JSON.stringify(cleaned));
    console.log('trimmed hex:', hexDump(trimmed));
    console.log('cleaned hex:', hexDump(cleaned));
  }

  if (!cleaned) {
    console.log('getOrderByOrderNumber: empty orderNumber after cleaning');
    return null;
  }

  const safeOrderNumber = cleaned.replace(/"/g, '\\"');

  try {
    const apiRoot = getApiRoot();
    console.log('CT projectKey (diagnostic):', (apiRoot as any)?.projectKey ?? 'unknown');

    // 1) Try direct lookup which should return the Order or throw 404
    try {
      const resp = await apiRoot.orders().withOrderNumber({ orderNumber: cleaned }).get().execute();
      console.log('withOrderNumber: HTTP status:', (resp as any).statusCode ?? (resp as any).status ?? 'unknown');
      console.log('withOrderNumber: order snippet:', safeSnippet(resp?.body, 1200));
      const order = resp?.body as Order | undefined;
      if (order?.id) return order;
      // if no id present, continue to fallback
    } catch (err: any) {
      // SDK frequently throws for 404 — treat as not found and continue to fallback
      const code = err?.statusCode ?? err?.response?.statusCode;
      if (code === 404) {
        console.log('withOrderNumber: order not found (404) for', cleaned);
      } else {
        // log but continue to fallback — sometimes permission issues appear here
        console.log('withOrderNumber: unexpected error (will try fallback):', err?.message ?? err);
        if (err?.response?.body) console.log('Error body snippet:', safeSnippet(err.response.body));
      }
    }

    // 2) Try query search by where clause (exact match)
    const where = `orderNumber="${safeOrderNumber}"`;
    try {
      const searchResp = await apiRoot.orders().get({ queryArgs: { where, limit: 1 } }).execute();
      console.log('search where: HTTP status:', (searchResp as any).statusCode ?? (searchResp as any).status ?? 'unknown');
      console.log('search response body snippet:', safeSnippet(searchResp?.body, 1200));
      const results = searchResp?.body?.results ?? [];
      console.log('Search results length:', Array.isArray(results) ? results.length : 'unknown results length');
      if (Array.isArray(results) && results.length > 0) {
        return results[0] as Order;
      }
    } catch (sErr: any) {
      console.log('Error while performing where search (will try client-side fallback):', sErr?.message ?? sErr);
      if (sErr?.response?.body) console.log('Search error body snippet:', safeSnippet(sErr.response.body));
    }

    // 3) Client-side fallback: fetch recent orders and try multiple matching strategies
    console.log('No match from direct or search. Starting client-side scan of recent orders (for fuzzy matches).');
    const pageSize = 50;
    const maxToFetch = 300; // adjust as needed for debugging (avoid huge scans in prod)
    let fetched = 0;
    let offset = 0;
    const candidates: Order[] = [];

    while (fetched < maxToFetch) {
      const toFetch = Math.min(pageSize, maxToFetch - fetched);
      const resp = await apiRoot.orders().get({
        queryArgs: {
          sort: 'createdAt desc',
          limit: toFetch,
          offset,
        },
      }).execute();

      const batch = resp?.body?.results ?? [];
      if (!Array.isArray(batch) || batch.length === 0) break;

      candidates.push(...batch as Order[]);
      fetched += batch.length;
      offset += batch.length;

      if (batch.length < toFetch) break; // no more pages
    }

    console.log('Fetched', candidates.length, 'recent orders for offline search. Sample (up to 10):');
    for (let i = 0; i < Math.min(10, candidates.length); i++) {
      console.log(i + 1, 'id:', candidates[i]?.id, 'orderNumber:', JSON.stringify((candidates[i] as any)?.orderNumber));
    }

    // matching strategies
    const exact = candidates.find(o => String((o as any).orderNumber) === cleaned || String((o as any).orderNumber) === trimmed);
    if (exact) {
      console.log('Client-side exact match found:', exact.id);
      return exact;
    }

    const caseInsensitive = candidates.find(o => String((o as any).orderNumber).toLowerCase() === cleaned.toLowerCase());
    if (caseInsensitive) {
      console.log('Client-side case-insensitive match found:', caseInsensitive.id);
      return caseInsensitive;
    }

    const contains = candidates.find(o => String((o as any).orderNumber).includes(cleaned) || String((o as any).orderNumber).includes(trimmed));
    if (contains) {
      console.log('Client-side partial/contains match found:', contains.id);
      return contains;
    }

    // try numeric normalization comparisons (strip non-digits)
    const cleanedDigits = cleaned.replace(/\D/g, '');
    if (cleanedDigits) {
      const digitsMatch = candidates.find(o => {
        const onum = String((o as any).orderNumber ?? '');
        return onum.replace(/\D/g, '') === cleanedDigits;
      });
      if (digitsMatch) {
        console.log('Client-side numeric match found:', digitsMatch.id);
        return digitsMatch;
      }
    }

    console.log('No order matched by any fallback strategy. Returning null.');
    return null;
  } catch (err: any) {
    console.log('Unexpected error during getOrderByOrderNumber:', err?.message ?? err);
    if (err?.response?.body) console.log('Error body snippet:', safeSnippet(err.response.body));
    return null;
  }
}

/* ---------- helper to get order id ---------- */
export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
  const order = await getOrderByOrderNumber(orderNumber);
  return order?.id ?? null;
}

/* ---------- payment utilities ---------- */
/** returns array of payment ids referenced on the order (defensive) */
export function getPaymentIdsFromOrder(order: Order | null): string[] {
  if (!order) return [];
  const payments = (order as any)?.paymentInfo?.payments;
  if (!Array.isArray(payments) || payments.length === 0) return [];
  return payments
    .map((p: any) => p?.id ?? p?.obj?.id)
    .filter((id: any): id is string => typeof id === 'string');
}

/** Given an orderNumber, return payment ids and optionally full payment objects */
export async function getPaymentsForOrderNumber(orderNumber: string, fetchPayments = false) {
  const order = await getOrderByOrderNumber(orderNumber);
  if (!order) {
    console.log('No order found for', orderNumber);
    return { order: null, paymentIds: [], payments: [] as any[] };
  }

  const paymentIds = getPaymentIdsFromOrder(order);
  console.log('Payment reference ids on order:', paymentIds);

  if (!fetchPayments || paymentIds.length === 0) {
    return { order, paymentIds, payments: [] as any[] };
  }

  const apiRoot = getApiRoot();
  const payments: any[] = [];
  for (const pid of paymentIds) {
    try {
      const resp = await apiRoot.payments().withId({ ID: pid }).get().execute();
      payments.push(resp?.body ?? null);
    } catch (err: any) {
      console.log('Error fetching payment', pid, err?.message ?? err);
      payments.push(null);
    }
  }

  return { order, paymentIds, payments };
}
