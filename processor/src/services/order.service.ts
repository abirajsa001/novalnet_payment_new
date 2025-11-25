import {
  ClientBuilder,
  type AuthMiddlewareOptions,
  type HttpMiddlewareOptions,
} from '@commercetools/sdk-client-v2';
import {
  createApiBuilderFromCtpClient,
} from '@commercetools/platform-sdk';

const authMiddlewareOptions: AuthMiddlewareOptions = {
  host: 'https://auth.europe-west1.gcp.commercetools.com',
  projectKey: 'commercekey',
  credentials: {
    clientId: 'zzykDtn0B_bBov_EVqk0Hvo-',
    clientSecret: '9vrhw1oyV27jiLvlOvQJpR__UVhd6ETy',
  },
  
};

const httpMiddlewareOptions: HttpMiddlewareOptions = {
  host: 'https://api.europe-west1.gcp.commercetools.com',
};

const ctpClient = new ClientBuilder()
  .withClientCredentialsFlow(authMiddlewareOptions)
  .withHttpMiddleware(httpMiddlewareOptions)
  .build();

const apiRoot = createApiBuilderFromCtpClient(ctpClient)
  .withProjectKey({ projectKey: process.env.CTP_PROJECT_KEY! });

export async function getOrderIdByOrderNumber(orderNumber: string) {
  try {
    const response = await apiRoot
      .orders()
      .get({
        queryArgs: {
          where: `orderNumber="${orderNumber}"`,
        },
      })
      .execute();

    if (response.body.results.length === 0) {
      return null; // Not found
    }

    return response.body.results[0].id;
  } catch (error) {
    console.error("Error fetching order:", error);
    throw error;
  }
}
