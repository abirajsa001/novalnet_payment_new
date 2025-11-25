// ct-orders.ts
import {
  ClientBuilder,
  type AuthMiddlewareOptions,
  type HttpMiddlewareOptions,
} from '@commercetools/sdk-client-v2';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';

const PROJECT_KEY = 'commercekey';

// --- Configure auth and http middlewares ---
const authMiddlewareOptions: AuthMiddlewareOptions = {
  host:'https://auth.europe-west1.gcp.commercetools.com',
  projectKey: 'commercekey',
  credentials: {
    clientId: 'zzykDtn0B_bBov_EVqk0Hvo-',
    clientSecret: '9vrhw1oyV27jiLvlOvQJpR__UVhd6ETy',
  },
};

const httpMiddlewareOptions: HttpMiddlewareOptions = {
  host: 'https://api.europe-west1.gcp.commercetools.com',
  fetch: undefined as any, // SDK uses global fetch in Node 18+. Remove/replace if your env needs polyfill.
};

// Build client
const client = new ClientBuilder()
  .withProjectKey('commercekey') // optional when building client, but makes usage consistent
  .withClientCredentialsFlow(authMiddlewareOptions, httpMiddlewareOptions)
  .build();

const apiRoot = createApiBuilderFromCtpClient(client);

/**
 * Get the order ID (CTP `id`) for a given orderNumber.
 * Tries the dedicated endpoint first (/orders/order-number=...), then falls back to queries.
 *
 * @param orderNumberRaw - the order number string provided by caller
 * @returns order id string or null if not found
 */
export async function getOrderIdByOrderNumber(orderNumberRaw: string): Promise<string | null> {
  const orderNumber = String(orderNumberRaw ?? '').trim();
  if (!orderNumber) {
    console.log('Empty orderNumber after trim.');
    return null;
  }

  // Log exact value for debugging (will show surrounding brackets so hidden whitespace is visible)
  console.log(`Searching for orderNumber=[${orderNumber}] len=${orderNumber.length}`);

  // Primary: use dedicated endpoint which returns a single Order object
  try {
    const res = await apiRoot
      .withProjectKey({ projectKey: PROJECT_KEY })
      .orders()
      .withOrderNumber({ orderNumber }) // SDK accepts an object form; adjust if your SDK version expects a simple arg
      .get()
      .execute();

    // success -> res.body is the order object
    if (res?.body?.id) {
      console.log('Found order using withOrderNumber, id=', res.body.id);
      return res.body.id;
    }

    // Strange case: 2xx but no id -> continue to fallback
    console.warn('withOrderNumber returned no id; falling back to query.');
  } catch (err: any) {
    // a 404 is expected when not found; other errors should be surfaced to logs
    const status = err?.statusCode ?? err?.status;
    if (status === 404) {
      console.log('withOrderNumber endpoint: order not found (404). Trying fallback query.');
    } else {
      console.error('Error calling withOrderNumber endpoint:', err?.message ?? err);
      if (err?.response?.body) {
        try {
          console.error('Error response body:', JSON.stringify(err.response.body, null, 2));
        } catch (e) {
          console.error('Could not stringify error.response.body');
        }
      }
      // Decide: continue to fallback queries (non-fatal) — this helps when endpoint usage differs between SDK versions
    }
  }

  // Fallback 1: standard where query (double quotes)
  try {
    const q1 = await apiRoot
      .withProjectKey({ projectKey: PROJECT_KEY })
      .orders()
      .get({
        queryArgs: {
          where: `orderNumber="${escapeForWhere(orderNumber)}"`,
          limit: '1',
        },
      })
      .execute();

    console.log('Fallback query (double quotes) HTTP status:', q1.statusCode ?? q1.status);
    if (Array.isArray(q1.body?.results) && q1.body.results.length > 0) {
      console.log('Found order via where query (double quotes), id=', q1.body.results[0].id);
      return q1.body.results[0].id;
    }
  } catch (err: any) {
    console.error('Error during fallback where query (double quotes):', err?.message ?? err);
    if (err?.response?.body) console.error('Error response body:', JSON.stringify(err.response.body, null, 2));
  }

  // Fallback 2: single quotes (rare)
  try {
    const q2 = await apiRoot
      .withProjectKey({ projectKey: PROJECT_KEY })
      .orders()
      .get({
        queryArgs: {
          where: `orderNumber='${escapeForWhere(orderNumber)}'`,
          limit: '1',
        },
      })
      .execute();

    console.log('Fallback query (single quotes) HTTP status:', q2.statusCode ?? q2.status);
    if (Array.isArray(q2.body?.results) && q2.body.results.length > 0) {
      console.log('Found order via where query (single quotes), id=', q2.body.results[0].id);
      return q2.body.results[0].id;
    }
  } catch (err: any) {
    console.error('Error during fallback where query (single quotes):', err?.message ?? err);
    if (err?.response?.body) console.error('Error response body:', JSON.stringify(err.response.body, null, 2));
  }

  // Fallback 3: try matching it as id OR orderNumber (sometimes caller passed id)
  try {
    const q3 = await apiRoot
      .withProjectKey({ projectKey: PROJECT_KEY })
      .orders()
      .get({
        queryArgs: {
          where: `id="${escapeForWhere(orderNumber)}" or orderNumber="${escapeForWhere(orderNumber)}"`,
          limit: '1',
        },
      })
      .execute();

    console.log('Fallback id-or-orderNumber HTTP status:', q3.statusCode ?? q3.status);
    if (Array.isArray(q3.body?.results) && q3.body.results.length > 0) {
      console.log('Found order via id-or-orderNumber fallback, id=', q3.body.results[0].id);
      return q3.body.results[0].id;
    }
  } catch (err: any) {
    console.error('Error during fallback id-or-orderNumber query:', err?.message ?? err);
    if (err?.response?.body) console.error('Error response body:', JSON.stringify(err.response.body, null, 2));
  }

  console.log('Order not found for orderNumber:', orderNumber);
  return null;
}

/**
 * Debug helper: list a few orders to inspect their orderNumber values.
 * Useful to confirm you are talking to the right project.
 */
export async function debugListSomeOrders(limit = 5): Promise<void> {
  try {
    const res = await apiRoot
      .withProjectKey({ projectKey: PROJECT_KEY })
      .orders()
      .get({ queryArgs: { limit: String(limit) } })
      .execute();

    console.log('Debug: total results returned:', res.body?.results?.length ?? 'unknown');
    (res.body?.results ?? []).forEach((o: any, i: number) => {
      console.log(`#${i} id=${o.id} orderNumber=[${o.orderNumber}] createdAt=${o.createdAt}`);
    });
  } catch (err: any) {
    console.error('Error listing orders for debug:', err?.message ?? err);
    if (err?.response?.body) console.error('Error response body:', JSON.stringify(err.response.body, null, 2));
  }
}

/**
 * Utility: escape double quotes in the where predicate value.
 * We keep it simple; Commercetools supports quoting and escaping — this prevents breaking the predicate.
 */
function escapeForWhere(input: string): string {
  // Replace backslash first, then quotes
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
}

/* ---------------------------
   Example usage (run manually)
   ---------------------------

(async () => {
  // debug: list some orders so you can inspect orderNumber strings
  await debugListSomeOrders(5);

  const sampleOrderNumber = '1001-ABC'; // replace with actual
  const orderId = await getOrderIdByOrderNumber(sampleOrderNumber);
  console.log('Resolved orderId:', orderId);
})();
*/

export default {
  getOrderIdByOrderNumber,
  debugListSomeOrders,
};
