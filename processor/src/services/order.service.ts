// src/services/order.service.ts
import type { Order } from '@commercetools/platform-sdk';
import { getApiRoot } from '../utils/ct-client.js';

/**
 * Fetch the order using orderNumber
 */
export async function getOrderByOrderNumber(orderNumber: string): Promise<Order | null> {
  const cleaned = (orderNumber ?? '').trim();
  if (!cleaned) return null;

  const apiRoot = getApiRoot();

  try {
    const response = await apiRoot
      .orders()
      .withOrderNumber({ orderNumber: cleaned })
      .get()
      .execute();

    return response.body as Order;
  } catch (error: any) {
    const status =
      error?.statusCode ??
      error?.response?.statusCode ??
      error?.response?.status;

    if (status === 404) {
      console.warn(`Order not found for orderNumber "${cleaned}".`);
      return null;
    }

    console.error('Unexpected error fetching order:', error);
    return null;
  }
}

/**
 * Return only the Order ID
 */
export async function getOrderIdFromOrderNumber(orderNumber: string): Promise<string | null> {
  const order = await getOrderByOrderNumber(orderNumber);
  return order?.id ?? null;
}
