import {
  statusHandler,
  healthCheckCommercetoolsPermissions,
  Cart,
  ErrorRequiredField,
  TransactionType,
  TransactionState,
  ErrorInvalidOperation,
} from "@commercetools/connect-payments-sdk";
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  ReversePaymentRequest,
  StatusResponse,
} from "./types/operation.type";
import {
  Address,
  Customer,
  CustomerSetCustomFieldAction,
  CustomerSetCustomTypeAction,
} from '@commercetools/platform-sdk';
import { SupportedPaymentComponentsSchemaDTO } from "../dtos/operations/payment-componets.dto";
import { PaymentModificationStatus } from "../dtos/operations/payment-intents.dto";
import packageJSON from "../../package.json";
import { getOrderIdFromOrderNumber } from './order.service';
import { AbstractPaymentService } from "./abstract-payment.service";
import { getConfig } from "../config/config";
import { appLogger, paymentSDK } from "../payment-sdk";
import crypto from 'crypto';
import dns from 'dns/promises';
import { FastifyRequest } from 'fastify';
import {
  CreatePaymentRequest,
  NovalnetPaymentServiceOptions,
} from "./types/novalnet-payment.type";
import {
  PaymentMethodType,
  PaymentOutcome,
  PaymentResponseSchemaDTO,
} from "../dtos/novalnet-payment.dto";
import {
  getCartIdFromContext,
  getPaymentInterfaceFromContext,
  getMerchantReturnUrlFromContext,
  getFutureOrderNumberFromContext,
} from "../libs/fastify/context/context";
import { randomUUID } from "crypto";
import {
  TransactionDraftDTO,
  TransactionResponseDTO,
} from "../dtos/operations/transaction.dto";
import { log } from "../libs/logger";
import * as Context from "../libs/fastify/context/context";
import { ExtendedUpdatePayment } from './types/payment-extension';
import { createTransactionCommentsType } from '../utils/custom-fields';
import { projectApiRoot } from '../utils/ct-client';
import customObjectService from "./ct-custom-object.service";
import { t, normalizeLocale, SupportedLocale } from "../i18n";


type NovalnetConfig = {
  testMode: string;
  paymentAction: string;
  dueDate: string;
  minimumAmount: string;
  enforce3d: string;
  displayInline: string;
};

type TransactionCommentParams = {
  eventTID?: string | null;
  parentTID?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  date?: string | null;
  time?: string | null;
  transactionID?: string | null;
  dueDate?: string | null;
};


function getNovalnetConfigValues(
  type: string,
  config: Record<string, any>,
): NovalnetConfig {
  const upperType = type.toUpperCase();
  return {
    testMode: String(config?.[`novalnet_${upperType}_TestMode`]),
    paymentAction: String(config?.[`novalnet_${upperType}_PaymentAction`]),
    dueDate: String(config?.[`novalnet_${upperType}_DueDate`]),
    minimumAmount: String(config?.[`novalnet_${upperType}_MinimumAmount`]),
    enforce3d: String(config?.[`novalnet_${upperType}_Enforce3d`]),
    displayInline: String(config?.[`novalnet_${upperType}_DisplayInline`]),
  };
}

function getPaymentDueDate(configuredDueDate: number | string): string | null {
  const days = Number(configuredDueDate);
  if (isNaN(days)) {
    return null;
  }
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  const formattedDate = dueDate.toISOString().split("T")[0];
  return formattedDate;
}

