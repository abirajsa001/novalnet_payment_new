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

import { SupportedPaymentComponentsSchemaDTO } from "../dtos/operations/payment-componets.dto";
import { PaymentModificationStatus } from "../dtos/operations/payment-intents.dto";
import packageJSON from "../../package.json";

import { AbstractPaymentService } from "./abstract-payment.service";
import { getConfig } from "../config/config";
import { appLogger, paymentSDK } from "../payment-sdk";
import {
  CreatePaymentRequest,
  MockPaymentServiceOptions,
} from "./types/mock-payment.type";
import {
  PaymentMethodType,
  PaymentOutcome,
  PaymentResponseSchemaDTO,

} from "../dtos/mock-payment.dto";
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

type NovalnetConfig = {
  testMode: string;
  paymentAction: string;
  dueDate: string;
};



function getNovalnetConfigValues(
  type: string,
  config: Record<string, any>,
): NovalnetConfig {
  const upperType = type.toUpperCase();
  return {
    testMode: String(config?.[`novalnet_${upperType}_TestMode`] ?? "0"),
    paymentAction: String(
      config?.[`novalnet_${upperType}_PaymentAction`] ?? "payment",
    ),
    dueDate: String(config?.[`novalnet_${upperType}_DueDate`] ?? "3"),
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

export class MockPaymentService extends AbstractPaymentService {
  constructor(opts: MockPaymentServiceOptions) {
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
        { type: PaymentMethodType.CARD },
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

  public async createPaymentt({ data }: { data: any }) {
    const parsedData = typeof data === "string" ? JSON.parse(data) : data;
    const config = getConfig();
    await createTransactionCommentsType();
    log.info("getMerchantReturnUrlFromContext from context:", getMerchantReturnUrlFromContext());
    const merchantReturnUrl = getMerchantReturnUrlFromContext() || config.merchantReturnUrl;

    const novalnetPayload = {
      transaction: {
        tid: parsedData?.interfaceId ?? "",
      },
    };

    let responseData: any;
    try {
      const novalnetResponse = await fetch(
        "https://payport.novalnet.de/v2/transaction/details",
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

      if (!novalnetResponse.ok) {
        throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
      }

      responseData = await novalnetResponse.json();
    } catch (error) {
      log.error("Failed to fetch transaction details from Novalnet:", error);
      throw new Error("Payment verification failed");
    }
    const paymentRef = responseData?.custom?.paymentRef ?? "";
    const pspReference = parsedData?.pspReference;
    const transactionComments = `Novalnet Transaction ID: ${responseData?.transaction?.tid ?? "N/A"}\nPayment Type: ${responseData?.transaction?.payment_type ?? "N/A"}\nStatus: ${responseData?.result?.status ?? "N/A"}`;

    
    log.info("Payment created with Novalnet details for redirect:");
    log.info("Payment transactionComments for redirect:", transactionComments);
    log.info("ctPayment id for redirect:", parsedData?.ctPaymentId);
    log.info("psp reference for redirect:", pspReference);
  
    const payment = await this.ctPaymentService.getPayment({ id: parsedData.ctPaymentId } as any);
    const version = (payment as any).version ?? (payment as any).body?.version;
    
    // pick the transactionId (find the transaction by interactionId or index)
    const tx = (payment as any).transactions?.find((t: any) => t.interactionId === pspReference);
    if (!tx) throw new Error('transaction not found');
    
    await this.ctPaymentService.updatePayment({
      id: parsedData.ctPaymentId,
      version,
      actions: [
        {
          action: 'setTransactionCustomField',
          transactionId: tx.id,          // required: selects transaction to update
          name: 'transactionComments',
          value: transactionComments,
        },
      ],
    } as any);

    return {
      paymentReference: paymentRef,
    };
  }
  
  public async createPayment(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponseSchemaDTO> {
    const type = String(request.data?.paymentMethod?.type ?? "INVOICE");
    const config = getConfig();
    const { testMode, paymentAction, dueDate } = getNovalnetConfigValues(
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

    const transaction: Record<string, any> = {
      test_mode: testMode === "1" ? "1" : "0",
      payment_type: String(request.data.paymentMethod.type),
      amount: String(parsedCart?.taxedPrice?.totalGross?.centAmount ?? "0"),
      currency: String(
        parsedCart?.taxedPrice?.totalGross?.currencyCode ?? "EUR",
      ),
    };

    if (dueDateValue) {
      transaction.due_date = dueDateValue;
    }

    if (
      String(request.data.paymentMethod.type).toUpperCase() ===
      "DIRECT_DEBIT_SEPA"
    ) {
      transaction.create_token = 1;
      transaction.payment_data = {
        account_holder: String(
          request.data.paymentMethod.poNumber ?? "Norbert Maier",
        ),
        iban: String(
          request.data.paymentMethod.invoiceMemo ?? "DE24300209002411761956",
        ),
      };
    }

    if (
      String(request.data.paymentMethod.type).toUpperCase() ===
      "DIRECT_DEBIT_ACH"
    ) {
      transaction.create_token = 1;
      transaction.payment_data = {
        account_holder: String(
          request.data.paymentMethod.accHolder ?? "Norbert Maier",
        ),
        account_number: String(
          request.data.paymentMethod.poNumber ?? "123456789",
        ),
        routing_number: String(
          request.data.paymentMethod.invoiceMemo ?? "031200730",
        ),
      };
    }
    
    if (
      String(request.data.paymentMethod.type).toUpperCase() === "CREDITCARD"
    ) {
      transaction.payment_data = {
        pan_hash: String(request.data.paymentMethod.panHash ?? ""),
        unique_id: String(request.data.paymentMethod.uniqueId ?? ""),
      };
    }

    const novalnetPayload = {
      merchant: {
        signature: String(getConfig()?.novalnetPrivateKey ?? ""),
        tariff: String(getConfig()?.novalnetTariff ?? ""),
      },
      customer: {
        billing: {
          city: String(billingAddress?.city ?? "demo"),
          country_code: String(billingAddress?.country ?? "US"),
          house_no: String(billingAddress?.streetName ?? "10"),
          street: String(billingAddress?.streetName ?? "teststreet"),
          zip: String(billingAddress?.postalCode ?? "12345"),
        },
        shipping: {
          city: String(deliveryAddress?.city ?? "demoshipping"),
          country_code: String(deliveryAddress?.country ?? "US"),
          house_no: String(deliveryAddress?.streetName ?? "11"),
          street: String(deliveryAddress?.streetName ?? "testshippingstreet"),
          zip: String(deliveryAddress?.postalCode ?? "12345"),
        },
        first_name: "Max",
        last_name: "Mustermann",
        email: "abiraj_s@novalnetsolutions.com",
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
        input3: "customerEmail",
        inputval3: String(parsedCart.customerEmail ?? "Email not available"),
        input4: "Payment-Method",
        inputval4: String(
          request.data.paymentMethod.type ?? "Payment-Method not available",
        ),
        input5: "TestMode",
        inputval5: String(testMode ?? "0"),
      },
    };

    const url =
      paymentAction === "payment"
        ? "https://payport.novalnet.de/v2/payment"
        : "https://payport.novalnet.de/v2/authorize";

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

    const transactiondetails = `Novalnet Transaction ID: ${parsedResponse?.transaction?.tid ?? "N/A"}\nTest Order`;

    let bankDetails = "";
    if (parsedResponse?.transaction?.bank_details) {
      bankDetails = `Please transfer the amount of ${parsedResponse.transaction.amount} to the following account.\nAccount holder: ${parsedResponse.transaction.bank_details.account_holder}\nIBAN: ${parsedResponse.transaction.bank_details.iban}\nBIC: ${parsedResponse.transaction.bank_details.bic}\nBANK NAME: ${parsedResponse.transaction.bank_details.bank_name}\nBANK PLACE: ${parsedResponse.transaction.bank_details.bank_place}\nPlease use the following payment reference for your money transfer:\nPayment Reference 1: ${parsedResponse.transaction.tid}`;
    }

    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned: await this.ctCartService.getPaymentAmount({
        cart: ctCart,
      }),
      paymentMethodInfo: {
        paymentInterface: getPaymentInterfaceFromContext() || "mock",
      },
      paymentStatus: {
        interfaceCode: JSON.stringify(parsedResponse),
        interfaceText: transactiondetails + "\n" + bankDetails,
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
    // Generate transaction comments
    const transactionComments = `Novalnet Transaction ID: ${parsedResponse?.transaction?.tid ?? "N/A"}\nPayment Type: ${parsedResponse?.transaction?.payment_type ?? "N/A"}\nStatus: ${parsedResponse?.result?.status ?? "N/A"}`;
    log.info("Payment created with Novalnet details for direct:");
    log.info("Payment transactionComments for direct:", transactionComments);
    log.info("ctPayment id for direct:", ctPayment.id);
    log.info("psp reference for direct:", pspReference);
    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference,
      paymentMethod: request.data.paymentMethod.type,
      transaction: {
        type: "Authorization",
        amount: ctPayment.amountPlanned,
        interactionId: pspReference,
        state: this.convertPaymentResultCode(request.data.paymentOutcome),
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
    });
  
    return {
      paymentReference: updatedPayment.id,
    };
  }

  public async createPayments(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponseSchemaDTO> {
    log.info("=== IDEAL PAYMENT START ===");
    log.info("Request data:", JSON.stringify(request.data, null, 2));
    const type = String(request.data?.paymentMethod?.type ?? "INVOICE");
    log.info("Payment type:", type);
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
    const payment = await this.ctPaymentService.getPayment({ id: parsedData.ctPaymentId } as any);
    const version = (payment as any).version ?? (payment as any).body?.version;

    const pspReference = randomUUID().toString();
    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      version,
      pspReference,
      paymentMethod: request.data.paymentMethod.type,
      transaction: {
        type: "Authorization",
        amount: ctPayment.amountPlanned,
        interactionId: pspReference,
        state: this.convertPaymentResultCode(request.data.paymentOutcome),
        custom: {
          type: {
            typeId: "type",
            key: "novalnet-transaction-comments",
          },
          fields: {
            pspReference,
          },
        },
      } as unknown as any,
    }as any);

    const paymentRef    = updatedPayment.id;
    const paymentCartId = ctCart.id;
    const orderNumber   = getFutureOrderNumberFromContext() ?? "";
    const ctPaymentId   = ctPayment.id;


    const url = new URL("/success", processorURL);
    url.searchParams.append("paymentReference", paymentRef);
    url.searchParams.append("ctsid", sessionId);
    url.searchParams.append("orderNumber", orderNumber);
    url.searchParams.append("ctPaymentID", ctPaymentId);
    url.searchParams.append("pspReference", pspReference);
    const returnUrl = url.toString();
    
    const ReturnurlContext = getMerchantReturnUrlFromContext();
    const novalnetPayload = {
      merchant: {
        signature: String(getConfig()?.novalnetPrivateKey ?? ""),
        tariff: String(getConfig()?.novalnetTariff ?? ""),
      },
      customer: {
        billing: {
          city: String(billingAddress?.city ?? "demo"),
          country_code: String(billingAddress?.country ?? "US"),
          house_no: String(billingAddress?.streetName ?? "10"),
          street: String(billingAddress?.streetName ?? "teststreet"),
          zip: String(billingAddress?.postalCode ?? "12345"),
        },
        shipping: {
          city: String(deliveryAddress?.city ?? "demoshipping"),
          country_code: String(deliveryAddress?.country ?? "US"),
          house_no: String(deliveryAddress?.streetName ?? "11"),
          street: String(deliveryAddress?.streetName ?? "testshippingstreet"),
          zip: String(deliveryAddress?.postalCode ?? "12345"),
        },
        first_name: "Max",
        last_name: "Mustermann",
        email: "abiraj_s@novalnetsolutions.com",
      },
      transaction: {
        test_mode: testMode === "1" ? "1" : "0",
        payment_type: type.toUpperCase(),
        amount: String(parsedCart?.taxedPrice?.totalGross?.centAmount ?? "100"),
        currency: String(parsedCart?.taxedPrice?.totalGross?.currencyCode ?? "EUR"),
        return_url: returnUrl,
        error_return_url: returnUrl,
        create_token: 1,
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
        input3: "currencyCode",
        inputval3: String(parsedCart?.taxedPrice?.totalGross?.currencyCode ?? "EUR"),
        input4: "customerEmail",
        inputval4: String(parsedCart.customerEmail ?? "Email not available"),
        input5: "getFutureOrderNumberFromContext",
        inputval5: String(orderNumber ?? "getFutureOrderNumberFromContext"),
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
}
