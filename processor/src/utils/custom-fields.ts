import {
  ClientBuilder,
  type AuthMiddlewareOptions,
  type HttpMiddlewareOptions,
} from "@commercetools/sdk-client-v2";
import { createApiBuilderFromCtpClient } from "@commercetools/platform-sdk";
import { config } from "../config/config";

/* ------------------------------------------------------------------
   Commercetools Client
------------------------------------------------------------------- */

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

/* ------------------------------------------------------------------
   1️⃣ Payment → Transaction custom field
   (Used internally + copied into Order)
------------------------------------------------------------------- */

export const createTransactionCommentsType = async () => {
  try {
    await apiRoot
      .types()
      .withKey({ key: "novalnet-transaction-comments" })
      .get()
      .execute();
    return; // already exists
  } catch {
    // create
  }

  await apiRoot.types().post({
    body: {
      key: "novalnet-transaction-comments",
      name: { en: "Novalnet Transaction Comments" },
      resourceTypeIds: ["payment-transaction"],
      fieldDefinitions: [
        {
          name: "transactionComments",
          label: { en: "Transaction Comments" },
          type: { name: "String" },
          required: false,
        },
      ],
    },
  }).execute();
};

export const createOrderPaymentCommentsType = async () => {  
  try {
    await apiRoot
      .types()
      .withKey({ key: "order-payment-comments" })
      .get()
      .execute();
    return;
  } catch {
    // create
  }

  await apiRoot.types().post({
    body: {
      key: "order-payment-comments",
      name: { en: "Order Payment Comments" },
      resourceTypeIds: ["order"],

      fieldDefinitions: [
        {
          name: "paymentComments",
          label: { en: "Payment Comments" },
          type: { name: "String" },
          required: false,
        },
      ],
    },
  }).execute();
};


export const initCustomTypes = async () => {
  await createTransactionCommentsType();
  await createOrderPaymentCommentsType();
};
