// src/services/order.service.ts
import {
  ClientBuilder,
  type AuthMiddlewareOptions,
  type HttpMiddlewareOptions,
} from '@commercetools/sdk-client-v2';

import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';

// -------------------------------
// YOUR PROVIDED CREDENTIALS
// (Keep these secure; consider moving to env vars in production)
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
  .withClientCredentialsFlow(authOptions)
  .withHttpMiddleware(httpOptions)
  .build();

const apiRoot = createApiBuilderFromCtpClient(ctpClient).withProjectKey({
  projectKey,
});

// =======================================================
// PUBLIC FUNCTION — GET ORDER ID BY ORDER NUMBER
// =======================================================
export async function getOrderIdFromOrderNumber(
  orderNumberRaw: string
): Promise<string | null> {
  const orderNumber = String(orderNumberRaw ?? '').trim();

  if (!orderNumber) {
    console.log('Empty orderNumber');
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

    console.log('withOrderNumber status =', res.statusCode);

    if (res?.body?.id) {
      console.log('Found via withOrderNumber:', res.body.id);
      return res.body.id;
    }
  } catch (err: any) {
    const code = err?.statusCode ?? err?.status;
    if (code !== 404) {
      console.error('withOrderNumber error:', err?.message ?? err);
    } else {
      console.log('withOrderNumber: not found, trying fallbacks');
    }
  }

  // -------------------------------------------------------
  // 2) FALLBACK — where query (double quotes)  <--- recommended
  // -------------------------------------------------------
  try {
    const where = `orderNumber="${escapeForDoubleQuoted(orderNumber)}"`;
    console.log('Fallback1 where=', where);

    const res = await apiRoot.orders().get({
      queryArgs: {
        where,
        limit: 1, // number type
      },
    }).execute();

    console.log('Fallback1 status =', res.statusCode);

    if (res.body?.results?.length > 0) {
      console.log('Found via Fallback1 (double quotes)');
      return res.body.results[0].id;
    }
  } catch (err: any) {
    console.error('Fallback1 error:', err?.message ?? err);
  }

  // -------------------------------------------------------
  // 3) FALLBACK — single quotes (double single-quote escaping)
  // -------------------------------------------------------
  try {
    // Use doubled single-quotes for any internal apostrophes (O'Reilly => O''Reilly)
    const where = `orderNumber='${escapeForSingleQuoted(orderNumber)}'`;
    console.log('Fallback2 where=', where);

    const res = await apiRoot.orders().get({
      queryArgs: {
        where,
        limit: 1,
      },
    }).execute();

    console.log('Fallback2 status =', res.statusCode);

    if (res.body?.results?.length > 0) {
      console.log('Found via Fallback2 (single quotes)');
      return res.body.results[0].id;
    }
  } catch (err: any) {
    console.error('Fallback2 error:', err?.message ?? err);
  }

  // -------------------------------------------------------
  // 4) FALLBACK — search as ID or orderNumber (double quotes)
  // -------------------------------------------------------
  try {
    const escaped = escapeForDoubleQuoted(orderNumber);
    const where = `id="${escaped}" or orderNumber="${escaped}"`;
    console.log('Fallback3 where=', where);

    const res = await apiRoot.orders().get({
      queryArgs: {
        where,
        limit: 1,
      },
    }).execute();

    console.log('Fallback3 status =', res.statusCode);

    if (res.body?.results?.length > 0) {
      console.log('Found via Fallback3 (id or orderNumber)');
      return res.body.results[0].id;
    }
  } catch (err: any) {
    console.error('Fallback3 error:', err?.message ?? err);
  }

  console.log('Order NOT FOUND:', orderNumber);
  return null;
}

// =======================================================
// HELPERS
// =======================================================

/**
 * Escape text for use inside a double-quoted predicate literal:
 * - backslash-escape backslashes and double-quotes
 * Example: He said "Hi" -> He said \"Hi\"
 */
function escapeForDoubleQuoted(value: string): string {
  if (value == null) return '';
  return value
    .replace(/\\/g, '\\\\') // backslash -> double backslash
    .replace(/"/g, '\\"'); // double-quote -> backslash-double-quote
}

/**
 * Escape text for use inside a single-quoted predicate literal:
 * - double single-quotes (O'Reilly -> O''Reilly)
 * - escape backslashes too (for safety)
 *
 * Note: commercetools parser does not accept backslash-escaped single quotes as
 * \' inside a single-quoted literal, so we must double the single-quote.
 */
function escapeForSingleQuoted(value: string): string {
  if (value == null) return '';
  return value
    .replace(/\\/g, '\\\\') // escape backslashes first
    .replace(/'/g, "''"); // single-quote -> doubled single-quote
}

export default {
  getOrderIdFromOrderNumber,
};