export class NovalnetPaymentService extends AbstractPaymentService {
  constructor(opts: NovalnetPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService);
  }

  public async config(): Promise<ConfigResponse> {
    const config = getConfig();
    return {
      clientKey: config.mockClientKey,
      environment: config.mockEnvironment,
    };
  }

  public async status(): Promise<StatusResponse> {
    const handler = await statusHandler({
      timeout: getConfig().healthCheckTimeout,
      log: appLogger,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions: [
            "manage_payments",
            "view_sessions",
            "view_api_clients",
            "manage_orders",
            "introspect_oauth_tokens",
            "manage_checkout_payment_intents",
            "manage_types",
          ],
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: getConfig().projectKey,
        }),
        async () => {
          try {
            const paymentMethods = "card";
            return {
              name: "Mock Payment API",
              status: "UP",
              message: "Mock api is working",
              details: {
                paymentMethods,
              },
            };
          } catch (e) {
            return {
              name: "Mock Payment API",
              status: "DOWN",
              message:
                "The mock payment API is down for some reason. Please check the logs for more details.",
              details: {
                error: e,
              },
            };
          }
        },
      ],
      metadataFn: async () => ({
        name: packageJSON.name,
        description: packageJSON.description,
        "@commercetools/connect-payments-sdk":
          packageJSON.dependencies["@commercetools/connect-payments-sdk"],
      }),
    })();
    return handler.body;
  }

  public async getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO> {
    return {
      dropins: [],
      components: [
        { type: PaymentMethodType.INVOICE },
        { type: PaymentMethodType.PREPAYMENT },
        { type: PaymentMethodType.IDEAL },
        { type: PaymentMethodType.PAYPAL },
        { type: PaymentMethodType.ONLINE_BANK_TRANSFER },
        { type: PaymentMethodType.ALIPAY },
        { type: PaymentMethodType.BANCONTACT },
        { type: PaymentMethodType.BLIK },
        { type: PaymentMethodType.EPS },
        { type: PaymentMethodType.MBWAY },
        { type: PaymentMethodType.MULTIBANCO },
        { type: PaymentMethodType.PAYCONIQ },
        { type: PaymentMethodType.POSTFINANCE },
        { type: PaymentMethodType.POSTFINANCE_CARD },
        { type: PaymentMethodType.PRZELEWY24 },
        { type: PaymentMethodType.TRUSTLY },
        { type: PaymentMethodType.TWINT },
        { type: PaymentMethodType.WECHATPAY },
        { type: PaymentMethodType.SEPA },
        { type: PaymentMethodType.ACH },
        { type: PaymentMethodType.CREDITCARD },
      ],
    };
  }

  public async capturePayment(
    request: CapturePaymentRequest,
  ): Promise<PaymentProviderModificationResponse> {
    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: "Charge",
        amount: request.amount,
        interactionId: request.payment.interfaceId,
        state: "Success",
      },
    });
    return {
      outcome: PaymentModificationStatus.APPROVED,
      pspReference: request.payment.interfaceId as string,
    };
  }

  public async cancelPayment(
    request: CancelPaymentRequest,
  ): Promise<PaymentProviderModificationResponse> {
    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: "CancelAuthorization",
        amount: request.payment.amountPlanned,
        interactionId: request.payment.interfaceId,
        state: "Success",
      },
    });
    return {
      outcome: PaymentModificationStatus.APPROVED,
      pspReference: request.payment.interfaceId as string,
    };
  }

  public async refundPayment(
    request: RefundPaymentRequest,
  ): Promise<PaymentProviderModificationResponse> {
    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: "Refund",
        amount: request.amount,
        interactionId: request.payment.interfaceId,
        state: "Success",
      },
    });
    return {
      outcome: PaymentModificationStatus.APPROVED,
      pspReference: request.payment.interfaceId as string,
    };
  }

  public async reversePayment(
    request: ReversePaymentRequest,
  ): Promise<PaymentProviderModificationResponse> {
    const hasCharge = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: "Charge",
      states: ["Success"],
    });
    const hasRefund = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: "Refund",
      states: ["Success", "Pending"],
    });
    const hasCancelAuthorization = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: "CancelAuthorization",
      states: ["Success", "Pending"],
    });

    const wasPaymentReverted = hasRefund || hasCancelAuthorization;

    if (hasCharge && !wasPaymentReverted) {
      return this.refundPayment({
        payment: request.payment,
        merchantReference: request.merchantReference,
        amount: request.payment.amountPlanned,
      });
    }

    const hasAuthorization = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: "Authorization",
      states: ["Success"],
    });
    if (hasAuthorization && !wasPaymentReverted) {
      return this.cancelPayment({ payment: request.payment });
    }

    throw new ErrorInvalidOperation(
      "There is no successful payment transaction to reverse.",
    );
  }

  public async ctcc(cart: Cart) {
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({
      cart,
    });
    return deliveryAddress;
  }

  public async ctbb(cart: Cart) {
    const billingAddress = cart.billingAddress;
    return billingAddress;
  }

  public async customerDetails(customer: Customer) {
    return customer;
  }

  public async failureResponse({ data }: { data: any }) {
    const parsedData = typeof data === "string" ? JSON.parse(data) : data;
    const config = getConfig();
    await createTransactionCommentsType();
    log.info("Failure Response inserted");
    log.info(parsedData.tid);
    log.info(parsedData.status_text);
    log.info(parsedData.payment_type);
    const raw = await this.ctPaymentService.getPayment({ id: parsedData.ctPaymentID } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === parsedData.pspReference
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const transactionComments = `Novalnet Transaction ID: ${parsedData.tid ?? "NN/A"}\nPayment Type: ${parsedData.payment_type ?? "NN/A"}\n${parsedData.status_text ?? "NN/A"}`;
    log.info(txId);
    log.info(parsedData.ctPaymentID);
    log.info(transactionComments);
    
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: parsedData.ctPaymentID })
    .post({
      body: {
        version,
        actions: [
          {
            action: "setTransactionCustomField",
            transactionId: txId,
            name: "transactionComments",
            value: transactionComments,
          },
        ],
      },
    })
    .execute();
  }  

  public async getConfigValues({ data }: { data: any }) {
    try {
      const clientKey = String(getConfig()?.novalnetClientkey ?? '');
      log.info('getconfigValues function');
      log.info(clientKey);
      return { paymentReference: clientKey };
    } catch (err) {
      log.info('getConfigValues error', err);
      // return safe fallback so Merchant Center gets JSON
      return { paymentReference: '' };
    }
  }

  public async getCustomerAddress(
    request: CreatePaymentRequest
  ): Promise<PaymentResponseSchemaDTO> {
  
    log.info("service-customer-address - start");
  
    // -----------------------------
    // 1) Validate cartId
    // -----------------------------
    const cartId = request.cartId;
    if (!cartId) {
      log.warn("service-customer-address - missing cartId");
      return { paymentReference: "customAddress" };
    }
  
    // -----------------------------
    // 2) Fetch Cart
    // -----------------------------
    let ctCart: any;
    try {
      ctCart = await this.ctCartService.getCart({ id: cartId });
      log.info("ctCart fetched", {
        id: ctCart.id,
        customerId: ctCart.customerId,
        anonymousId: ctCart.anonymousId,
      });
    } catch (err) {
      log.error("Failed to fetch cart", err);
      return { paymentReference: "customAddress" };
    }
  
    // -----------------------------
    // 3) Always prefer CART addresses
    // -----------------------------
    let shippingAddress: Address | null = ctCart.shippingAddress ?? null;
    let billingAddress: Address | null = ctCart.billingAddress ?? null;
  
    // -----------------------------
    // 4) Prepare customer fields
    // -----------------------------
    let firstName: string =
      shippingAddress?.firstName ?? ctCart.customerFirstName ?? "";
    let lastName: string =
      shippingAddress?.lastName ?? ctCart.customerLastName ?? "";
    let email: string = ctCart.customerEmail ?? "";
  
    // -----------------------------
    // 5) If this is a logged-in customer, fetch missing fields from CT
    // -----------------------------
    if (ctCart.customerId) {
      try {
        const apiRoot =
          (this as any).projectApiRoot ?? (globalThis as any).projectApiRoot ?? projectApiRoot;
  
        const customerRes = await apiRoot
          .customers()
          .withId({ ID: ctCart.customerId })
          .get()
          .execute();
  
        const ctCustomer: Customer = customerRes.body;
  
        // override only if missing
        if (!firstName) firstName = ctCustomer.firstName ?? "";
        if (!lastName) lastName = ctCustomer.lastName ?? "";
        if (!email) email = ctCustomer.email ?? "";
  
        log.info("Customer data fetched", {
          id: ctCustomer.id,
          email: ctCustomer.email,
        });
      } catch (err) {
        log.warn("Failed to fetch customer data, using cart only", {
          cartCustomerId: ctCart.customerId,
          error: String(err),
        });
        // cart fallback already applied
      }
    }
  
    // -----------------------------
    // 6) Final Response
    // -----------------------------
    const result: PaymentResponseSchemaDTO = {
      paymentReference: "customAddress",
      firstName,
      lastName,
      email,
      shippingAddress,
      billingAddress,
    } as any;
  
    log.info("service-customer-address - returning", {
      paymentReference: result.paymentReference,
      firstName,
      lastName,
      email,
      shippingAddressPresent: !!shippingAddress,
      billingAddressPresent: !!billingAddress,
    });
  
    return result;
  }
  
  public async transactionUpdate({ data }: { data: any }) {
    try {
      log.info("transactionUpdate");
      const parsedData = typeof data === "string" ? JSON.parse(data) : data;
      if (!parsedData?.ctPaymentId) {
        throw new Error("Missing ctPaymentId in transactionUpdate");
      }
      
      const config = getConfig();
      await createTransactionCommentsType();
  
      const merchantReturnUrl = getMerchantReturnUrlFromContext() || config.merchantReturnUrl;
      log.info("Merchant return URL:", merchantReturnUrl);
  
      const novalnetPayload = {
        transaction: {
          tid: parsedData?.interfaceId ?? "",
        },
      };
  
      let responseData: any;
      const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
      const base64Key =  btoa(accessKey);
      const lang = parsedData?.lang;
      const locale =  navigator?.language?.split("-")[0] ?? "no-lang1";
      log.info('locale-lang');
      log.info(lang);
      log.info(locale);
      log.info(accessKey);
      const language = locale?.split("-")[0] ?? "no-lang2";
      log.info(language);

      try {
        const novalnetResponse = await fetch(
          "https://payport.novalnet.de/v2/transaction/details",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-NN-Access-Key": base64Key,
            },
            body: JSON.stringify(novalnetPayload),
          }
        );
  
        if (!novalnetResponse.ok) {
          throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
        }
  
        responseData = await novalnetResponse.json();
      } catch (err) {
        log.error("Novalnet fetch failed", err);
        throw new Error("Payment verification failed");
      }
  
      const pspReference = parsedData.pspReference;
      if (!pspReference) {
        throw new Error("Missing pspReference");
      }
  
      const tid = responseData?.transaction?.tid ?? "N/A";
      const paymentType = responseData?.transaction?.payment_type ?? "N/A";
      const isTestMode = responseData?.transaction?.test_mode === 1;
      log.info('responsedata-tid');
      log.info(tid);
      log.info(paymentType);
      log.info(JSON.stringify(responseData, null, 2));
      const status = responseData?.transaction?.status;
      const state = status === "PENDING" || status === "ON_HOLD" ? "Pending" : status === "CONFIRMED" ? "Success" : status === "CANCELLED" ? "Canceled" : "Failure";
      const statusCode = responseData?.transaction?.status_code ?? "";
  
      // ---------- 4. Build localized comments ----------
      const supportedLocales: SupportedLocale[] = ["en", "de"];
      const localizedTransactionComments = supportedLocales.reduce(
        (acc, locale) => {
          acc[locale] = [
            t(locale, "payment.transactionId", { tid }),
            t(locale, "payment.paymentType", { type: paymentType }),
            isTestMode ? t(locale, "payment.testMode") : '',
          ].join("\n");
          return acc;
        },
        {} as Record<SupportedLocale, string>
      );
  
      log.info( "Localized transaction comments:", JSON.stringify(localizedTransactionComments, null, 2));
      log.info(localizedTransactionComments.en);
      log.info(localizedTransactionComments.de);
      const transactionComments = lang == 'en' ? localizedTransactionComments.en : localizedTransactionComments.de;
      // ---------- 5. Fetch Payment ----------
      const raw = await this.ctPaymentService.getPayment({
        id: parsedData.ctPaymentId,
      } as any);
  
      const payment = (raw as any)?.body ?? raw;
      const version = payment.version;
  
      if (!payment?.transactions?.length) {
        throw new Error("No transactions on payment");
      }
  
      const tx = payment.transactions.find(
        (t: any) => t.interactionId === pspReference
      );
  
      if (!tx?.id) {
        throw new Error("Transaction not found for PSP reference");
      }
  
      const txId = tx.id;
  
      // ---------- 6. Update Payment ----------
      const actions: any[] = [
        // detach type (schema refresh)
        {
          action: "setTransactionCustomType",
          transactionId: txId,
        },
        // reattach correct type
        {
          action: "setTransactionCustomType",
          transactionId: txId,
          type: {
            key: "novalnet-transaction-comments",
            typeId: "type",
          },
        },
        // set localized field
        {
          action: "setTransactionCustomField",
          transactionId: txId,
          name: "transactionComments",
          value: transactionComments,
        },
        {
          action: "setStatusInterfaceCode",
          interfaceCode: String(statusCode),
        },
        {
          action: "changeTransactionState",
          transactionId: txId,
          state,
        },
      ];
  
      await projectApiRoot
        .payments()
        .withId({ ID: parsedData.ctPaymentId })
        .post({
          body: {
            version,
            actions,
          },
        })
        .execute();
  
      log.info("Payment updated successfully");
  
      // ---------- 7. Store private data ----------
      try {
        const container = "nn-private-data";
        const key = `${parsedData.ctPaymentId}-${pspReference}`;
  
        await customObjectService.upsert(container, key, {
          tid,
          paymentMethod: paymentType,
          status,
          orderNo: responseData?.transaction?.order_no ?? "",
          cMail: responseData?.customer?.email ?? "",
          additionalInfo: {
            comments: localizedTransactionComments,
          },
        });
  
        log.info("CustomObject stored:", key);
      } catch (err) {
        log.error(" CustomObject error", err);
        throw err;
      }
  
      // ---------- 8. Final return ----------
      return {
        paymentReference: responseData?.custom?.paymentRef ?? "",
      };
    } catch (err) {
      log.error("transactionUpdate FAILED", err);
      throw err;
    }
  }
  

  public async createDirectPayment(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponseSchemaDTO> {
    const type = String(request.data?.paymentMethod?.type);
    const config = getConfig();
    const { testMode, paymentAction, dueDate, minimumAmount, enforce3d, displayInline } = getNovalnetConfigValues(
      type,
      config,
    );
    await createTransactionCommentsType();
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const deliveryAddress = await this.ctcc(ctCart);
    const billingAddress = await this.ctbb(ctCart);
    const parsedCart = typeof ctCart === "string" ? JSON.parse(ctCart) : ctCart;
    const dueDateValue = getPaymentDueDate(dueDate);
    const lang = String(request.data?.lang ?? "en") as SupportedLocale;
    const transaction: Record<string, any> = {
      test_mode: testMode === "1" ? "1" : "0",
      payment_type: String(request.data.paymentMethod.type),
      amount: String(parsedCart?.taxedPrice?.totalGross?.centAmount),
      currency: String(parsedCart?.taxedPrice?.totalGross?.currencyCode),
    };

    if (dueDateValue) {
      transaction.due_date = dueDateValue;
    }

    if (String(request.data.paymentMethod.type).toUpperCase() ===
    "DIRECT_DEBIT_SEPA") {
      transaction.payment_data = {
          account_holder: String(request.data.paymentMethod.accHolder),
          iban: String(request.data.paymentMethod.iban),
      };
    }
    if (String(request.data.paymentMethod.type).toUpperCase() ===
    "DIRECT_DEBIT_SEPA" && (String(request.data.paymentMethod.bic) != '')) {
      transaction.payment_data = {
          bic: String(request.data.paymentMethod.bic),
      };
    }
  if (String(request.data.paymentMethod.type).toUpperCase() ===
      "DIRECT_DEBIT_ACH") {
      transaction.payment_data = {
          account_holder: String(request.data.paymentMethod.accHolder),
          account_number: String(request.data.paymentMethod.poNumber),
          routing_number: String(request.data.paymentMethod.invoiceMemo),
      };
  }
  if (String(request.data.paymentMethod.type).toUpperCase() === "CREDITCARD") {
      if(enforce3d == '1') {
          transaction.enforce_3d = 1
      }
      transaction.payment_data = {
          pan_hash: String(request.data.paymentMethod.panHash),
          unique_id: String(request.data.paymentMethod.uniqueId),
      };
  }

  const ctPayment = await this.ctPaymentService.createPayment({
    amountPlanned: await this.ctCartService.getPaymentAmount({
      cart: ctCart,
    }),
    paymentMethodInfo: {
      paymentInterface: getPaymentInterfaceFromContext() || "mock",
    },
    ...(ctCart.customerId && {
      customer: { typeId: "customer", id: ctCart.customerId },
    }),
    ...(!ctCart.customerId &&
      ctCart.anonymousId && {
        anonymousId: ctCart.anonymousId,
      }),
  });

  await this.ctCartService.addPayment({
    resource: { id: ctCart.id, version: ctCart.version },
    paymentId: ctPayment.id,
  });

  const pspReference = randomUUID().toString();

  let firstName = "";
  let lastName = "";

  if (ctCart.customerId) {
    const customerRes = await projectApiRoot
      .customers()
      .withId({ ID: ctCart.customerId })
      .get()
      .execute();

    const ctCustomer: Customer = customerRes.body;

    firstName = ctCustomer.firstName ?? "";
    lastName = ctCustomer.lastName ?? "";
  } else {
    firstName = ctCart.shippingAddress?.firstName ?? "";
    lastName = ctCart.shippingAddress?.lastName ?? "";
  }

    const novalnetPayload = {
      merchant: {
        signature: String(getConfig()?.novalnetPrivateKey),
        tariff: String(getConfig()?.novalnetTariff),
      },
      customer: {
        billing: {
          city: String(billingAddress?.city),
          country_code: String(billingAddress?.country),
          house_no: String(billingAddress?.streetName),
          street: String(billingAddress?.streetName),
          zip: String(billingAddress?.postalCode),
        },
        shipping: {
          city: String(deliveryAddress?.city),
          country_code: String(deliveryAddress?.country),
          house_no: String(deliveryAddress?.streetName),
          street: String(deliveryAddress?.streetName),
          zip: String(deliveryAddress?.postalCode),
        },
        first_name: firstName,
        last_name: lastName,
        email: parsedCart.customerEmail,
      },
      transaction,
      custom: {
        input1: "currencyCode",
        inputval1: String(
          parsedCart?.taxedPrice?.totalGross?.currencyCode ?? "empty",
        ),
        input2: "transaction amount",
        inputval2: String(
          parsedCart?.taxedPrice?.totalGross?.centAmount ?? "empty",
        ),
        input3: "lang",
        inputval3: String(lang ?? "lang not available"),
        input4: "ctpayment-id",
        inputval4: String(ctPayment.id ?? "ctpayment-id not available"),
        input5: "pspReference",
        inputval5: String(pspReference ?? "0"),
      },
    };

    let paymentActionUrl = "payment"; 
    log.info('paymentAction-url');
    log.info(paymentAction);
    log.info(paymentActionUrl);
    if (paymentAction === "authorize") {
      const orderTotal = String(parsedCart?.taxedPrice?.totalGross?.centAmount);
      log.info('order-total');
      log.info(orderTotal);
      log.info('minimumAmount');
      log.info(minimumAmount);
      paymentActionUrl = (orderTotal >= minimumAmount)
        ? "authorize"
        : "payment";
    }
    log.info('paymentAction');
    log.info(paymentAction);
    log.info(paymentActionUrl);
    const url = paymentActionUrl === "payment" ? "https://payport.novalnet.de/v2/payment" : "https://payport.novalnet.de/v2/authorize";
    log.info('url');
    log.info(url);
    let responseString = "";
    let responseData: any;
    try {
      const novalnetResponse = await fetch(url, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-NN-Access-Key': 'YTg3ZmY2NzlhMmYzZTcxZDkxODFhNjdiNzU0MjEyMmM=',
        },
        body: JSON.stringify(novalnetPayload),
      });

      if (!novalnetResponse.ok) {
        throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
      }

      responseData = await novalnetResponse.json();
      responseString = JSON.stringify(responseData);
    } catch (err) {
      log.error("Failed to process payment with Novalnet:", err);
      throw new Error("Payment processing failed");
    }
    const parsedResponse = JSON.parse(responseString);
    const statusCode = parsedResponse?.transaction?.status_code;
    const testModeText = parsedResponse?.transaction?.test_mode == 1 ? 'Test Order' : '';
    const status = parsedResponse?.transaction?.status;
    const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled': 'Failure';
    const transactiondetails = `Novalnet Transaction ID: ${parsedResponse?.transaction?.tid ?? "NN/A"}\nPayment Type: ${parsedResponse?.transaction?.payment_type ?? "NN/A"}\n${testModeText ?? "NN/A"}`;

   
    // -----------------------------
    // Extract safely
    // -----------------------------
    const transactions = parsedResponse?.transaction;

    const amount = transactions?.amount;
    const tid = transactions?.tid;
    const paymentType = transactions?.payment_type;
    const isTestMode = transactions?.test_mode === 1;

    const bankDetails = transactions?.bank_details;
    log.info("transaction-bankdetails");
    log.info(bankDetails?.bank_name);
    const accountHolder = bankDetails?.account_holder;
    const iban = bankDetails?.iban;
    const bic = bankDetails?.bic;
    const bankName = bankDetails?.bank_name;
    const bankPlace = bankDetails?.bank_place;

    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "payment.transactionId", { tid }),
          t(locale, "payment.paymentType", { type: paymentType }),
          isTestMode ? t(locale, "payment.testMode") : '',
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>
    );

    // -----------------------------
    // Bank details comments (optional)
    // -----------------------------
    let localizedBankDetailsComment: Partial<Record<SupportedLocale, string>> = {};
    log.info("transaction-bankName-update");
    log.info(bankName);
    if (bankDetails) {
      localizedBankDetailsComment = supportedLocales.reduce(
        (acc, locale) => {
          acc[locale] = [
            t(locale, "payment.referenceText", { amount }),
            t(locale, "payment.accountHolder", { accountHolder }),
            t(locale, "payment.iban", { iban }),
            t(locale, "payment.bic", { bic }),
            t(locale, "payment.bankName", { bankName }),
            t(locale, "payment.bankPlace", { bankPlace }),
            t(locale, "payment.transactionId", { tid }),
          ].join("\n");
          return acc;
        },
        {} as Record<SupportedLocale, string>
      );
    }

    // -----------------------------
    // Final language selection
    // -----------------------------
    let transactionComments = localizedTransactionComments[lang];

    if (localizedBankDetailsComment[lang]) {
      transactionComments += `\n\n${localizedBankDetailsComment[lang]}`;
    }

    // -----------------------------
    // Debug logs
    // -----------------------------
    log.info(
      "Localized transaction comments:",
      JSON.stringify(localizedTransactionComments, null, 2)
    );
    log.info("Final transaction comments:", transactionComments);
    log.info("Payment created with Novalnet details for direct:");
    log.info("Payment transactionComments for direct:", transactionComments);
    log.info("ctPayment id for direct:", ctPayment.id);
    log.info("psp reference for direct:", pspReference);

    // ---------------------------
    // CREATE TRANSACTION (NO CUSTOM)
    // ---------------------------
    await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference,
      paymentMethod: request.data.paymentMethod.type,
      transaction: {
        type: "Authorization",
        amount: ctPayment.amountPlanned,
        interactionId: pspReference,
        state: state,
        custom: {
          type: {
          typeId: "type",
          key: "novalnet-transaction-comments",
          },
          fields: {
          transactionComments,
          },
        },
      } as unknown as any,
    } as any);

    const raw = await this.ctPaymentService.getPayment({ id: ctPayment.id } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === pspReference
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: ctPayment.id })
    .post({
      body: {
        version,
        actions: [
          {
            action: "setStatusInterfaceCode",
            interfaceCode: String(statusCode),
          },
        ],
      },
    })
    .execute();
    
    // 1) Find order by payment
