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

export async function getOrderByOrderNumber(orderNumber: string): Promise<Order | null> {
  if (!orderNumber) {
    console.error('getOrderByOrderNumber called with empty orderNumber');
    return null;
  }

  try {
    const apiRoot = getApiRoot();
    console.log('[CT] Searching orderNumber:', orderNumber);

    // 1) Try the direct endpoint (GET /orders/order-number=<orderNumber>)
    try {
      const response = await apiRoot
        .orders()
        .withOrderNumber({ orderNumber })
        .get()
        .execute();

      console.log('[CT] withOrderNumber status:', response?.statusCode);
      console.log('[CT] withOrderNumber body:', JSON.stringify(response?.body ?? {}, null, 2));

      if (response?.statusCode === 200 && response?.body?.id) {
        return response.body as Order;
      }
      // if a 404 or empty body — fall back to the query below
    } catch (innerErr) {
      // some SDKs throw for 404 — log and fall back
      console.warn('[CT] withOrderNumber threw error (will try query fallback):');
    }

    // 2) Fallback: query orders with where clause (returns query result with results[])
    try {
      const q = await apiRoot.orders().get({
        queryArgs: { where: `orderNumber="${orderNumber}"` },
      }).execute();

      console.log(' [CT] query status:', q?.statusCode);
      console.log('[CT] query body:', JSON.stringify(q?.body ?? {}, null, 2));

      const results = q?.body?.results;
      if (Array.isArray(results) && results.length > 0) {
        return results[0] as Order;
      }
    } catch (queryErr) {
      console.error('[CT] query fallback error:');
    }

    // Not found
    console.info(`[CT] Order not found for orderNumber="${orderNumber}"`);
    return null;
  } catch (error: any) {
    console.error('[CT] Unexpected error in getOrderByOrderNumber:', error);
    // Don't swallow serious errors — return null to keep your current flow or rethrow if you want the caller to handle it:
    return null;
  }
}

export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
  const order = await getOrderByOrderNumber(orderNumber);
  return order?.id ?? null;
}
