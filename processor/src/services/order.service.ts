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

export async function getOrderByOrderNumber(orderNumber: string): Promise<any | null> {
  try {
    // Import dummy getApiRoot
    const { getApiRoot } = await import('../utils/ct-client.js');
    const apiRoot = getApiRoot();

    const response = await apiRoot
      .orders()
      .withOrderNumber({ orderNumber })
      .get()
      .execute();

    console.log('Mock API response:', response.body);

    return response.body;
  } catch (error: any) {
    console.log('Error fetching order (mock):', error);
    return null;
  }
}

export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
  const order = await getOrderByOrderNumber(orderNumber);
  return order?.id ?? null;
}
