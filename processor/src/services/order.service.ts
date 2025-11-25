// src/services/order.service.ts
import {
  ClientBuilder,
  type AuthMiddlewareOptions,
  type HttpMiddlewareOptions,
} from '@commercetools/sdk-client-v2';

import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';

// -------------------------------
// YOUR PROVIDED CREDENTIALS
// -------------------------------
const projectKey = 'commercekey';
const authUrl = 'https://auth.europe-west1.gcp.commercetools.com';
const apiUrl = 'https://api.europe-west1.gcp.commercetools.com';
const clientId = 'zzykDtn0B_bBov_EVqk0Hvo-';
const clientSecret = '9vrhw1oyV27jiLvlOvQJpR__UVhd6ETy';

// -------------------------------
// AUTH CONFIG
// -------------------------------
const authOptions: AuthMiddlewareOptions = {
  host: authUrl,
  projectKey,
  credentials: {
    clientId,
    clientSecret,
  },
};

// -------------------------------
// HTTP CONFIG
// -------------------------------
const httpOptions: HttpMiddlewareOptions = {
  host: apiUrl,
};

// -------------------------------
// BUILD CLIENT
// -------------------------------
const ctpClient = new ClientBuilder()
  .withClientCredentialsFlow(authOptions)    // ✔ only 1 argument allowed
  .withHttpMiddleware(httpOptions)
  .build();

const apiRoot = createApiBuilderFromCtpClient(ctpClient)
  .withProjectKey({ projectKey });

// =======================================================
// FUNCTION — GET ORDER ID BY ORDER NUMBER
// =======================================================
export async function getOrderIdFromOrderNumber(
  orderNumberRaw: string
): Promise<string | null> {
  const orderNumber = String(orderNumberRaw ?? '').trim();

  if (!orderNumber) {
    console.log("Empty orderNumber");
    return null;
  }

  console.log(`Searching for orderNumber=[${orderNumber}]`);

  // -------------------------------------------------------
  // 1) TRY DEDICATED ENDPOINT: /orders/order-number={number}
  // -------------------------------------------------------
  try {
    // using "as any" because SDK typing differs per version
    const res = await (apiRoot.orders() as any)
      .withOrderNumber(orderNumber)
      .get()
      .execute();

    console.log("withOrderNumber status =", res.statusCode);

    if (res?.body?.id) {
      console.log("Found via withOrderNumber:", res.body.id);
      return res.body.id;
    }
  } catch (err: any) {
    const code = err?.statusCode ?? err?.status;
    if (code !== 404) {
      console.error("withOrderNumber error:", err?.message);
    } else {
      console.log("withOrderNumber: not found, trying fallbacks");
    }
  }

  // -------------------------------------------------------
  // 2) FALLBACK — where query (double quotes)
  // -------------------------------------------------------
  try {
    const res = await apiRoot.orders().get({
      queryArgs: {
        where: `orderNumber="${escape(orderNumber)}"`,
        limit: 1,   // ✔ number, not string
      },
    }).execute();

    console.log("Fallback1 status =", res.statusCode);

    if (res.body?.results?.length > 0) {
      return res.body.results[0].id;
    }
  } catch (err: any) {
    console.error("Fallback1 error:", err?.message);
  }

  // -------------------------------------------------------
  // 3) FALLBACK — single quotes
  // -------------------------------------------------------
  try {
    const res = await apiRoot.orders().get({
      queryArgs: {
        where: `orderNumber='${escape(orderNumber)}'`,
        limit: 1,
      },
    }).execute();

    console.log("Fallback2 status =", res.statusCode);

    if (res.body?.results?.length > 0) {
      return res.body.results[0].id;
    }
  } catch (err: any) {
    console.error("Fallback2 error:", err?.message);
  }

  // -------------------------------------------------------
  // 4) FALLBACK — search as ID or orderNumber
  // -------------------------------------------------------
  try {
    const res = await apiRoot.orders().get({
      queryArgs: {
        where: `id="${escape(orderNumber)}" or orderNumber="${escape(orderNumber)}"`,
        limit: 1,
      },
    }).execute();

    console.log("Fallback3 status =", res.statusCode);

    if (res.body?.results?.length > 0) {
      return res.body.results[0].id;
    }
  } catch (err: any) {
    console.error("Fallback3 error:", err?.message);
  }

  console.log("Order NOT FOUND:", orderNumber);
  return null;
}

// =======================================================
// HELPERS
// =======================================================
function escape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

export default {
  getOrderIdFromOrderNumber,
};
