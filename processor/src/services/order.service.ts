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

/**
 * Utility to avoid printing huge objects to logs
 */
function safeSnippet(obj: any, max = 800) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return s.length > max ? s.slice(0, max) + '... (truncated)' : s;
  } catch {
    return String(obj).slice(0, max);
  }
}

/**
 * Search for an order by its orderNumber. Returns the Order or null if not found.
 */
export async function getOrderByOrderNumber(orderNumber: string): Promise<any | null> {
  const raw = (orderNumber ?? '').toString();
  const trimmed = raw.trim();
  if (!trimmed) {
    console.log('getOrderByOrderNumber: empty orderNumber provided');
    return null;
  }

  try {
    const apiRoot = getApiRoot();
    console.log('CT projectKey (diagnostic):', (apiRoot as any)?.projectKey ?? 'commercekey');

    const safeOrderNumber = trimmed.replace(/"/g, '\\"');
    const where = `orderNumber="${safeOrderNumber}"`;
    const response = await apiRoot.orders().get({ queryArgs: { where, limit: 1 } }).execute();

    console.log('CT response status:', (response as any).statusCode ?? (response as any).status ?? 'unknown response status');
    const results = response?.body?.results ?? [];
    console.log('Search results length:', Array.isArray(results) ? results.length : 'unknown results length');

    // if (!Array.isArray(results) || results.length === 0) {
    //   console.log(`Order not found for orderNumber=${trimmed}`);
    //   return null;
    // }

    // return results[0] as Order;
    return response.body;
  } catch (err: any) {
    console.log('Error fetching order by orderNumber:', err?.message ?? err);
    if (err?.response?.body) console.log('Error body snippet:', safeSnippet(err.response.body));
    return null;
  }
}

/**
 * Returns the order id for a given orderNumber, or null when not found.
 */
export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
  const order = await getOrderByOrderNumber(orderNumber);
  return order?.id ?? null;
}

/**
 * Fetch order by ID (direct get). Returns Order or null.
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  if (!orderId) return null;
  try {
    const apiRoot = getApiRoot();
    const response = await apiRoot.orders().withId({ ID: orderId }).get().execute();
    return response?.body ?? null;
  } catch (err: any) {
    console.log('Error fetching order by id:', err?.message ?? err);
    if (err?.response?.body) console.log('Error body snippet:', safeSnippet(err.response.body));
    return null;
  }
}

/**
 * List recent orders (useful for debugging when a search returns empty).
 */
export async function listRecentOrders(limit = 5): Promise<Order[]> {
  try {
    const apiRoot = getApiRoot();
    const response = await apiRoot.orders().get({ queryArgs: { sort: 'createdAt desc', limit } }).execute();
    const results = response?.body?.results ?? [];
    console.log(`Recent orders found: ${Array.isArray(results) ? results.length : 'unknown recent order found'}`);
    return results as Order[];
  } catch (err: any) {
    console.log('Error listing recent orders:', err?.message ?? err);
    if (err?.response?.body) console.log('Error body snippet:', safeSnippet(err.response.body));
    return [];
  }
}