const orderResult = await projectApiRoot
  .orders()
  .get({
    queryArgs: {
      where: `paymentInfo(payments(id = "${ctPayment.id}"))`,
      limit: 1,
    },
  })
  .execute();

const order = orderResult.body.results[0];
if (!order) {
  // handle no-order-found case
  log.info('No order found for payment', ctPayment.id);
} else {
  const orderId = order.id;

  // 2) Now you can safely update the order state/paymentState
  await projectApiRoot
    .orders()
    .withId({ ID: orderId })
    .post({
      body: {
        version: order.version,
        actions: [
          {
            action: 'changePaymentState',
            paymentState: 'Paid',
          },
        ],
      },
    })
    .execute();
}



    const comment = await this.getTransactionComment(
      ctPayment.id,
      pspReference
    );
    log.info('comment-updated');
    log.info(comment);
    log.info('comment-updated-after');

	// inside your function
	try {
	  const paymentIdValue = ctPayment.id;
	  const container = "nn-private-data";
	  const key = `${paymentIdValue}-${pspReference}`;

	  log.info("Storing sensitive data under custom object key:", key);

	  // upsert returns the SDK response for create/update (you can inspect if needed)
	  const upsertResp = await customObjectService.upsert(container, key, {
		deviceId: "device-1234",
		riskScore: 42,
		orderNo: parsedResponse?.transaction?.order_no ?? '',
		tid: parsedResponse?.transaction?.tid ?? '',
		paymentMethod:  parsedResponse?.transaction?.payment_type ?? '',
		cMail:  parsedResponse?.customer?.email ?? '',
		status:  parsedResponse?.transaction?.status ?? '',
		totalAmount: parsedResponse?.transaction?.amount ?? '',
		callbackAmount: 0,
		additionalInfo:{
			comments:transactionComments ?? '',
		}
	  });

	  log.info("CustomObject upsert done");

	  // get returns the found object (or null). The object has .value
	  const obj = await customObjectService.get(container, key);
	  log.info('Value are getted');
	  log.info(JSON.stringify(obj, null, 2) ?? 'noobjnull');
	  if (!obj) {
		log.warn("CustomObject missing after upsert (unexpected)", { container, key });
	  } else {
		// obj.value contains the stored data
		const stored = obj.value;

		// DON'T log raw sensitive data in production. Example: mask deviceId
		const maskedDeviceId = stored.deviceId ? `${stored.deviceId.slice(0, 6)}…` : undefined;
		log.info("Stored custom object (masked):", {
		  container: obj.container,
		  key: obj.key,
		  version: obj.version,
		  deviceId: maskedDeviceId,
		  riskScore: stored.riskScore, // if non-sensitive you may log
		});
		log.info(stored.tid);
		log.info(stored.status);
		log.info(stored.cMail);
    log.info(stored.additionalInfo.comments);
		// If you really need the full payload for debugging (dev only), stringify carefully:
		// log.debug("Stored full payload (dev only):", JSON.stringify(stored, null, 2));
	  }
	} catch (err) {
	  log.error("Error storing / reading CustomObject", { error: (err as any).message ?? err });
	  throw err; // or handle as appropriate
	}
  const statusValue = parsedResponse?.transaction?.status;
  const statusTextValue = parsedResponse?.transaction?.status_text;

    // return payment id (ctPayment was created earlier; no inline/custom update)
    return {
      paymentReference: ctPayment.id,
      novalnetResponse: parsedResponse,  
      transactionStatus: statusValue,  
      transactionStatusText: statusTextValue,  
    };
  }


  // ==================================================
  // ENTRY POINT
  // ==================================================
  public async createWebhook(
    webhookData: any[],
    req?: FastifyRequest
  ): Promise<any> {
    if (!Array.isArray(webhookData) || webhookData.length === 0) {
      throw new Error('Invalid webhook payload');
    }

    const webhook = webhookData[0];

    log.info('Webhook data received in service');
    log.info('Event:', webhook?.event?.type);
    log.info('Checksum:', webhook?.event?.checksum);

    // === VALIDATIONS (PHP equivalent)
    await this.validateRequiredParameters(webhook);
    log.info('validateRequiredParameters checksum success');
    await this.validateChecksum(webhook);
    log.info('validate checksum success');
    if (req) {
      await this.validateIpAddress(req);
    }
    const eventType = webhook.event?.type;
    const status = webhook.result?.status;
    let lang = webhook.custom?.lang;
    this.getOrderDetails(webhook);
    if (status !== 'SUCCESS') {
      log.warn('Webhook status is not SUCCESS');
      return { message: 'Webhook ignored (non-success)' };
    }
	let transactionComments: string | undefined;
    // === EVENT ROUTING
    switch (eventType) {
      case 'PAYMENT':
        transactionComments = await this.handlePayment(webhook);
        break;

      case 'TRANSACTION_CAPTURE':
        transactionComments = await this.handleTransactionCapture(webhook);
        break;

      case 'TRANSACTION_CANCEL':
         transactionComments = await this.handleTransactionCancel(webhook);
        break;

      case 'TRANSACTION_REFUND':
        transactionComments = await this.handleTransactionRefund(webhook);
        break;

      case 'TRANSACTION_UPDATE':
        transactionComments = await this.handleTransactionUpdate(webhook);
        break;

      case 'CREDIT':
        transactionComments = await this.handleCredit(webhook);
        break;

      case 'CHARGEBACK':
        transactionComments = await this.handleChargeback(webhook);
        break;

      case 'PAYMENT_REMINDER_1':
      case 'PAYMENT_REMINDER_2':
        transactionComments = await this.handlePaymentReminder(webhook);
        break;

      case 'SUBMISSION_TO_COLLECTION_AGENCY':
        transactionComments = await this.handleCollectionSubmission(webhook);
        break;

      default:
        log.warn(`Unhandled Novalnet event type: ${eventType}`);
    }

    return {
      message: transactionComments,
      eventType,
    };
  }

  // ==================================================
  // EVENT HANDLERS
  // ==================================================

  public async handlePayment(webhook: any) {
    const transactionComments = `Novalnet Transaction ID: ${webhook.transaction.tid ?? "NN/A"}\nPayment Type: ${webhook.transaction.payment_type ?? "NN/A"}\n${webhook.result.status_text ?? "NN/A"}`;
    log.info("handle payment event");
    const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval4 } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === webhook.custom.inputval5
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const existingComments: string = tx.custom?.fields?.transactionComments ?? '';
    const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
    log.info(txId);
    log.info(webhook.custom.inputval4);   
    log.info(transactionComments);
    const statusCode = webhook?.transaction?.status_code ?? '';
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: webhook.custom.inputval4 })
    .post({
    body: {
      version,
      actions: [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: updatedTransactionComments,
      },
      {
        action: "setStatusInterfaceCode",
        interfaceCode: String(statusCode)
      },
      {
        action: 'changeTransactionState',
        transactionId: txId,
        state: 'Success',
      },
      ],
    },
    })
    .execute();
    return transactionComments;
  }

  public async handleTransactionCapture(webhook: any) {
    const { date, time } = await this.getFormattedDateTime();
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const lang = webhook.custom.lang;
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.captureComment", { date, time }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>
    );
    const transactionComments = lang == 'en' ? localizedTransactionComments.en : localizedTransactionComments.de;
    const status = webhook?.transaction?.status;
    const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled': 'Failure';
    log.info("handle payment capture");
    const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval4 } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === webhook.custom.inputval5
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const existingComments: string = tx.custom?.fields?.transactionComments ?? '';
    const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
    log.info(txId);
    log.info(webhook.custom.inputval4);
    log.info(transactionComments);
    const statusCode = webhook?.transaction?.status_code ?? '';
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: webhook.custom.inputval4 })
    .post({
    body: {
      version,
      actions: [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: updatedTransactionComments,
      },
      {
        action: "setStatusInterfaceCode",
        interfaceCode: String(statusCode)
      },
      {
        action: 'changeTransactionState',
        transactionId: txId,
        state: state,
      },
      ],
    },
    })
    .execute();
        log.info('PAYMENT event', {
          tid: webhook.event.tid,
        });
    return transactionComments;
  }

  public async handleTransactionCancel(webhook: any) {
    const { date, time } = await this.getFormattedDateTime();
    const lang = webhook.custom.lang;
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.cancelComment", { date, time }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>
    );
    const transactionComments = lang == 'de' ? localizedTransactionComments.de : localizedTransactionComments.en;
    log.info("handle payment cancel");
    log.info(lang);
    const status = webhook?.transaction?.status;
    const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled': 'Failure';
    const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval4 } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === webhook.custom.inputval5
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const existingComments: string = tx.custom?.fields?.transactionComments ?? '';
    const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
    log.info(txId);
    log.info(webhook.custom.inputval4);   
    log.info(transactionComments);
    const statusCode = webhook?.transaction?.status_code ?? '';
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: webhook.custom.inputval4 })
    .post({
    body: {
      version,
      actions: [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: updatedTransactionComments,
      },
      {
        action: "setStatusInterfaceCode",
        interfaceCode: String(statusCode)
      },
      {
        action: 'changeTransactionState',
        transactionId: txId,
        state: state,
      },
      ],
    },
    })
    .execute();
        log.info('PAYMENT event', {
          tid: webhook.event.tid,
        });

     return transactionComments;   
  }

  public async handleTransactionRefund(webhook: any) {
    log.info('TRANSACTION_REFUND', webhook.transaction.refund);
    const eventTID = webhook.event.tid;
    const parentTID = webhook.event.parent_tid ?? eventTID;
    const amount = webhook.transaction.amount / 100;
    const currency = webhook.transaction.currency;
    const { date, time } = await this.getFormattedDateTime();
    const refundedAmount = webhook.transaction.refund.amount;
    const refundTID = webhook.transaction.refund.tid ?? '';
    let lang = webhook.custom.lang;

    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.refundComment", { eventTID, refundedAmount, currency }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>
    );

    const localizedTransactionComment = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.refundTIDComment", { eventTID, refundedAmount, currency, refundTID }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>
    );
    const refundComment = lang == 'de' ? localizedTransactionComments.de : localizedTransactionComments.en;
    const refundTIDComment = lang == 'de' ? localizedTransactionComment.de : localizedTransactionComment.en;
    const transactionComments = refundTID ? refundTIDComment : refundComment;
    log.info("handle transaction refund");
    const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval4 } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === webhook.custom.inputval5
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const existingComments: string = tx.custom?.fields?.transactionComments ?? '';
    const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
    log.info(txId);
    log.info(webhook.custom.inputval4);   
    log.info(transactionComments);
    const statusCode = webhook?.transaction?.status_code ?? '';
    const status = webhook?.transaction?.status;
    const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled': 'Failure';
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: webhook.custom.inputval4 })
    .post({
    body: {
      version,
      actions: [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: updatedTransactionComments,
      },
      {
        action: "setStatusInterfaceCode",
        interfaceCode: String(statusCode)
      },
      ],
    },
    })
    .execute();
    return transactionComments;
  }

  public async handleTransactionUpdate(webhook: any) {

    let eventTID = webhook.event.tid;
    let transactionID = webhook.transaction.tid;
    let parentTID = webhook.event.parent_tid ?? eventTID;
    let amount = String(webhook.transaction.amount / 100);
    let currency = webhook.transaction.currency;
    let dueDate = webhook.transaction.due_date;
    let { date, time } = await this.getFormattedDateTime();
    let supportedLocales: SupportedLocale[] = ["en", "de"];
    let lang = webhook.custom.lang;

    const amountUpdateComment = await this.localcomments("webhook.amountUpdateComment", { eventTID: eventTID, amount: amount, currency: currency });
    const dueDateUpdateComment = await this.localcomments("webhook.dueDateUpdateComment", { eventTID: eventTID, amount: amount, currency: currency, dueDate: dueDate });

    const orderDetails = await this.getOrderDetails(webhook);
    log.info('TRANSACTION_UPDATE');
    log.info(orderDetails.tid);
    let transactionComments = '';

    if (['DUE_DATE', 'AMOUNT', 'AMOUNT_DUE_DATE'].includes(webhook.transaction.update_type)) {
       transactionComments = lang == 'en' ? amountUpdateComment.en : amountUpdateComment.de;
      if(webhook.transaction.due_date) {
        const dueDate = webhook.transaction.due_date;
        transactionComments =  lang == 'en' ? dueDateUpdateComment.en : dueDateUpdateComment.de;
      }
    }
    
    const pendingToComplete = await this.localcomments("webhook.pendingToComplete", { eventTID: eventTID, date: date, time: time });
    const onholdToComplete = await this.localcomments("webhook.onholdToComplete", { eventTID: eventTID, date: date, time: time });
    const confirmComments = await this.localcomments("webhook.confirmComment", { date, time });
    const cancelComments = await this.localcomments("webhook.cancelComment", { date, time });

    if (orderDetails.status != webhook.transaction.status && ['PENDING', 'ON_HOLD'].includes(orderDetails.status)) {
      if (webhook.transaction.status === 'CONFIRMED') {
        transactionComments = lang == 'en' ? pendingToComplete.en : pendingToComplete.de;
      } else if (webhook.transaction.status === 'ON_HOLD') {
        transactionComments = lang == 'en' ? onholdToComplete.en : onholdToComplete.de;
      } else {
        transactionComments = lang == 'en' ? cancelComments.en : cancelComments.de;
      }

    } else if (orderDetails.status === 'ON_HOLD') {
      if (webhook.transaction.status === 'CONFIRMED') {
        transactionComments = lang == 'en' ? confirmComments.en : confirmComments.de;
      } else {
        transactionComments = lang == 'en' ? cancelComments.en : cancelComments.de;
      }
    }

    log.info("handle transaction update");
    const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval4 } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === webhook.custom.inputval5
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const existingComments: string = tx.custom?.fields?.transactionComments ?? '';
    const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
    log.info(txId);
    log.info(webhook.custom.inputval4);   
    log.info(transactionComments);
    const statusCode = webhook?.transaction?.status_code ?? '';
    const status = webhook?.transaction?.status;
    const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled': 'Failure';
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: webhook.custom.inputval4 })
    .post({
    body: {
      version,
      actions: [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: updatedTransactionComments,
      },
      {
        action: "setStatusInterfaceCode",
        interfaceCode: String(statusCode)
      },
      {
        action: 'changeTransactionState',
        transactionId: txId,
        state: state,
      },
      ],
    },
    })
    .execute();
    return transactionComments;
  }

  public async handleCredit(webhook: any) {
    const eventTID = webhook.event.tid;
    const transactionID = webhook.transaction.tid;
    const parentTID = webhook.event.parent_tid ?? eventTID;
    const amount = String(webhook.transaction.amount / 100);
    const currency = webhook.transaction.currency;
    const { date, time } = await this.getFormattedDateTime();
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const lang = webhook.custom.lang;
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.creditComment", { parentTID, amount, currency, date, time, transactionID}),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>
    );
    const transactionComments = lang == 'en' ? localizedTransactionComments.en : localizedTransactionComments.de;
    log.info('CREDIT');
    log.info("handle transaction credit");
    const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval4 } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === webhook.custom.inputval5
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const existingComments: string = tx.custom?.fields?.transactionComments ?? '';
    const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
    log.info(txId);
    log.info(webhook.custom.inputval4);   
    log.info(transactionComments);
    const statusCode = webhook?.transaction?.status_code ?? '';
    const status = webhook?.transaction?.status;
    const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled': 'Failure';
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: webhook.custom.inputval4 })
    .post({
    body: {
      version,
      actions: [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: updatedTransactionComments,
      },
      {
        action: "setStatusInterfaceCode",
        interfaceCode: String(statusCode)
      },
      {
        action: 'changeTransactionState',
        transactionId: txId,
        state: state,
      },
      ],
    },
    })
    .execute();
    return transactionComments;
  }

  public async handleChargeback(webhook: any) {
	  const eventTID = webhook.event.tid;
    const transactionID = webhook.transaction.tid;
    const parentTID = webhook.event.parent_tid ?? eventTID;
    const amount = String(webhook.transaction.amount / 100);
    const currency = webhook.transaction.currency;
    const { date, time } = await this.getFormattedDateTime();
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const lang = webhook.custom.lang;
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.chargebackComment", { parentTID, amount, currency, date, time, eventTID }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>
    );
    const transactionComments = lang == 'en' ? localizedTransactionComments.en : localizedTransactionComments.de;
    log.info("handle chargeback");
    const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval4 } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === webhook.custom.inputval5
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const existingComments: string = tx.custom?.fields?.transactionComments ?? '';
    const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
    const status = webhook?.transaction?.status;
    const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled': 'Failure';
    log.info(txId);
    log.info(webhook.custom.inputval4);   
    log.info(transactionComments);
    const statusCode = webhook?.transaction?.status_code ?? '';
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: webhook.custom.inputval4 })
    .post({
    body: {
      version,
      actions: [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: updatedTransactionComments,
      },
      {
        action: "setStatusInterfaceCode",
        interfaceCode: String(statusCode)
      },
      {
        action: 'changeTransactionState',
        transactionId: txId,
        state: state,
      },
      ],
    },
    })
    .execute();
        log.info('PAYMENT event', {
          tid: webhook.event.tid,
        });
        return transactionComments;
  }

  public async handlePaymentReminder(webhook: any) {
    const { date, time } = await this.getFormattedDateTime();
    const reminderIndex = webhook.event.type.split('_')[2];
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const lang = webhook.custom.lang;
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.paymentRemainderComment", { reminderIndex }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>
    );
    const transactionComments = lang == 'de' ? localizedTransactionComments.de : localizedTransactionComments.en;
    log.info("handle payment update");

    const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval4 } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === webhook.custom.inputval5
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const existingComments: string = tx.custom?.fields?.transactionComments ?? '';
    const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
    log.info(txId);
    log.info(webhook.custom.inputval4);   
    log.info(transactionComments);
    const statusCode = webhook?.transaction?.status_code ?? '';
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: webhook.custom.inputval4 })
    .post({
    body: {
      version,
      actions: [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: updatedTransactionComments,
      },
      ],
    },
    })
    .execute();
        log.info('PAYMENT event', {
          tid: webhook.event.tid,
        });
    return transactionComments;
  }

  public async handleCollectionSubmission(webhook: any) {
    const collectionReference = webhook.collection.reference;
    const { date, time } = await this.getFormattedDateTime();
    const reminderIndex = webhook.event.type.split('_')[2];
    const lang = webhook.custom.lang;
    const supportedLocales: SupportedLocale[] = ["en", "de"];
    const localizedTransactionComments = supportedLocales.reduce(
      (acc, locale) => {
        acc[locale] = [
          t(locale, "webhook.collectionSubmissionComment", { reminderIndex }),
        ].join("\n");
        return acc;
      },
      {} as Record<SupportedLocale, string>
    );
    const transactionComments = lang == 'de' ? localizedTransactionComments.de : localizedTransactionComments.en;
    log.info("handle collection submission");
    const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval4 } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const tx = payment.transactions?.find((t: any) =>
      t.interactionId === webhook.custom.inputval5
    );
    if (!tx) throw new Error("Transaction not found");
    const txId = tx.id;
    if (!txId) throw new Error('Transaction missing id');
    const existingComments: string = tx.custom?.fields?.transactionComments ?? '';
    const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
    log.info(txId);
    log.info(webhook.custom.inputval4);   
    log.info(transactionComments);
    const statusCode = webhook?.transaction?.status_code ?? '';
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: webhook.custom.inputval4 })
    .post({
    body: {
      version,
      actions: [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: updatedTransactionComments,
      },
      ],
    },
    })
    .execute();
        log.info('PAYMENT event', {
          tid: webhook.event.tid,
        });
        return transactionComments;
  }

  // ==================================================
  // VALIDATIONS (PHP equivalents)
  // ==================================================

  public async validateRequiredParameters(payload: any) {
    log.info('validateRequiredParameters enter');
    const mandatory: Record<string, string[]> = {
      event: ['type', 'checksum', 'tid'],
      merchant: ['vendor', 'project'],
      result: ['status'],
      transaction: ['tid', 'payment_type', 'status'],
    };
    log.info('validateRequiredParameters variable');
    for (const category of Object.keys(mandatory)) {
      if (!payload[category]) {
        throw new Error(`Missing category: ${category}`);
      }

      for (const param of mandatory[category]) {
        if (!payload[category][param]) {
          throw new Error(`Missing parameter ${param} in ${category}`);
        }
      }
    }
    log.info('validateRequiredParameters done');
  }

