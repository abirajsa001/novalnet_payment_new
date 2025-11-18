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


import type { Order } from '@commercetools/platform-sdk';
import { getApiRoot } from '../utils/ct-client.js';

export async function getOrderByOrderNumber(orderNumber: string): Promise<Order | null> {
  try {
    const apiRoot = getApiRoot();

    // very small, safe log — avoid printing large SDK objects
    console.log('Using CT projectKey:', (apiRoot as any)?.projectKey ?? 'unknown');

    // escape quotes inside orderNumber
    const safeOrderNumber = orderNumber.replace(/"/g, '\\"');

    const response = await apiRoot
      .orders()
      .get({
        queryArgs: {
          where: `orderNumber="${safeOrderNumber}"`,
          limit: 1,
        },
      })
      .execute();

    const results = response?.body?.results ?? [];
    if (results.length === 0) {
      console.log(`Order not found for orderNumber=${orderNumber}`);
      return null;
    }

    console.log('Order found: id=', results[0].id, 'orderNumber=', results[0].orderNumber);
    return results[0] as Order;
  } catch (error: any) {
    console.log('Error fetching order (mock):', error?.message ?? error);
    return null;
  }
}


export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
  const order = await getOrderByOrderNumber(orderNumber);
  return order?.id ?? null;
}
