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

function safeSnippet(obj: any, max = 800) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return s.length > max ? s.slice(0, max) + '... (truncated)' : s;
  } catch {
    return String(obj).slice(0, max);
  }
}

export async function getOrderByOrderNumber(orderNumber: string): Promise<Order | null> {
  const raw = (orderNumber ?? '').toString();
  const trimmed = raw.trim();
  if (!trimmed) {
    console.log('getOrderByOrderNumber: empty orderNumber provided');
    return null;
  }

  try {
    const apiRoot = getApiRoot();
    console.log('CT projectKey (diagnostic):', (apiRoot as any)?.projectKey ?? 'unknown');

    const safeOrderNumber = trimmed.replace(/"/g, '\\"');
    const where = `orderNumber="${safeOrderNumber}"`;

    // execute search
    const response = await apiRoot.orders().get({ queryArgs: { where, limit: 1 } }).execute();


    // results is an array under response.body.results
    const results = response?.body?.results ?? [];
    console.log('Search results length:', Array.isArray(results) ? results.length : 'unknown results length');

    // return the first order, or null
    return Array.isArray(results) && results.length > 0 ? (results[0] as Order) : null;
  } catch (err: any) {
    console.log('Error fetching order by orderNumber:', err?.message ?? err);
  }
}

export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
  const order = await getOrderByOrderNumber(orderNumber);
  return order?.id ?? null;
}
