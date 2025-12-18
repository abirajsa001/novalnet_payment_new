import {
  ClientBuilder,
  type AuthMiddlewareOptions,
  type HttpMiddlewareOptions,
} from "@commercetools/sdk-client-v2";

import {
  createApiBuilderFromCtpClient,
} from "@commercetools/platform-sdk";


const projectKey = 'testkeyproject';
const authUrl = 'https://auth.europe-west1.gcp.commercetools.com';
const apiUrl = 'https://api.europe-west1.gcp.commercetools.com';
const clientId = '4Qov22_iYZi5Z0Ed5_-bVcf3';
const clientSecret = 'HzP7uITPekVYNp9VTXtFSGjkRllCF-cd';

const authMiddlewareOptions: AuthMiddlewareOptions = {
  host: "https://auth.europe-west1.gcp.commercetools.com",
  projectKey,
  credentials: {
    clientId: '4Qov22_iYZi5Z0Ed5_-bVcf3',
    clientSecret: 'HzP7uITPekVYNp9VTXtFSGjkRllCF-cd',
  },
};

const httpMiddlewareOptions: HttpMiddlewareOptions = {
  host: "https://api.europe-west1.gcp.commercetools.com",
};

const ctpClient = new ClientBuilder()
  .withClientCredentialsFlow(authMiddlewareOptions)
  .withHttpMiddleware(httpMiddlewareOptions)
  .build();

// THIS is your "projectApiRoot"
export const projectApiRoot = createApiBuilderFromCtpClient(ctpClient)
  .withProjectKey({ projectKey });
  
export function getApiRoot() {
  const client = new ClientBuilder()
    .withProjectKey(projectKey)
    .withClientCredentialsFlow({
      host: authUrl,
      projectKey,
      credentials: { clientId, clientSecret },
      fetch, // global fetch in Node 18+
    })
    .withHttpMiddleware({ host: apiUrl, fetch })
    .build();

  // Must scope API to project key to access resources like orders()
  return createApiBuilderFromCtpClient(client).withProjectKey({ projectKey });
}



