"use strict";
//  import { getApiRoot } from '../utils/ct-client';
// import { Order } from '@commercetools/platform-sdk';
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderByOrderNumber = getOrderByOrderNumber;
exports.getOrderIdFromOrderNumber = getOrderIdFromOrderNumber;
async function getOrderByOrderNumber(orderNumber) {
    try {
        // Import dummy getApiRoot
        const { getApiRoot } = await import('../utils/ct-client.js');
        const apiRoot = getApiRoot();
        const response = await apiRoot
            .orders()
            .withOrderNumber({ orderNumber })
            .get()
            .execute();
        console.log('Novalnet API response:', response.body);
        return response.body;
    }
    catch (error) {
        console.log('Error fetching order (novalnet):', error);
        return null;
    }
}
async function getOrderIdFromOrderNumber(orderNumber) {
    const order = await getOrderByOrderNumber(orderNumber);
    return order?.id ?? null;
}