public async validateIpAddress(req: FastifyRequest): Promise<void> {
  log.info('validateIpAddress enter');
  const novalnetHost = 'pay-nn.de';

  const { address: novalnetHostIP } = await dns.lookup(novalnetHost);

  if (!novalnetHostIP) {
    throw new Error('Novalnet HOST IP missing');
  }

  // 🔧 FIX IS HERE
  const requestReceivedIP = await this.getRemoteAddress(req, novalnetHostIP);
  const webhookTestMode = String(getConfig()?.novalnetWebhookTestMode);
  log.info('Novalnet Host IP:', novalnetHostIP);
  log.info('Request IP:', requestReceivedIP);
  if (novalnetHostIP !== requestReceivedIP && webhookTestMode == "0") {
    throw new Error(
      `Unauthorized access from the IP ${requestReceivedIP}`
    );
  }
}


  /**
   * Equivalent of PHP getRemoteAddress()
   */
public async getRemoteAddress(
  req: FastifyRequest,
  novalnetHostIP: string
): Promise<string> {
  const headers = req.headers;

  const ipKeys = [
    'x-forwarded-host',
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'x-forwarded',
    'x-cluster-client-ip',
    'forwarded-for',
    'forwarded',
  ];

  for (const key of ipKeys) {
    const value = headers[key] as string | undefined;

    if (value) {
      if (key === 'x-forwarded-for' || key === 'x-forwarded-host') {
        const forwardedIPs = value.split(',').map(ip => ip.trim());
        return forwardedIPs.includes(novalnetHostIP)
          ? novalnetHostIP
          : forwardedIPs[0];
      }
      return value;
    }
  }
  return req.ip;
}

  
  public validateChecksum(payload: any) {
    log.info('validateChecksum enter');
      const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
    if (!accessKey) {
      log.warn('NOVALNET_ACCESS_KEY not configured');
      return;
    }

    let token =
      payload.event.tid +
      payload.event.type +
      payload.result.status;
      log.info('validateChecksum token created');
    if (payload.transaction?.amount) {
      token += payload.transaction.amount;
    }

    if (payload.transaction?.currency) {
      token += payload.transaction.currency;
    }

    token += accessKey.split('').reverse().join('');
    log.info('validateChecksum token done');
    const generatedChecksum = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
      log.info('token');
      log.info(token);
      log.info('validateChecksum generatecehcsum created');
      log.info(generatedChecksum);
      log.info(payload.event.checksum);
    if (generatedChecksum !== payload.event.checksum) {
      throw new Error('Checksum validation failed');
    }
  }

