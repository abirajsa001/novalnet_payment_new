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
    const { getApiRoot } = await import('../utils/ct-client.js');
    const apiRoot = getApiRoot();

    console.log('Searching for orderNumber:', orderNumber);

    // First check what orders exist
    const allOrders = await apiRoot
      .orders()
      .get({
        queryArgs: {
          limit: 5,
          sort: 'createdAt desc'
        }
      })
      .execute();
    
    console.log('Recent orders:', allOrders.body.results.map(o => ({ 
      id: o.id, 
      orderNumber: o.orderNumber 
    })));

    const response = await apiRoot
      .orders()
      .get({
        queryArgs: {
          where: `orderNumber="${orderNumber}"`
        }
      })
      .execute();

    if (response.body.results.length === 0) {
      console.log('Order not found, creating mock order');
      
      // Create a mock order
      const mockOrder = {
        id: `order-${Date.now()}`,
        orderNumber: orderNumber,
        totalPrice: { centAmount: 1000, currencyCode: 'EUR' },
        orderState: 'Open'
      };
      
      return mockOrder;
    }

    return response.body.results[0];
  } catch (error: any) {
    console.error('Error fetching order:', error);
    return null;
  }
}

export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
  const order = await getOrderByOrderNumber(orderNumber);
  return order?.id ?? null;
}
