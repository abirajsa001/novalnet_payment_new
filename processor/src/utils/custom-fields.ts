import {
    ClientBuilder,
    type AuthMiddlewareOptions,
    type HttpMiddlewareOptions,
  } from "@commercetools/sdk-client-v2";
  import { createApiBuilderFromCtpClient } from "@commercetools/platform-sdk";
  import { config } from "../config/config";
  
  const authOptions: AuthMiddlewareOptions = {
    host: config.authUrl,
    projectKey: config.projectKey,
    credentials: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    },
  };
  
  const httpOptions: HttpMiddlewareOptions = {
    host: config.apiUrl,
  };
  
  const ctpClient = new ClientBuilder()
    .withClientCredentialsFlow(authOptions)
    .withHttpMiddleware(httpOptions)
    .build();
  
  export const apiRoot = createApiBuilderFromCtpClient(ctpClient).withProjectKey({
    projectKey: config.projectKey,
  });
  
  export const createTransactionCommentsType = async () => {
    try {
      const typeExists = await apiRoot
        .types()
        .withKey({ key: "novalnet-transaction-comments" })
        .get()
        .execute()
        .catch(() => null);
  
  if (!typeExists) {
    await apiRoot
      .types()
      .post({
        body: {
          key: "novalnet-transaction-comments",
          name: { en: "Novalnet Transaction Comments" },
          resourceTypeIds: ["transaction"],
          fieldDefinitions: [
            {
              name: "transactionComments",
              label: { en: "Transaction Comments" },
              type: { name: "String" },
              required: false,
            },
          ],
        },
      })
      .execute();
  }
    } catch (error) {
      console.error("Error creating custom field type:", error);
    }
  };
  

  export const createTransactionCommentsTypes = async () => {
    try {
      const typeExists = await apiRoot
        .types()
        .withKey({ key: "novalnet-transaction-commentss" })
        .get()
        .execute()
        .catch(() => null);
  
  if (!typeExists) {
    await apiRoot
      .types()
      .post({
        body: {
          key: "novalnet-transaction-commentss",
          name: { en: "Novalnet Transaction Commentss" },
          resourceTypeIds: ["transactions"],
          fieldDefinitions: [
            {
              name: "transactionCommentss",
              label: { en: "Transaction Commentss" },
              type: { name: "String" },
              required: false,
            },
          ],
        },
      })
      .execute();
  }
    } catch (error) {
      console.error("Error creating custom field types:", error);
    }
  };