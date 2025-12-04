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
        }
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
	
    return {
      paymentReference: paymentRef,
    };
    }

public async updateTxComment(paymentId: string, txId: string, comment: string) {

  const raw = await this.ctPaymentService.getPayment({ id: paymentId } as any);
  const payment = (raw as any)?.body ?? raw;

  const ctClient = (this.ctPaymentService as any).client;
  const version = payment.version;

  return await ctClient.payments().withId({ ID: paymentId }).post({
    body: {
      version,
      actions: [
        {
          action: "setTransactionCustomField",
          transactionId: txId,
          name: "transactionComments",
          value: comment
        }
      ]
    }
  }).execute();
}

  /**
   * Safe helper: call ctPaymentService.updatePayment only when there are actions.
   * If actions is empty this returns a structured result and does not call CT.
   */
  public async safeUpdatePaymentWithActions(
    ctPaymentService: any,
    payload: { id: string; version?: number; actions?: any[] },
  ) {
    const actions = payload.actions ?? [];
    if (!Array.isArray(actions) || actions.length === 0) {
      // LOG with enough context for debugging — do NOT call CT with empty actions.
      console.info("safeUpdatePaymentWithActions: skipping update because actions empty", {
        paymentId: payload.id,
        providedVersion: payload.version,
      });
      return { ok: false, skipped: true, reason: "no_actions", actions: [] };
    }

    try {
      const resp = await ctPaymentService.updatePayment(payload as any);
      return { ok: true, resp };
    } catch (err: any) {
      return { ok: false, error: err, status: err?.statusCode ?? err?.status, body: err?.body ?? err?.response ?? null };
    }
  }

  /** Utility: update payment with actions (fetches version, retries once on 409) */
  public async updatePaymentWithActions(
    ctPaymentService: any,
    paymentId: string,
    actions: any[],
  ) {
    if (!Array.isArray(actions) || actions.length === 0) {
      throw new Error("No actions provided");
    }

    // fetch payment to get current version
    const raw = await ctPaymentService.getPayment({ id: paymentId } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment?.version;
    if (version === undefined) throw new Error("Missing payment.version");

    const payload = {
      id: paymentId,
      version,
      actions,
    };

    // try update once, on 409 retry once with refreshed version
    try {
      const resp = await ctPaymentService.updatePayment(payload as any);
      return { ok: true, resp };
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status;
      console.error("updatePayment failed (first attempt):", status, err?.body ?? err?.message ?? err);
      if (status === 409) {
        // refetch version and retry once
        const raw2 = await ctPaymentService.getPayment({ id: paymentId } as any);
        const payment2 = (raw2 as any)?.body ?? raw2;
        const version2 = payment2?.version;
        if (version2 === undefined) throw new Error("Missing payment.version on retry");
        payload.version = version2;
        try {
          const resp2 = await ctPaymentService.updatePayment(payload as any);
          return { ok: true, resp: resp2, retried: true };
        } catch (err2: any) {
          console.error("updatePayment failed (retry):", err2?.statusCode ?? err2?.status, err2?.body ?? err2?.message ?? err2);
          return { ok: false, error: err2, status: err2?.statusCode ?? err2?.status, body: err2?.body ?? err2?.response ?? null };
        }
      }
      return { ok: false, error: err, status, body: err?.body ?? err?.response ?? null };
    }
  }

  /** Attach transaction comments robustly
   * - finds transaction by interactionId (pspReference) or falls back to last transaction
   * - tries setTransactionCustomField, then setTransactionCustomType, then localized
   */
  public async attachTransactionComments(
    ctPaymentService: any,
    paymentId: string,
    pspReference: string,
    transactionComments: string,
  ) {
    // fetch payment
    const raw = await ctPaymentService.getPayment({ id: paymentId } as any);
    const payment = (raw as any)?.body ?? raw;
    if (!payment) throw new Error("Payment not found");

    const transactions: any[] = payment.transactions ?? [];
    if (!transactions.length) throw new Error("No transactions on payment");

    const targetTx = transactions.find((t: any) =>
      t.interactionId === pspReference || String(t.interactionId) === String(pspReference)
    ) ?? transactions[transactions.length - 1];

    if (!targetTx) throw new Error("Transaction not found");
    const txId = targetTx.id;
    if (!txId) throw new Error("Transaction id missing");

    // 1) try setTransactionCustomField (fast path)
    const actionsField = [
      {
        action: "setTransactionCustomField",
        transactionId: txId,
        name: "transactionComments",
        value: transactionComments,
      },
    ];

    console.info("Attempting setTransactionCustomField for txId:", txId);
    let fieldResult = await this.updatePaymentWithActions(ctPaymentService, paymentId, actionsField);
    if (fieldResult.ok) {
      console.info("setTransactionCustomField succeeded");
      return { ok: true, method: "setTransactionCustomField", resp: fieldResult.resp };
    }

    // If setTransactionCustomField failed due to ValidationError (type not present / wrong shape), try attaching type
    console.warn("setTransactionCustomField failed, will try setTransactionCustomType. error:", fieldResult.body ?? fieldResult.error);

    // 2) try setTransactionCustomType (attach type + fields)
    const actionsAttach = [
      {
        action: "setTransactionCustomType",
        transactionId: txId,
        type: { typeId: "type", key: "novalnet-transaction-comments" },
        fields: { transactionComments },
      },
    ];

    console.info("Attempting setTransactionCustomType for txId:", txId);
    let attachResult = await this.updatePaymentWithActions(ctPaymentService, paymentId, actionsAttach);
    if (attachResult.ok) {
      console.info("setTransactionCustomType succeeded");
      return { ok: true, method: "setTransactionCustomType", resp: attachResult.resp };
    }

    // 3) If attach failed due to field / localized shape, try localized string (common when field is LocalizedString)
    console.warn("setTransactionCustomType failed, trying localized shape. error:", attachResult.body ?? attachResult.error);

    if (typeof transactionComments === "string") {
      const actionsLocalized = [
        {
          action: "setTransactionCustomType",
          transactionId: txId,
          type: { typeId: "type", key: "novalnet-transaction-comments" },
          fields: { transactionComments: { en: transactionComments } }, // try english locale
        },
      ];
      console.info("Attempting setTransactionCustomType with localized transactionComments");
      const locResult = await this.updatePaymentWithActions(ctPaymentService, paymentId, actionsLocalized);
      if (locResult.ok) {
        console.info("setTransactionCustomType localized succeeded");
        return { ok: true, method: "setTransactionCustomType_localized", resp: locResult.resp };
      }
      console.error("setTransactionCustomType localized also failed:", locResult.body ?? locResult.error);
      return { ok: false, reason: "attach_localized_failed", body: locResult.body ?? locResult.error };
    }

    return { ok: false, reason: "all_attempts_failed", fieldError: fieldResult.body, attachError: attachResult.body };
  }

  /**
   * Attach the transaction custom type to the transaction with an empty transactionComments value.
   * This makes later setTransactionCustomField calls succeed (fast path).
   */
  public async attachEmptyTxCommentsType(paymentId: string, pspReference: string) {
    // fetch payment
    const raw = await this.ctPaymentService.getPayment({ id: paymentId } as any);
    const payment = (raw as any)?.body ?? raw;
    if (!payment) throw new Error("Payment not found in attachEmptyTxCommentsType");
    const transactions: any[] = payment.transactions ?? [];
    if (!transactions.length) throw new Error("No transactions on payment in attachEmptyTxCommentsType");

    // find tx by interactionId or fallback to last tx
    const tx = transactions.find((t: any) =>
      t.interactionId === pspReference || String(t.interactionId) === String(pspReference)
    ) ?? transactions[transactions.length - 1];

    if (!tx) throw new Error("Target transaction not found in attachEmptyTxCommentsType");
    const txId = tx.id;
    if (!txId) throw new Error("Transaction id missing in attachEmptyTxCommentsType");

    // Build attach action: setTransactionCustomType with an empty transactionComments field
    const actions = [
      {
        action: "setTransactionCustomType",
        transactionId: txId,
        type: { typeId: "type", key: "novalnet-transaction-comments" },
        fields: { transactionComments: "" }, // attach empty so field exists
      },
    ];

    // Use helper that fetches version and retries on 409
    const res = await this.updatePaymentWithActions(this.ctPaymentService, paymentId, actions);
    if (!res.ok) {
      // Try localized fallback if CT expects LocalizedString
      const actionsLocalized = [
        {
          action: "setTransactionCustomType",
          transactionId: txId,
          type: { typeId: "type", key: "novalnet-transaction-comments" },
          fields: { transactionComments: { en: "" } },
        },
      ];
      const r2 = await this.updatePaymentWithActions(this.ctPaymentService, paymentId, actionsLocalized);
      if (!r2.ok) {
        return { ok: false, reason: "attach_failed", body: res.body ?? r2.body ?? res.error ?? r2.error };
      }
      return { ok: true, method: "setTransactionCustomType_localized" };
    }

    return { ok: true, method: "setTransactionCustomType" };
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
        account_holder: String(request.data.paymentMethod.poNumber),
        iban: String(request.data.paymentMethod.invoiceMemo),
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

    const raw = await this.ctPaymentService.getPayment({ id: ctPayment.id } as any);
    const payment = (raw as any)?.body ?? raw;
    const version = payment.version;
    const updatedPayment = await projectApiRoot
    .payments()
    .withId({ ID: ctPayment.id })
    .post({
      body: {
        version,
        actions: [
          {
            action: "setStatusInterfaceCode",
            interfaceCode: String(statusCode)
          }
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


    // return payment id (ctPayment was created earlier; no inline/custom update)
    return {
      paymentReference: ctPayment.id,
    };
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
