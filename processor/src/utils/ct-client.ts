// src/utils/ct-client.ts
import { ClientBuilder } from '@commercetools/sdk-client-v2';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';

let cachedApiRoot: ByProjectKeyRequestBuilder | undefined;

export function getApiRoot(): ByProjectKeyRequestBuilder {
  if (cachedApiRoot) return cachedApiRoot;

  const projectKey = 'commercekey';   // your project key
  const authUrl = 'https://auth.europe-west1.gcp.commercetools.com';
  const apiUrl = 'https://api.europe-west1.gcp.commercetools.com';
  const clientId = 'zzykDtn0B_bBov_EVqk0Hvo-';
  const clientSecret = '9vrhw1oyV27jiLvlOvQJpR__UVhd6ETy';

  const client = new ClientBuilder()
    .withProjectKey(projectKey)
    .withClientCredentialsFlow({
      host: authUrl,
      projectKey,
      credentials: { clientId, clientSecret },
      fetch
    })
    .withHttpMiddleware({
      host: apiUrl,
      fetch
    })
    .build();

  cachedApiRoot = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey });
  return cachedApiRoot;
}
