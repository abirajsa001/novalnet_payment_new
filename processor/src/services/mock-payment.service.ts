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
import { projectApiRoot } from '../utils/ct-client';
import customObjectService from "./ct-custom-object.service";


type NovalnetConfig = {
  testMode: string;
  paymentAction: string;
  dueDate: string;
  minimumAmount: string;
  enforce3d: string;
  displayInline: string;
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
    const testModeText = responseData?.transaction?.test_mode == 1 ? 'Test Order' : '';
    const transactionComments = `Novalnet Transaction ID: ${responseData?.transaction?.tid ?? "NN/A"}\nPayment Type: ${responseData?.transaction?.payment_type ?? "NN/A"}\n${testModeText ?? "NN/A"}`;
    const statusCode = responseData?.transaction?.status_code ?? '';
    log.info("Payment created with Novalnet details for redirect:");
    log.info("Payment transactionComments for redirect:", transactionComments);
    log.info("ctPayment id for redirect:", parsedData?.ctPaymentId);
    log.info("psp reference for redirect:", pspReference);
	const raw = await this.ctPaymentService.getPayment({ id: parsedData.ctPaymentId } as any);
	const payment = (raw as any)?.body ?? raw;
  const version = payment.version;
	const tx = payment.transactions?.find((t: any) =>
	  t.interactionId === parsedData.pspReference
	);
	if (!tx) throw new Error("Transaction not found");
	const txId = tx.id;
	if (!txId) throw new Error('Transaction missing id');
	log.info(txId);
  log.info(parsedData.ctPaymentId);
  log.info(transactionComments);
  const updatedPayment = await projectApiRoot
  .payments()
  .withId({ ID: parsedData.ctPaymentId })
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
        {
          action: "setStatusInterfaceCode",
          interfaceCode: String(statusCode)
        },
        {
          action: 'changeTransactionState',
          transactionId: txId,
          state: 'Pending',
        },
      ],
    },
  })
  .execute();
  const comment = await this.getTransactionComment(
    parsedData.ctPaymentId,
    parsedData.pspReference
  );
  log.info('comment-updated');
  log.info(comment);
  log.info('comment-updated-after');
  
  	// inside your function
	try {
	  const paymentIdValue = parsedData.ctPaymentId;
	  const pspReferenceValue = parsedData.pspReference;
	  const container = "nn-private-data";
	  const key = `${paymentIdValue}-${pspReferenceValue}`;

	  log.info("Storing sensitive data under custom object key:", key);

	  // upsert returns the SDK response for create/update (you can inspect if needed)
	  const upsertResp = await customObjectService.upsert(container, key, {
		deviceId: "device-1234",
		riskScore: 42,
		orderNo: responseData?.transaction?.order_no ?? '',
		tid: responseData?.transaction?.tid ?? '',
		paymentMethod:  responseData?.transaction?.payment_type ?? '',
		cMail:  responseData?.customer?.email ?? '',
		status:  responseData?.transaction?.status ?? '',
		totalAmount: responseData?.transaction?.amount ?? '',
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
		const maskedDeviceId = stored.deviceId ? `${stored.deviceId.slice(0, 6)}…` : undefined;
		log.info("Stored custom object (masked):", {
		  container: obj.container,
		  key: obj.key,
		  version: obj.version,
		  deviceId: maskedDeviceId,
		  riskScore: stored.riskScore, 
		});
		log.info(stored.tid);
		log.info(stored.status);
		log.info(stored.cMail);
    log.info(stored.additionalInfo.comments);

	  }
	} catch (err) {
	  log.error("Error storing / reading CustomObject", { error: (err as any).message ?? err });
	  throw err; // or handle as appropriate
	}
	
    return {
      paymentReference: paymentRef,
    };
  }

  public async createPayment(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponseSchemaDTO> {
    const type = String(request.data?.paymentMethod?.type ?? "INVOICE");
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
        input3: "customerEmail",
        inputval3: String(parsedCart.customerEmail ?? "Email not available"),
        input4: "ctpayment-id",
        inputval4: String(
          ctPayment.id ?? "ctpayment-id not available",
        ),
        input5: "pspReference",
        inputval5: String(pspReference ?? "0"),
      },
    };

    let paymentActionUrl = "payment"; 
        
    if (paymentAction === "authorize") {
      const orderTotal = String(parsedCart?.taxedPrice?.totalGross?.centAmount);
      paymentActionUrl = (orderTotal >= minimumAmount)
        ? "authorize"
        : "payment";
    }
    
    const url =
      paymentActionUrl === "payment"
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
    const statusCode = parsedResponse?.transaction?.status_code;
    const testModeText = parsedResponse?.transaction?.test_mode == 1 ? 'Test Order' : '';
    const transactiondetails = `Novalnet Transaction ID: ${parsedResponse?.transaction?.tid ?? "NN/A"}\nPayment Type: ${parsedResponse?.transaction?.payment_type ?? "NN/A"}\n${testModeText ?? "NN/A"}`;

    let bankDetails = "";
    if (parsedResponse?.transaction?.bank_details) {
      bankDetails = `Please transfer the amount of ${parsedResponse.transaction.amount} to the following account.\nAccount holder: ${parsedResponse.transaction.bank_details.account_holder}\nIBAN: ${parsedResponse.transaction.bank_details.iban}\nBIC: ${parsedResponse.transaction.bank_details.bic}\nBANK NAME: ${parsedResponse.transaction.bank_details.bank_name}\nBANK PLACE: ${parsedResponse.transaction.bank_details.bank_place}\nPlease use the following payment reference for your money transfer:\nPayment Reference 1: ${parsedResponse.transaction.tid}`;
    }

    // Generate transaction comments
    const transactionComments = `${transactiondetails ?? "N/A"}\n${bankDetails ?? ""}`;
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
        state: "Pending",
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
  public async createWebhook(webhookData: any[]): Promise<any> {
    if (!Array.isArray(webhookData) || webhookData.length === 0) {
      throw new Error('Invalid webhook payload');
    }

    const webhook = webhookData[0];

    log.info('Webhook data received in service');
    log.info('Event:', webhook?.event?.type);
    log.info('Checksum:', webhook?.event?.checksum);

    // === VALIDATIONS (PHP equivalent)
    this.validateRequiredParameters(webhook);
    this.validateChecksum(webhook);

    const eventType = webhook.event?.type;
    const status = webhook.result?.status;

    if (status !== 'SUCCESS') {
      log.warn('Webhook status is not SUCCESS');
      return { message: 'Webhook ignored (non-success)' };
    }

    // === EVENT ROUTING
    switch (eventType) {
      case 'PAYMENT':
        this.handlePayment(webhook);
        break;

      case 'TRANSACTION_CAPTURE':
        this.handleTransactionCapture(webhook);
        break;

      case 'TRANSACTION_CANCEL':
        this.handleTransactionCancel(webhook);
        break;

      case 'TRANSACTION_REFUND':
        this.handleTransactionRefund(webhook);
        break;

      case 'TRANSACTION_UPDATE':
        this.handleTransactionUpdate(webhook);
        break;

      case 'CREDIT':
        this.handleCredit(webhook);
        break;

      case 'CHARGEBACK':
        this.handleChargeback(webhook);
        break;

      case 'INSTALMENT':
        this.handleInstalment(webhook);
        break;

      case 'INSTALMENT_CANCEL':
        this.handleInstalmentCancel(webhook);
        break;

      case 'PAYMENT_REMINDER_1':
      case 'PAYMENT_REMINDER_2':
        this.handlePaymentReminder(webhook);
        break;

      case 'SUBMISSION_TO_COLLECTION_AGENCY':
        this.handleCollectionSubmission(webhook);
        break;

      default:
        log.warn(`Unhandled Novalnet event type: ${eventType}`);
    }

    return {
      message: 'Webhook processed successfully',
      eventType,
    };
  }

  // ==================================================
  // EVENT HANDLERS
  // ==================================================

  private handlePayment(webhook: any) {
    log.info('PAYMENT event', {
      tid: webhook.event.tid,
    });
  }

  private handleTransactionCapture(webhook: any) {
    log.info('TRANSACTION_CAPTURE', {
      tid: webhook.transaction.tid,
      amount: webhook.transaction.amount,
    });
  }

  private handleTransactionCancel(webhook: any) {
    log.info('TRANSACTION_CANCEL', {
      tid: webhook.transaction.tid,
    });
  }

  private handleTransactionRefund(webhook: any) {
    log.info('TRANSACTION_REFUND', webhook.transaction.refund);
  }

  private handleTransactionUpdate(webhook: any) {
    log.info('TRANSACTION_UPDATE', webhook.transaction.update_type);
  }

  private handleCredit(webhook: any) {
    log.info('CREDIT', webhook.transaction.amount);
  }

  private handleChargeback(webhook: any) {
    log.info('CHARGEBACK', webhook.transaction.amount);
  }

  private handleInstalment(webhook: any) {
    log.info('INSTALMENT', webhook.instalment);
  }

  private handleInstalmentCancel(webhook: any) {
    log.info('INSTALMENT_CANCEL', webhook.instalment);
  }

  private handlePaymentReminder(webhook: any) {
    log.info('PAYMENT_REMINDER', webhook.event.type);
  }

  private handleCollectionSubmission(webhook: any) {
    log.info('COLLECTION_SUBMISSION', webhook.collection);
  }

  // ==================================================
  // VALIDATIONS (PHP equivalents)
  // ==================================================

  private validateRequiredParameters(payload: any) {
    const mandatory: Record<string, string[]> = {
      event: ['type', 'checksum', 'tid'],
      merchant: ['vendor', 'project'],
      result: ['status'],
      transaction: ['tid', 'payment_type', 'status'],
    };

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
  }

  private validateChecksum(payload: any) {
      const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
    if (!accessKey) {
      log.warn('NOVALNET_ACCESS_KEY not configured');
      return;
    }

    let token =
      payload.event.tid +
      payload.event.type +
      payload.result.status;

    if (payload.transaction?.amount) {
      token += payload.transaction.amount;
    }

    if (payload.transaction?.currency) {
      token += payload.transaction.currency;
    }

    token += accessKey.split('').reverse().join('');

    const generatedChecksum = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    if (generatedChecksum !== payload.event.checksum) {
      throw new Error('Checksum validation failed');
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
    const returnUrl = url.toString();
    
    const urlFailure = new URL("/failure", processorURL);
    urlFailure.searchParams.append("paymentReference", paymentRef);
    urlFailure.searchParams.append("ctsid", sessionId);
    urlFailure.searchParams.append("orderNumber", orderNumber);
    urlFailure.searchParams.append("ctPaymentID", ctPaymentId);
    urlFailure.searchParams.append("pspReference", pspReference);
    const errorReturnUrl = urlFailure.toString();

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
        first_name: firstName,
        last_name: lastName,
        email: parsedCart.customerEmail,
      },
      transaction: {
        test_mode: testMode === "1" ? "1" : "0",
        payment_type: type.toUpperCase(),
        amount: String(parsedCart?.taxedPrice?.totalGross?.centAmount ?? "100"),
        currency: String(parsedCart?.taxedPrice?.totalGross?.currencyCode ?? "EUR"),
        return_url: returnUrl,
        error_return_url: errorReturnUrl,
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

  // TEMP DEBUG helper — keep only while debugging
  public async debugUpdatePayment(payload: any, callerName = "unknown") {
    try {
      console.info("DEBUG updatePayment called by:", callerName, "payload.actions_length:", (payload.actions ?? []).length);
      if (Array.isArray(payload.actions) && payload.actions.length > 0) {
        console.info("DEBUG actions:", JSON.stringify(payload.actions, null, 2));
      }
      const res = await this.ctPaymentService.updatePayment(payload as any);
      console.info(`DEBUG updatePayment succeeded for ${callerName}`);
      return res;
    } catch (err: any) {
      console.error(`DEBUG updatePayment error for ${callerName}:`, err?.statusCode ?? err?.status, err?.body ?? err);
      throw err;
    }
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