public async getOrderDetails(payload: any) {
  const paymentIdValue = payload.custom.inputval4;
  const pspReference = payload.custom.inputval5;
  const container = "nn-private-data";
  const key = `${paymentIdValue}-${pspReference}`;
  const obj = await customObjectService.get(container, key);
  log.info('Value are getted');
  log.info(JSON.stringify(obj, null, 2) ?? 'noobjnull');
  if (!obj) {
  log.warn("CustomObject missing after upsert (unexpected)", { container, key });
  } else {
  // obj.value contains the stored data
  const stored = obj.value;
  const maskedDeviceId = stored.deviceId ? `${stored.deviceId.slice(0, 6)}…` : undefined;
  log.info("Stored custom object (masked):", {
    container: obj.container,
    key: obj.key,
    version: obj.version,
    deviceId: maskedDeviceId,
    riskScore: stored.riskScore, 
  });
  log.info('stored-tid');
  log.info(stored.tid);
  log.info(stored.status);
  log.info(stored.cMail);
  log.info(stored.additionalInfo.comments);
  return stored;
  }
}

public async updatePaymentStatusByPaymentId(
  paymentId: string,
  transactionId: string,
  newState: 'Initial' | 'Pending' | 'Success' | 'Failure' | 'Paid'
) {
  const paymentRes = await projectApiRoot
    .payments()
    .withId({ ID: paymentId })
    .get()
    .execute();

  const payment = paymentRes.body;

  const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: paymentId })
    .post({
      body: {
        version: payment.version,
        actions: [
          {
            action: 'changeTransactionState',
            transactionId,
            state: newState,
          },
        ],
      },
    })
    .execute();

  return updatedPayment.body;
}


  
  public async getTransactionComment(paymentId: string, pspReference: string) {

    // 1) Fetch payment from commercetools
    const response = await projectApiRoot
      .payments()
      .withId({ ID: paymentId })
      .get()
      .execute();
    const payment = response.body;
  
    // 2) Find the transaction using interactionId (pspReference)
    const tx = payment.transactions?.find(
      (t: any) =>
        t.interactionId === pspReference ||
        String(t.interactionId) === String(pspReference)
    );
  
    if (!tx) throw new Error("Transaction not found");
    // 3) If transaction has custom fields, extract the value
    const comment =
      tx.custom?.fields?.transactionComments ?? null;
  
    return comment;
  }


  public async getFormattedDateTime(): Promise<{ date: string; time: string }> {
    const formatDateTime = () => {
      const now = new Date();
      return {
        date: now.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        time: now.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      };
    };
  
    return formatDateTime();
  }

  public async createRedirectPayment(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponseSchemaDTO> {
    log.info("Request data:", JSON.stringify(request.data, null, 2));
    const type = String(request.data?.paymentMethod?.type ?? "INVOICE");
    const lang = String(request.data?.lang);
    const path = String(request.data?.path);
    log.info("Payment type:");
    log.info(type);
    log.info(lang);
    log.info(getFutureOrderNumberFromContext());
    const config = getConfig();
    log.info("Config loaded:", {
      hasPrivateKey: !!config.novalnetPrivateKey,
      hasTariff: !!config.novalnetTariff,
      privateKeyLength: config.novalnetPrivateKey?.length || 0
    });
    await createTransactionCommentsType();
    const { testMode, paymentAction } = getNovalnetConfigValues(type, config);
    log.info("Novalnet config:", { testMode, paymentAction });
    const cartId = getCartIdFromContext();
    log.info("Cart ID from context:", cartId);
    const ctCart = await this.ctCartService.getCart({
      id: cartId,
    });
    log.info("Cart retrieved:", {
      id: ctCart.id,
      version: ctCart.version,
      customerId: ctCart.customerId,
      anonymousId: ctCart.anonymousId,
      customerEmail: ctCart.customerEmail
    });
    
    const deliveryAddress = await this.ctcc(ctCart);
    const billingAddress = await this.ctbb(ctCart);
    log.info("Addresses:", {
      billing: billingAddress,
      delivery: deliveryAddress
    });
    
    const parsedCart = typeof ctCart === "string" ? JSON.parse(ctCart) : ctCart;
    log.info("Cart amount:", {
      centAmount: parsedCart?.taxedPrice?.totalGross?.centAmount,
      currency: parsedCart?.taxedPrice?.totalGross?.currencyCode
    });
    
    const processorURL = Context.getProcessorUrlFromContext();
    const sessionId = Context.getCtSessionIdFromContext();
    log.info("Context data:", {
      processorURL,
      sessionId
    });

    const paymentAmount = await this.ctCartService.getPaymentAmount({
      cart: ctCart,
    });
    log.info("Payment amount calculated:", paymentAmount);
    
    const paymentInterface = getPaymentInterfaceFromContext() || "mock";
    log.info("Payment interface:", paymentInterface);
    
    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned: paymentAmount,
      paymentMethodInfo: {
        paymentInterface,
      },
      ...(ctCart.customerId && {
        customer: { typeId: "customer", id: ctCart.customerId },
      }),
      ...(!ctCart.customerId &&
        ctCart.anonymousId && {
          anonymousId: ctCart.anonymousId,
        }),
    });
    log.info("CT Payment created:", {
      id: ctPayment.id,
      amountPlanned: ctPayment.amountPlanned
    });

    await this.ctCartService.addPayment({
      resource: { id: ctCart.id, version: ctCart.version },
      paymentId: ctPayment.id,
    });
 
    // Generate transaction comments
    const transactionComments = `Novalnet Transaction ID: ${"N/A"}\nPayment Type: ${"N/A"}\nStatus: ${"N/A"}`;
    const pspReference = randomUUID().toString();

    // ---------------------------
    // CREATE TRANSACTION (NO CUSTOM)
    // ---------------------------
    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference,
      paymentMethod: request.data.paymentMethod.type,
      transaction: {
        type: "Authorization",
        amount: ctPayment.amountPlanned,
        interactionId: pspReference,
        state: 'Pending',
        custom: {
          type: {
          typeId: "type",
          key: "novalnet-transaction-comments",
          },
          fields: {
          transactionComments,
          },
        },
      } as unknown as any,
    } as any);

    
    const paymentRef    = (updatedPayment as any)?.id ?? ctPayment.id;
    const paymentCartId = ctCart.id;
    const orderNumber   = getFutureOrderNumberFromContext() ?? "";
    const ctPaymentId   = ctPayment.id;
  // 🔹 1) Prepare name variables
  let firstName = "";
  let lastName = "";

  // 🔹 2) If the cart is linked to a CT customer, fetch it directly from CT
  if (ctCart.customerId) {
    const customerRes = await projectApiRoot
      .customers()
      .withId({ ID: ctCart.customerId })
      .get()
      .execute();

    const ctCustomer: Customer = customerRes.body;

    firstName = ctCustomer.firstName ?? "";
    lastName = ctCustomer.lastName ?? "";
  } else {
    // 🔹 3) Guest checkout → fallback to shipping address
    firstName = ctCart.shippingAddress?.firstName ?? "";
    lastName = ctCart.shippingAddress?.lastName ?? "";
  }

    const url = new URL("/success", processorURL);
    url.searchParams.append("paymentReference", paymentRef);
    url.searchParams.append("ctsid", sessionId);
    url.searchParams.append("orderNumber", orderNumber);
    url.searchParams.append("ctPaymentID", ctPaymentId);
    url.searchParams.append("pspReference", pspReference);
    url.searchParams.append("lang", lang);
    url.searchParams.append("path", path);
    const returnUrl = url.toString();
    
    const urlFailure = new URL("/failure", processorURL);
    urlFailure.searchParams.append("paymentReference", paymentRef);
    urlFailure.searchParams.append("ctsid", sessionId);
    urlFailure.searchParams.append("orderNumber", orderNumber);
    urlFailure.searchParams.append("ctPaymentID", ctPaymentId);
    urlFailure.searchParams.append("pspReference", pspReference);
    urlFailure.searchParams.append("lang", lang);
    urlFailure.searchParams.append("path", path);
    const errorReturnUrl = urlFailure.toString();

    const ReturnurlContext = getMerchantReturnUrlFromContext();
    const novalnetPayload = {
      merchant: {
        signature: String(getConfig()?.novalnetPrivateKey ?? ""),
        tariff: String(getConfig()?.novalnetTariff ?? ""),
      },
      customer: {
        billing: {
          city: String(billingAddress?.city),
          country_code: String(billingAddress?.country),
          house_no: String(billingAddress?.streetName ),
          street: String(billingAddress?.streetName ),
          zip: String(billingAddress?.postalCode),
        },
        shipping: {
          city: String(deliveryAddress?.city),
          country_code: String(deliveryAddress?.country),
          house_no: String(deliveryAddress?.streetName),
          street: String(deliveryAddress?.streetName),
          zip: String(deliveryAddress?.postalCode),
        },
        first_name: firstName,
        last_name: lastName,
        email: parsedCart.customerEmail,
      },
      transaction: {
        test_mode: testMode === "1" ? "1" : "0",
        payment_type: type.toUpperCase(),
        amount: String(parsedCart?.taxedPrice?.totalGross?.centAmount),
        currency: String(parsedCart?.taxedPrice?.totalGross?.currencyCode),
        return_url: returnUrl,
        error_return_url: errorReturnUrl,
        order_no: orderNumber
      },
      hosted_page: {
        display_payments: [type.toUpperCase()],
        hide_blocks: [
          "ADDRESS_FORM",
          "SHOP_INFO",
          "LANGUAGE_MENU",
          "HEADER",
          "TARIFF",
        ],
        skip_pages: ["CONFIRMATION_PAGE", "SUCCESS_PAGE", "PAYMENT_PAGE"],
      },
      custom: {
        input1: "paymentRef",
        inputval1: String(paymentRef ?? "no paymentRef"),
        input2: "ReturnurlContexts",
        inputval2: String(ReturnurlContext ?? "no merchantReturnURL"),
        input3: "lang",
        inputval3: String(lang ?? 'no-lang'),
        input4: "ctpayment-id",
        inputval4: String(ctPaymentId ?? "ctpayment-id not available"),
        input5: "pspReference",
        inputval5: String(pspReference ?? "0"),
        input6: "langUpdated",
        inputval6: String(lang ?? 'no-lang'),
      },
    };

    log.info("Full Novalnet payload:", JSON.stringify(novalnetPayload, null, 2));
    let parsedResponse: any = {};
    try {
      const novalnetResponse = await fetch(
        "https://payport.novalnet.de/v2/seamless/payment",
        {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-NN-Access-Key': 'YTg3ZmY2NzlhMmYzZTcxZDkxODFhNjdiNzU0MjEyMmM=',
          },
          body: JSON.stringify(novalnetPayload),
        },
      );
      log.info("Novalnet response status:", novalnetResponse.status);
      if (!novalnetResponse.ok) {
        throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
      }

      parsedResponse = await novalnetResponse.json();
      log.info("Novalnet response parsed:", JSON.stringify(parsedResponse, null, 2));
    } catch (err) {
      log.error("Failed to process payment with Novalnet:", err);
      throw new Error("Payment initialization failed");
    }

    // Check for Novalnet API errors
    if (parsedResponse?.result?.status !== 'SUCCESS') {
      log.error("Novalnet API error - Status not SUCCESS:", {
        status: parsedResponse?.result?.status,
        statusText: parsedResponse?.result?.status_text,
        fullResponse: parsedResponse
      });
      throw new Error(parsedResponse?.result?.status_text || "Payment initialization failed");
    }
    const redirectResult = parsedResponse?.result?.redirect_url;
    const txnSecret = parsedResponse?.transaction?.txn_secret;
    if (!txnSecret) {
      log.error("No txn_secret in Novalnet response:", {
        transaction: parsedResponse?.transaction,
        fullResponse: parsedResponse
      });
      throw new Error("Payment initialization failed - missing transaction secret");
    }

    log.info("=== IDEAL PAYMENT SUCCESS ===, returning txn_secret:", txnSecret);
    return {
      paymentReference: paymentRef,
      txnSecret: redirectResult,
    };
  }


  public async handleTransaction(
    transactionDraft: TransactionDraftDTO,
  ): Promise<TransactionResponseDTO> {
    const TRANSACTION_AUTHORIZATION_TYPE: TransactionType = "Authorization";
    const TRANSACTION_STATE_SUCCESS: TransactionState = "Success";
    const TRANSACTION_STATE_FAILURE: TransactionState = "Failure";
    const maxCentAmountIfSuccess = 10000;

    const ctCart = await this.ctCartService.getCart({
      id: transactionDraft.cartId,
    });

    let amountPlanned = transactionDraft.amount;
    if (!amountPlanned) {
      amountPlanned = await this.ctCartService.getPaymentAmount({
        cart: ctCart,
      });
    }

    const isBelowSuccessStateThreshold =
amountPlanned.centAmount < maxCentAmountIfSuccess;

    const newlyCreatedPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: transactionDraft.paymentInterface,
      },
    });

    await this.ctCartService.addPayment({
      resource: {
        id: ctCart.id,
        version: ctCart.version,
      },
      paymentId: newlyCreatedPayment.id,
    });

    const transactionState: TransactionState = isBelowSuccessStateThreshold
      ? TRANSACTION_STATE_SUCCESS
      : TRANSACTION_STATE_FAILURE;

    const pspReference = randomUUID().toString();

    await this.ctPaymentService.updatePayment({
      id: newlyCreatedPayment.id,
      pspReference: pspReference,
      transaction: {
        amount: amountPlanned,
        type: TRANSACTION_AUTHORIZATION_TYPE,
        state: transactionState,
        interactionId: pspReference, 
      },
    });

    if (isBelowSuccessStateThreshold) {
      return {
        transactionStatus: {
          errors: [], 
          state: "Pending",
        },
      };
    } else {
      return {
        transactionStatus: {
          errors: [
            {
              code: "PaymentRejected",
              message: `Payment '${newlyCreatedPayment.id}' has been rejected.`,
            },
          ],
          state: "Failed",
        },
      };
    }
  }

  private convertPaymentResultCode(resultCode: PaymentOutcome): string {
    switch (resultCode) {
      case PaymentOutcome.AUTHORIZED:
        return "Success";
      case PaymentOutcome.REJECTED:
        return "Failure";
      default:
        return "Initial";
    }
  }


public async localcomments(
  hook: any,
  params: TransactionCommentParams
) {
  const supportedLocales: SupportedLocale[] = ["en", "de"];

  const normalized: Record<string, string> = {
    eventTID: params.eventTID ?? "-",
    parentTID: params.parentTID ?? "-",
    amount:
      params.amount !== null && params.amount !== undefined
        ? String(params.amount)
        : "-",
    currency: params.currency ?? "-",
    date: params.date ?? "-",
    time: params.time ?? "-",
    transactionID: params.transactionID ?? "-",
    dueDate: params.dueDate ?? "-",
  };

  const localizedTransactionComments = supportedLocales.reduce(
    (acc, locale) => {
      acc[locale] = t(locale, hook, normalized);
      return acc;
    },
    {} as Record<SupportedLocale, string>
  );

  return localizedTransactionComments;
}


  
}
