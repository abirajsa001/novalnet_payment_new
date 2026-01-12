"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovalnetPaymentService = void 0;
const connect_payments_sdk_1 = require("@commercetools/connect-payments-sdk");
const payment_intents_dto_1 = require("../dtos/operations/payment-intents.dto");
const package_json_1 = __importDefault(require("../../package.json"));
const abstract_payment_service_1 = require("./abstract-payment.service");
const config_1 = require("../config/config");
const payment_sdk_1 = require("../payment-sdk");
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("dns/promises"));
const novalnet_payment_dto_1 = require("../dtos/novalnet-payment.dto");
const context_1 = require("../libs/fastify/context/context");
const crypto_2 = require("crypto");
const logger_1 = require("../libs/logger");
const Context = __importStar(require("../libs/fastify/context/context"));
const custom_fields_1 = require("../utils/custom-fields");
const ct_client_1 = require("../utils/ct-client");
const ct_custom_object_service_1 = __importDefault(require("./ct-custom-object.service"));
function getNovalnetConfigValues(type, config) {
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
function getPaymentDueDate(configuredDueDate) {
    const days = Number(configuredDueDate);
    if (isNaN(days)) {
        return null;
    }
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    const formattedDate = dueDate.toISOString().split("T")[0];
    return formattedDate;
}
class NovalnetPaymentService extends abstract_payment_service_1.AbstractPaymentService {
    constructor(opts) {
        super(opts.ctCartService, opts.ctPaymentService);
    }
    async config() {
        const config = (0, config_1.getConfig)();
        return {
            clientKey: config.mockClientKey,
            environment: config.mockEnvironment,
        };
    }
    async status() {
        const handler = await (0, connect_payments_sdk_1.statusHandler)({
            timeout: (0, config_1.getConfig)().healthCheckTimeout,
            log: payment_sdk_1.appLogger,
            checks: [
                (0, connect_payments_sdk_1.healthCheckCommercetoolsPermissions)({
                    requiredPermissions: [
                        "manage_payments",
                        "view_sessions",
                        "view_api_clients",
                        "manage_orders",
                        "introspect_oauth_tokens",
                        "manage_checkout_payment_intents",
                        "manage_types",
                    ],
                    ctAuthorizationService: payment_sdk_1.paymentSDK.ctAuthorizationService,
                    projectKey: (0, config_1.getConfig)().projectKey,
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
                    }
                    catch (e) {
                        return {
                            name: "Mock Payment API",
                            status: "DOWN",
                            message: "The mock payment API is down for some reason. Please check the logs for more details.",
                            details: {
                                error: e,
                            },
                        };
                    }
                },
            ],
            metadataFn: async () => ({
                name: package_json_1.default.name,
                description: package_json_1.default.description,
                "@commercetools/connect-payments-sdk": package_json_1.default.dependencies["@commercetools/connect-payments-sdk"],
            }),
        })();
        return handler.body;
    }
    async getSupportedPaymentComponents() {
        return {
            dropins: [],
            components: [
                { type: novalnet_payment_dto_1.PaymentMethodType.CARD },
                { type: novalnet_payment_dto_1.PaymentMethodType.INVOICE },
                { type: novalnet_payment_dto_1.PaymentMethodType.PREPAYMENT },
                { type: novalnet_payment_dto_1.PaymentMethodType.IDEAL },
                { type: novalnet_payment_dto_1.PaymentMethodType.PAYPAL },
                { type: novalnet_payment_dto_1.PaymentMethodType.ONLINE_BANK_TRANSFER },
                { type: novalnet_payment_dto_1.PaymentMethodType.ALIPAY },
                { type: novalnet_payment_dto_1.PaymentMethodType.BANCONTACT },
                { type: novalnet_payment_dto_1.PaymentMethodType.BLIK },
                { type: novalnet_payment_dto_1.PaymentMethodType.EPS },
                { type: novalnet_payment_dto_1.PaymentMethodType.MBWAY },
                { type: novalnet_payment_dto_1.PaymentMethodType.MULTIBANCO },
                { type: novalnet_payment_dto_1.PaymentMethodType.PAYCONIQ },
                { type: novalnet_payment_dto_1.PaymentMethodType.POSTFINANCE },
                { type: novalnet_payment_dto_1.PaymentMethodType.POSTFINANCE_CARD },
                { type: novalnet_payment_dto_1.PaymentMethodType.PRZELEWY24 },
                { type: novalnet_payment_dto_1.PaymentMethodType.TRUSTLY },
                { type: novalnet_payment_dto_1.PaymentMethodType.TWINT },
                { type: novalnet_payment_dto_1.PaymentMethodType.WECHATPAY },
                { type: novalnet_payment_dto_1.PaymentMethodType.SEPA },
                { type: novalnet_payment_dto_1.PaymentMethodType.ACH },
                { type: novalnet_payment_dto_1.PaymentMethodType.CREDITCARD },
            ],
        };
    }
    async capturePayment(request) {
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
            outcome: payment_intents_dto_1.PaymentModificationStatus.APPROVED,
            pspReference: request.payment.interfaceId,
        };
    }
    async cancelPayment(request) {
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
            outcome: payment_intents_dto_1.PaymentModificationStatus.APPROVED,
            pspReference: request.payment.interfaceId,
        };
    }
    async refundPayment(request) {
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
            outcome: payment_intents_dto_1.PaymentModificationStatus.APPROVED,
            pspReference: request.payment.interfaceId,
        };
    }
    async reversePayment(request) {
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
        throw new connect_payments_sdk_1.ErrorInvalidOperation("There is no successful payment transaction to reverse.");
    }
    async ctcc(cart) {
        const deliveryAddress = payment_sdk_1.paymentSDK.ctCartService.getOneShippingAddress({
            cart,
        });
        return deliveryAddress;
    }
    async ctbb(cart) {
        const billingAddress = cart.billingAddress;
        return billingAddress;
    }
    async customerDetails(customer) {
        return customer;
    }
    async failureResponse({ data }) {
        const parsedData = typeof data === "string" ? JSON.parse(data) : data;
        const config = (0, config_1.getConfig)();
        await (0, custom_fields_1.createTransactionCommentsType)();
        logger_1.log.info("Failure Response inserted");
        logger_1.log.info(parsedData.tid);
        logger_1.log.info(parsedData.status_text);
        logger_1.log.info(parsedData.payment_type);
        const raw = await this.ctPaymentService.getPayment({ id: parsedData.ctPaymentID });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === parsedData.pspReference);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const transactionComments = `Novalnet Transaction ID: ${parsedData.tid ?? "NN/A"}\nPayment Type: ${parsedData.payment_type ?? "NN/A"}\n${parsedData.status_text ?? "NN/A"}`;
        logger_1.log.info(txId);
        logger_1.log.info(parsedData.ctPaymentID);
        logger_1.log.info(transactionComments);
        const updatedPayment = await ct_client_1.projectApiRoot
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
    async getConfigValues({ data }) {
        try {
            const clientKey = String((0, config_1.getConfig)()?.novalnetClientkey ?? '');
            logger_1.log.info('getconfigValues function');
            logger_1.log.info(clientKey);
            return { paymentReference: clientKey };
        }
        catch (err) {
            logger_1.log.info('getConfigValues error', err);
            // return safe fallback so Merchant Center gets JSON
            return { paymentReference: '' };
        }
    }
    async getCustomerAddress(request) {
        logger_1.log.info("service-customer-address - start");
        // -----------------------------
        // 1) Validate cartId
        // -----------------------------
        const cartId = request.cartId;
        if (!cartId) {
            logger_1.log.warn("service-customer-address - missing cartId");
            return { paymentReference: "customAddress" };
        }
        // -----------------------------
        // 2) Fetch Cart
        // -----------------------------
        let ctCart;
        try {
            ctCart = await this.ctCartService.getCart({ id: cartId });
            logger_1.log.info("ctCart fetched", {
                id: ctCart.id,
                customerId: ctCart.customerId,
                anonymousId: ctCart.anonymousId,
            });
        }
        catch (err) {
            logger_1.log.error("Failed to fetch cart", err);
            return { paymentReference: "customAddress" };
        }
        // -----------------------------
        // 3) Always prefer CART addresses
        // -----------------------------
        let shippingAddress = ctCart.shippingAddress ?? null;
        let billingAddress = ctCart.billingAddress ?? null;
        // -----------------------------
        // 4) Prepare customer fields
        // -----------------------------
        let firstName = shippingAddress?.firstName ?? ctCart.customerFirstName ?? "";
        let lastName = shippingAddress?.lastName ?? ctCart.customerLastName ?? "";
        let email = ctCart.customerEmail ?? "";
        // -----------------------------
        // 5) If this is a logged-in customer, fetch missing fields from CT
        // -----------------------------
        if (ctCart.customerId) {
            try {
                const apiRoot = this.projectApiRoot ?? globalThis.projectApiRoot ?? ct_client_1.projectApiRoot;
                const customerRes = await apiRoot
                    .customers()
                    .withId({ ID: ctCart.customerId })
                    .get()
                    .execute();
                const ctCustomer = customerRes.body;
                // override only if missing
                if (!firstName)
                    firstName = ctCustomer.firstName ?? "";
                if (!lastName)
                    lastName = ctCustomer.lastName ?? "";
                if (!email)
                    email = ctCustomer.email ?? "";
                logger_1.log.info("Customer data fetched", {
                    id: ctCustomer.id,
                    email: ctCustomer.email,
                });
            }
            catch (err) {
                logger_1.log.warn("Failed to fetch customer data, using cart only", {
                    cartCustomerId: ctCart.customerId,
                    error: String(err),
                });
                // cart fallback already applied
            }
        }
        // -----------------------------
        // 6) Final Response
        // -----------------------------
        const result = {
            paymentReference: "customAddress",
            firstName,
            lastName,
            email,
            shippingAddress,
            billingAddress,
        };
        logger_1.log.info("service-customer-address - returning", {
            paymentReference: result.paymentReference,
            firstName,
            lastName,
            email,
            shippingAddressPresent: !!shippingAddress,
            billingAddressPresent: !!billingAddress,
        });
        return result;
    }
    async createPaymentt({ data }) {
        const parsedData = typeof data === "string" ? JSON.parse(data) : data;
        const config = (0, config_1.getConfig)();
        await (0, custom_fields_1.createTransactionCommentsType)();
        logger_1.log.info("getMerchantReturnUrlFromContext from context:", (0, context_1.getMerchantReturnUrlFromContext)());
        const merchantReturnUrl = (0, context_1.getMerchantReturnUrlFromContext)() || config.merchantReturnUrl;
        const novalnetPayload = {
            transaction: {
                tid: parsedData?.interfaceId ?? "",
            },
        };
        let responseData;
        try {
            const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
            const base64Key =  btoa(accessKey);
            const novalnetResponse = await fetch("https://payport.novalnet.de/v2/transaction/details", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-NN-Access-Key': base64Key,
                },
                body: JSON.stringify(novalnetPayload),
            });
            if (!novalnetResponse.ok) {
                throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
            }
            responseData = await novalnetResponse.json();
        }
        catch (error) {
            logger_1.log.error("Failed to fetch transaction details from Novalnet:", error);
            throw new Error("Payment verification failed");
        }
        const paymentRef = responseData?.custom?.paymentRef ?? "";
        const pspReference = parsedData?.pspReference;
        const testModeText = responseData?.transaction?.test_mode == 1 ? 'Test Order' : '';
        const status = responseData?.transaction?.status;
        const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled' : 'Failure';
        const transactionComments = `Novalnet Transaction ID: ${responseData?.transaction?.tid ?? "NN/A"}\nPayment Type: ${responseData?.transaction?.payment_type ?? "NN/A"}\n${testModeText ?? "NN/A"}`;
        const statusCode = responseData?.transaction?.status_code ?? '';
        logger_1.log.info("Payment created with Novalnet details for redirect:");
        logger_1.log.info("Payment transactionComments for redirect:", transactionComments);
        logger_1.log.info("ctPayment id for redirect:", parsedData?.ctPaymentId);
        logger_1.log.info("psp reference for redirect:", pspReference);
        const raw = await this.ctPaymentService.getPayment({ id: parsedData.ctPaymentId });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === parsedData.pspReference);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        logger_1.log.info(txId);
        logger_1.log.info(parsedData.ctPaymentId);
        logger_1.log.info(transactionComments);
        const updatedPayment = await ct_client_1.projectApiRoot
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
                        state: state,
                    },
                ],
            },
        })
            .execute();
        const comment = await this.getTransactionComment(parsedData.ctPaymentId, parsedData.pspReference);
        logger_1.log.info('comment-updated');
        logger_1.log.info(comment);
        logger_1.log.info('comment-updated-after');
        // inside your function
        try {
            const paymentIdValue = parsedData.ctPaymentId;
            const pspReferenceValue = parsedData.pspReference;
            const container = "nn-private-data";
            const key = `${paymentIdValue}-${pspReferenceValue}`;
            logger_1.log.info("Storing sensitive data under custom object key:", key);
            // upsert returns the SDK response for create/update (you can inspect if needed)
            const upsertResp = await ct_custom_object_service_1.default.upsert(container, key, {
                deviceId: "device-1234",
                riskScore: 42,
                orderNo: responseData?.transaction?.order_no ?? '',
                tid: responseData?.transaction?.tid ?? '',
                paymentMethod: responseData?.transaction?.payment_type ?? '',
                cMail: responseData?.customer?.email ?? '',
                status: responseData?.transaction?.status ?? '',
                totalAmount: responseData?.transaction?.amount ?? '',
                callbackAmount: 0,
                additionalInfo: {
                    comments: transactionComments ?? '',
                }
            });
            logger_1.log.info("CustomObject upsert done");
            // get returns the found object (or null). The object has .value
            const obj = await ct_custom_object_service_1.default.get(container, key);
            logger_1.log.info('Value are getted');
            logger_1.log.info(JSON.stringify(obj, null, 2) ?? 'noobjnull');
            if (!obj) {
                logger_1.log.warn("CustomObject missing after upsert (unexpected)", { container, key });
            }
            else {
                // obj.value contains the stored data
                const stored = obj.value;
                const maskedDeviceId = stored.deviceId ? `${stored.deviceId.slice(0, 6)}…` : undefined;
                logger_1.log.info("Stored custom object (masked):", {
                    container: obj.container,
                    key: obj.key,
                    version: obj.version,
                    deviceId: maskedDeviceId,
                    riskScore: stored.riskScore,
                });
                logger_1.log.info(stored.tid);
                logger_1.log.info(stored.status);
                logger_1.log.info(stored.cMail);
                logger_1.log.info(stored.additionalInfo.comments);
            }
        }
        catch (err) {
            logger_1.log.error("Error storing / reading CustomObject", { error: err.message ?? err });
            throw err; // or handle as appropriate
        }
        return {
            paymentReference: paymentRef,
        };
    }
    async createPayment(request) {
        const type = String(request.data?.paymentMethod?.type ?? "INVOICE");
        const config = (0, config_1.getConfig)();
        const { testMode, paymentAction, dueDate, minimumAmount, enforce3d, displayInline } = getNovalnetConfigValues(type, config);
        await (0, custom_fields_1.createTransactionCommentsType)();
        const ctCart = await this.ctCartService.getCart({
            id: (0, context_1.getCartIdFromContext)(),
        });
        const deliveryAddress = await this.ctcc(ctCart);
        const billingAddress = await this.ctbb(ctCart);
        const parsedCart = typeof ctCart === "string" ? JSON.parse(ctCart) : ctCart;
        const dueDateValue = getPaymentDueDate(dueDate);
        const transaction = {
            test_mode: testMode === "1" ? "1" : "0",
            payment_type: String(request.data.paymentMethod.type),
            amount: String(parsedCart?.taxedPrice?.totalGross?.centAmount ?? "0"),
            currency: String(parsedCart?.taxedPrice?.totalGross?.currencyCode ?? "EUR"),
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
                account_number: String(request.data.paymentMethod.accountNumber),
                routing_number: String(request.data.paymentMethod.routingNumber),
            };
        }
        if (String(request.data.paymentMethod.type).toUpperCase() === "CREDITCARD") {
            if (enforce3d == '1') {
                transaction.enforce_3d = 1;
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
                paymentInterface: (0, context_1.getPaymentInterfaceFromContext)() || "mock",
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
        const pspReference = (0, crypto_2.randomUUID)().toString();
        // 🔹 1) Prepare name variables
        let firstName = "";
        let lastName = "";
        // 🔹 2) If the cart is linked to a CT customer, fetch it directly from CT
        if (ctCart.customerId) {
            const customerRes = await ct_client_1.projectApiRoot
                .customers()
                .withId({ ID: ctCart.customerId })
                .get()
                .execute();
            const ctCustomer = customerRes.body;
            firstName = ctCustomer.firstName ?? "";
            lastName = ctCustomer.lastName ?? "";
        }
        else {
            // 🔹 3) Guest checkout → fallback to shipping address
            firstName = ctCart.shippingAddress?.firstName ?? "";
            lastName = ctCart.shippingAddress?.lastName ?? "";
        }
        const novalnetPayload = {
            merchant: {
                signature: String((0, config_1.getConfig)()?.novalnetPrivateKey ?? ""),
                tariff: String((0, config_1.getConfig)()?.novalnetTariff ?? ""),
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
                input1: "ctpayment-id",
                inputval1: String(ctPayment.id ?? "ctpayment-id not available"),
                input2: "pspReference",
                inputval2: String(pspReference ?? "0"),
            },
        };
        let paymentActionUrl = "payment";
        logger_1.log.info('paymentAction-url');
        logger_1.log.info(paymentAction);
        logger_1.log.info(paymentActionUrl);
        if (paymentAction === "authorize") {
            const orderTotal = String(parsedCart?.taxedPrice?.totalGross?.centAmount);
            logger_1.log.info('order-total');
            logger_1.log.info(orderTotal);
            logger_1.log.info('minimumAmount');
            logger_1.log.info(minimumAmount);
            paymentActionUrl = (orderTotal >= minimumAmount)
                ? "authorize"
                : "payment";
        }
        logger_1.log.info('paymentAction');
        logger_1.log.info(paymentAction);
        logger_1.log.info(paymentActionUrl);
        const url = paymentActionUrl === "payment"
            ? "https://payport.novalnet.de/v2/payment"
            : "https://payport.novalnet.de/v2/authorize";
        logger_1.log.info('url');
        logger_1.log.info(url);
        let responseString = "";
        let responseData;
        try {
            const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
            const base64Key =  btoa(accessKey);
            const novalnetResponse = await fetch(url, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-NN-Access-Key': base64Key,
                },
                body: JSON.stringify(novalnetPayload),
            });
            if (!novalnetResponse.ok) {
                throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
            }
            responseData = await novalnetResponse.json();
            responseString = JSON.stringify(responseData);
        }
        catch (err) {
            logger_1.log.error("Failed to process payment with Novalnet:", err);
            throw new Error("Payment processing failed");
        }
        const parsedResponse = JSON.parse(responseString);
        const statusCode = parsedResponse?.transaction?.status_code;
        const testModeText = parsedResponse?.transaction?.test_mode == 1 ? 'Test Order' : '';
        const status = parsedResponse?.transaction?.status;
        const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled' : 'Failure';
        const transactiondetails = `Novalnet Transaction ID: ${parsedResponse?.transaction?.tid ?? "NN/A"}\nPayment Type: ${parsedResponse?.transaction?.payment_type ?? "NN/A"}\n${testModeText ?? "NN/A"}`;
        let bankDetails = "";
        if (parsedResponse?.transaction?.bank_details) {
            bankDetails = `Please transfer the amount of ${parsedResponse.transaction.amount} to the following account.\nAccount holder: ${parsedResponse.transaction.bank_details.account_holder}\nIBAN: ${parsedResponse.transaction.bank_details.iban}\nBIC: ${parsedResponse.transaction.bank_details.bic}\nBANK NAME: ${parsedResponse.transaction.bank_details.bank_name}\nBANK PLACE: ${parsedResponse.transaction.bank_details.bank_place}\nPlease use the following payment reference for your money transfer:\nPayment Reference 1: ${parsedResponse.transaction.tid}`;
        }
        // Generate transaction comments
        const transactionComments = `${transactiondetails ?? "N/A"}\n${bankDetails ?? ""}`;
        logger_1.log.info("Payment created with Novalnet details for direct:");
        logger_1.log.info("Payment transactionComments for direct:", transactionComments);
        logger_1.log.info("ctPayment id for direct:", ctPayment.id);
        logger_1.log.info("psp reference for direct:", pspReference);
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
            },
        });
        const raw = await this.ctPaymentService.getPayment({ id: ctPayment.id });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === pspReference);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        const updatedPayment = await ct_client_1.projectApiRoot
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
        const comment = await this.getTransactionComment(ctPayment.id, pspReference);
        logger_1.log.info('comment-updated');
        logger_1.log.info(comment);
        logger_1.log.info('comment-updated-after');
        // inside your function
        try {
            const paymentIdValue = ctPayment.id;
            const container = "nn-private-data";
            const key = `${paymentIdValue}-${pspReference}`;
            logger_1.log.info("Storing sensitive data under custom object key:", key);
            // upsert returns the SDK response for create/update (you can inspect if needed)
            const upsertResp = await ct_custom_object_service_1.default.upsert(container, key, {
                deviceId: "device-1234",
                riskScore: 42,
                orderNo: parsedResponse?.transaction?.order_no ?? '',
                tid: parsedResponse?.transaction?.tid ?? '',
                paymentMethod: parsedResponse?.transaction?.payment_type ?? '',
                cMail: parsedResponse?.customer?.email ?? '',
                status: parsedResponse?.transaction?.status ?? '',
                totalAmount: parsedResponse?.transaction?.amount ?? '',
                callbackAmount: 0,
                additionalInfo: {
                    comments: transactionComments ?? '',
                }
            });
            logger_1.log.info("CustomObject upsert done");
            // get returns the found object (or null). The object has .value
            const obj = await ct_custom_object_service_1.default.get(container, key);
            logger_1.log.info('Value are getted');
            logger_1.log.info(JSON.stringify(obj, null, 2) ?? 'noobjnull');
            if (!obj) {
                logger_1.log.warn("CustomObject missing after upsert (unexpected)", { container, key });
            }
            else {
                // obj.value contains the stored data
                const stored = obj.value;
                // DON'T log raw sensitive data in production. Example: mask deviceId
                const maskedDeviceId = stored.deviceId ? `${stored.deviceId.slice(0, 6)}…` : undefined;
                logger_1.log.info("Stored custom object (masked):", {
                    container: obj.container,
                    key: obj.key,
                    version: obj.version,
                    deviceId: maskedDeviceId,
                    riskScore: stored.riskScore, // if non-sensitive you may log
                });
                logger_1.log.info(stored.tid);
                logger_1.log.info(stored.status);
                logger_1.log.info(stored.cMail);
                logger_1.log.info(stored.additionalInfo.comments);
                // If you really need the full payload for debugging (dev only), stringify carefully:
                // log.debug("Stored full payload (dev only):", JSON.stringify(stored, null, 2));
            }
        }
        catch (err) {
            logger_1.log.error("Error storing / reading CustomObject", { error: err.message ?? err });
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
    async createWebhook(webhookData, req) {
        if (!Array.isArray(webhookData) || webhookData.length === 0) {
            throw new Error('Invalid webhook payload');
        }
        const webhook = webhookData[0];
        logger_1.log.info('Webhook data received in service');
        logger_1.log.info('Event:', webhook?.event?.type);
        logger_1.log.info('Checksum:', webhook?.event?.checksum);
        // === VALIDATIONS (PHP equivalent)
        await this.validateRequiredParameters(webhook);
        await this.validateChecksum(webhook);
        if (req) {
            await this.validateIpAddress(req);
        }
        const eventType = webhook.event?.type;
        const status = webhook.result?.status;
        this.getOrderDetails(webhook);
        if (status !== 'SUCCESS') {
            logger_1.log.warn('Webhook status is not SUCCESS');
            return { message: 'Webhook ignored (non-success)' };
        }
        // === EVENT ROUTING
        switch (eventType) {
            case 'PAYMENT':
                await this.handlePayment(webhook);
                break;
            case 'TRANSACTION_CAPTURE':
                await this.handleTransactionCapture(webhook);
                break;
            case 'TRANSACTION_CANCEL':
                await this.handleTransactionCancel(webhook);
                break;
            case 'TRANSACTION_REFUND':
                await this.handleTransactionRefund(webhook);
                break;
            case 'TRANSACTION_UPDATE':
                await this.handleTransactionUpdate(webhook);
                break;
            case 'CREDIT':
                await this.handleCredit(webhook);
                break;
            case 'CHARGEBACK':
                await this.handleChargeback(webhook);
                break;
            case 'PAYMENT_REMINDER_1':
            case 'PAYMENT_REMINDER_2':
                await this.handlePaymentReminder(webhook);
                break;
            case 'SUBMISSION_TO_COLLECTION_AGENCY':
                await this.handleCollectionSubmission(webhook);
                break;
            default:
                logger_1.log.warn(`Unhandled Novalnet event type: ${eventType}`);
        }
        return {
            message: 'Webhook processed successfully',
            eventType,
        };
    }
    // ==================================================
    // EVENT HANDLERS
    // ==================================================
    async handlePayment(webhook) {
        const transactionComments = `Novalnet Transaction ID: ${"NN/AA"}\nPayment Type: ${"NN/AA"}\nStatus: ${"NN/AA"}`;
        logger_1.log.info("handle payment update");
        const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval1 });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === webhook.custom.inputval2);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const existingComments = tx.custom?.fields?.transactionComments ?? '';
        const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
        logger_1.log.info(txId);
        logger_1.log.info(webhook.custom.inputval1);
        logger_1.log.info(transactionComments);
        const statusCode = webhook?.transaction?.status_code ?? '';
        const updatedPayment = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: webhook.custom.inputval1 })
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
        logger_1.log.info('PAYMENT event', {
            tid: webhook.event.tid,
        });
    }
    async handleTransactionCapture(webhook) {
        const { date, time } = await this.getFormattedDateTime();
        const transactionComments = `The transaction has been confirmed on ${date} at ${time}`;
        const status = webhook?.transaction?.status;
        const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled' : 'Failure';
        logger_1.log.info("handle payment update");
        const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval1 });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === webhook.custom.inputval2);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const existingComments = tx.custom?.fields?.transactionComments ?? '';
        const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
        logger_1.log.info(txId);
        logger_1.log.info(webhook.custom.inputval1);
        logger_1.log.info(transactionComments);
        const statusCode = webhook?.transaction?.status_code ?? '';
        const updatedPayment = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: webhook.custom.inputval1 })
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
        logger_1.log.info('PAYMENT event', {
            tid: webhook.event.tid,
        });
    }
    async handleTransactionCancel(webhook) {
        const { date, time } = await this.getFormattedDateTime();
        const transactionComments = `The transaction has been cancelled on ${date} at ${time}`;
        logger_1.log.info("handle payment update");
        const status = webhook?.transaction?.status;
        const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled' : 'Failure';
        const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval1 });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === webhook.custom.inputval2);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const existingComments = tx.custom?.fields?.transactionComments ?? '';
        const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
        logger_1.log.info(txId);
        logger_1.log.info(webhook.custom.inputval1);
        logger_1.log.info(transactionComments);
        const statusCode = webhook?.transaction?.status_code ?? '';
        const updatedPayment = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: webhook.custom.inputval1 })
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
        logger_1.log.info('PAYMENT event', {
            tid: webhook.event.tid,
        });
    }
    async handleTransactionRefund(webhook) {
        logger_1.log.info('TRANSACTION_REFUND', webhook.transaction.refund);
        const eventTID = webhook.event.tid;
        const parentTID = webhook.event.parent_tid ?? eventTID;
        const amount = webhook.transaction.amount / 100;
        const currency = webhook.transaction.currency;
        const { date, time } = await this.getFormattedDateTime();
        const refundedAmount = webhook.transaction.refund.amount;
        const refundTID = webhook.transaction.refund.tid ?? '';
        const transactionComments = refundTID
            ? `Refund has been initiated for the TID: ${eventTID} with the amount ${refundedAmount} ${currency}. New TID: ${refundTID} for the refunded amount.`
            : `Refund has been initiated for the TID: ${eventTID} with the amount ${refundedAmount} ${currency}.`;
        logger_1.log.info("handle transaction refund");
        const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval1 });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === webhook.custom.inputval2);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const existingComments = tx.custom?.fields?.transactionComments ?? '';
        const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
        logger_1.log.info(txId);
        logger_1.log.info(webhook.custom.inputval1);
        logger_1.log.info(transactionComments);
        const statusCode = webhook?.transaction?.status_code ?? '';
        const status = webhook?.transaction?.status;
        const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled' : 'Failure';
        const updatedPayment = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: webhook.custom.inputval1 })
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
    }
    async handleTransactionUpdate(webhook) {
        const orderDetails = await this.getOrderDetails(webhook);
        logger_1.log.info('TRANSACTION_UPDATE');
        logger_1.log.info(orderDetails.tid);
        let transactionComments = '';
        let { date, time } = await this.getFormattedDateTime();
        if (['DUE_DATE', 'AMOUNT', 'AMOUNT_DUE_DATE'].includes(webhook.transaction.update_type)) {
            const eventTID = webhook.event.tid;
            const amount = webhook.transaction.amount / 100;
            const currency = webhook.transaction.currency;
            transactionComments = `Transaction updated successfully for the TID: ${eventTID} with amount ${amount}${currency}.`;
            if (webhook.transaction.due_date) {
                const dueDate = webhook.transaction.due_date;
                transactionComments = `Transaction updated successfully for the TID: ${eventTID} with amount ${amount}${currency} and due date ${dueDate}.`;
            }
        }
        if (orderDetails.status != webhook.transaction.status && ['PENDING', 'ON_HOLD'].includes(orderDetails.status)) {
            const eventTID = webhook.event.tid;
            const amount = webhook.transaction.amount / 100;
            const currency = webhook.transaction.currency;
            if (webhook.transaction.status === 'CONFIRMED') {
                transactionComments = `The transaction status has been changed from pending to completed for the TID: ${eventTID} on ${date}${time}.`;
            }
            else if (webhook.transaction.status === 'ON_HOLD') {
                transactionComments = `The transaction status has been changed from on-hold to completed for the TID: ${eventTID} on ${date}${time}.`;
            }
            else {
                transactionComments = `The transaction has been canceled on ${date}${time}.`;
            }
            if (['ON_HOLD', 'CONFIRMED'].includes(webhook.transaction.status)) {
                logger_1.log.info('Need to add transaction Note');
            }
        }
        else if (orderDetails.status === 'ON_HOLD') {
            if (webhook.transaction.status === 'CONFIRMED') {
                transactionComments = `The transaction has been confirmed on ${date} at ${time}`;
            }
            else {
                transactionComments = `The transaction has been canceled on ${date} at ${time}`;
            }
        }
        logger_1.log.info("handle transaction update");
        const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval1 });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === webhook.custom.inputval2);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const existingComments = tx.custom?.fields?.transactionComments ?? '';
        const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
        logger_1.log.info(txId);
        logger_1.log.info(webhook.custom.inputval1);
        logger_1.log.info(transactionComments);
        const statusCode = webhook?.transaction?.status_code ?? '';
        const status = webhook?.transaction?.status;
        const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled' : 'Failure';
        const updatedPayment = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: webhook.custom.inputval1 })
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
    }
    async handleCredit(webhook) {
        const eventTID = webhook.event.tid;
        const transactionID = webhook.transaction.tid;
        const parentTID = webhook.event.parent_tid ?? eventTID;
        const amount = webhook.transaction.amount / 100;
        const currency = webhook.transaction.currency;
        const { date, time } = await this.getFormattedDateTime();
        const transactionComments = `Credit has been successfully received for the TID: ${parentTID} with amount ${amount}${currency} on  ${date}${time}. Please refer PAID order details in our Novalnet Admin Portal for the TID: ${transactionID}.`;
        logger_1.log.info('CREDIT');
        logger_1.log.info("handle transaction credit");
        const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval1 });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === webhook.custom.inputval2);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const existingComments = tx.custom?.fields?.transactionComments ?? '';
        const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
        logger_1.log.info(txId);
        logger_1.log.info(webhook.custom.inputval1);
        logger_1.log.info(transactionComments);
        const statusCode = webhook?.transaction?.status_code ?? '';
        const status = webhook?.transaction?.status;
        const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled' : 'Failure';
        const updatedPayment = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: webhook.custom.inputval1 })
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
    }
    async handleChargeback(webhook) {
        const { date, time } = await this.getFormattedDateTime();
        const transactionComments = `Novalnet Transaction ID: ${"NN/AA"}\nPayment Type: ${"NN/AA"}\nStatus: ${"NN/AA"}`;
        logger_1.log.info("handle chargeback");
        const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval1 });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === webhook.custom.inputval2);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const existingComments = tx.custom?.fields?.transactionComments ?? '';
        const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
        const status = webhook?.transaction?.status;
        const state = status === 'PENDING' || status === 'ON_HOLD' ? 'Pending' : status === 'CONFIRMED' ? 'Success' : status === 'CANCELLED' ? 'Canceled' : 'Failure';
        logger_1.log.info(txId);
        logger_1.log.info(webhook.custom.inputval1);
        logger_1.log.info(transactionComments);
        const statusCode = webhook?.transaction?.status_code ?? '';
        const updatedPayment = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: webhook.custom.inputval1 })
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
        logger_1.log.info('PAYMENT event', {
            tid: webhook.event.tid,
        });
    }
    async handlePaymentReminder(webhook) {
        const { date, time } = await this.getFormattedDateTime();
        const reminderIndex = webhook.event.type.split('_')[2];
        const transactionComments = `\n Payment Reminder ${reminderIndex} has been sent to the customer. `;
        logger_1.log.info("handle payment update");
        const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval1 });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === webhook.custom.inputval2);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const existingComments = tx.custom?.fields?.transactionComments ?? '';
        const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
        logger_1.log.info(txId);
        logger_1.log.info(webhook.custom.inputval1);
        logger_1.log.info(transactionComments);
        const statusCode = webhook?.transaction?.status_code ?? '';
        const updatedPayment = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: webhook.custom.inputval1 })
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
        logger_1.log.info('PAYMENT event', {
            tid: webhook.event.tid,
        });
    }
    async handleCollectionSubmission(webhook) {
        const collectionReference = webhook.collection.reference;
        const transactionComments = `The transaction has been submitted to the collection agency. Collection Reference: ${collectionReference}`;
        logger_1.log.info("handle payment update");
        const raw = await this.ctPaymentService.getPayment({ id: webhook.custom.inputval1 });
        const payment = raw?.body ?? raw;
        const version = payment.version;
        const tx = payment.transactions?.find((t) => t.interactionId === webhook.custom.inputval2);
        if (!tx)
            throw new Error("Transaction not found");
        const txId = tx.id;
        if (!txId)
            throw new Error('Transaction missing id');
        const existingComments = tx.custom?.fields?.transactionComments ?? '';
        const updatedTransactionComments = existingComments ? `${existingComments}\n\n---\n${transactionComments}` : transactionComments;
        logger_1.log.info(txId);
        logger_1.log.info(webhook.custom.inputval1);
        logger_1.log.info(transactionComments);
        const statusCode = webhook?.transaction?.status_code ?? '';
        const updatedPayment = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: webhook.custom.inputval1 })
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
        logger_1.log.info('PAYMENT event', {
            tid: webhook.event.tid,
        });
    }
    // ==================================================
    // VALIDATIONS (PHP equivalents)
    // ==================================================
    async validateRequiredParameters(payload) {
        const mandatory = {
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
    async validateIpAddress(req) {
        const novalnetHost = 'pay-nn.de';
        const { address: novalnetHostIP } = await promises_1.default.lookup(novalnetHost);
        if (!novalnetHostIP) {
            throw new Error('Novalnet HOST IP missing');
        }
        // 🔧 FIX IS HERE
        const requestReceivedIP = await this.getRemoteAddress(req, novalnetHostIP);
        logger_1.log.info('Novalnet Host IP:', novalnetHostIP);
        logger_1.log.info('Request IP:', requestReceivedIP);
        if (novalnetHostIP !== requestReceivedIP) {
            throw new Error(`Unauthorised access from the IP ${requestReceivedIP}`);
        }
    }
    /**
     * Equivalent of PHP getRemoteAddress()
     */
    async getRemoteAddress(req, novalnetHostIP) {
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
            const value = headers[key];
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
    validateChecksum(payload) {
        const accessKey = String((0, config_1.getConfig)()?.novalnetPublicKey ?? "");
        if (!accessKey) {
            logger_1.log.warn('NOVALNET_ACCESS_KEY not configured');
            return;
        }
        let token = payload.event.tid +
            payload.event.type +
            payload.result.status;
        if (payload.transaction?.amount) {
            token += payload.transaction.amount;
        }
        if (payload.transaction?.currency) {
            token += payload.transaction.currency;
        }
        token += accessKey.split('').reverse().join('');
        const generatedChecksum = crypto_1.default
            .createHash('sha256')
            .update(token)
            .digest('hex');
        if (generatedChecksum !== payload.event.checksum) {
            throw new Error('Checksum validation failed');
        }
    }
    async getOrderDetails(payload) {
        const paymentIdValue = payload.custom.inputval1;
        const pspReference = payload.custom.inputval2;
        const container = "nn-private-data";
        const key = `${paymentIdValue}-${pspReference}`;
        const obj = await ct_custom_object_service_1.default.get(container, key);
        logger_1.log.info('Value are getted');
        logger_1.log.info(JSON.stringify(obj, null, 2) ?? 'noobjnull');
        if (!obj) {
            logger_1.log.warn("CustomObject missing after upsert (unexpected)", { container, key });
        }
        else {
            // obj.value contains the stored data
            const stored = obj.value;
            const maskedDeviceId = stored.deviceId ? `${stored.deviceId.slice(0, 6)}…` : undefined;
            logger_1.log.info("Stored custom object (masked):", {
                container: obj.container,
                key: obj.key,
                version: obj.version,
                deviceId: maskedDeviceId,
                riskScore: stored.riskScore,
            });
            logger_1.log.info('stored-tid');
            logger_1.log.info(stored.tid);
            logger_1.log.info(stored.status);
            logger_1.log.info(stored.cMail);
            logger_1.log.info(stored.additionalInfo.comments);
            return stored;
        }
    }
    async updatePaymentStatusByPaymentId(paymentId, transactionId, newState) {
        const paymentRes = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: paymentId })
            .get()
            .execute();
        const payment = paymentRes.body;
        const updatedPayment = await ct_client_1.projectApiRoot
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
    async getTransactionComment(paymentId, pspReference) {
        // 1) Fetch payment from commercetools
        const response = await ct_client_1.projectApiRoot
            .payments()
            .withId({ ID: paymentId })
            .get()
            .execute();
        const payment = response.body;
        // 2) Find the transaction using interactionId (pspReference)
        const tx = payment.transactions?.find((t) => t.interactionId === pspReference ||
            String(t.interactionId) === String(pspReference));
        if (!tx)
            throw new Error("Transaction not found");
        // 3) If transaction has custom fields, extract the value
        const comment = tx.custom?.fields?.transactionComments ?? null;
        return comment;
    }
    async getFormattedDateTime() {
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
    async createRedirectPayment(request) {
        logger_1.log.info("Request data:", JSON.stringify(request.data, null, 2));
        const type = String(request.data?.paymentMethod?.type ?? "INVOICE");
        logger_1.log.info("Payment type:", type);
        logger_1.log.info((0, context_1.getFutureOrderNumberFromContext)());
        const config = (0, config_1.getConfig)();
        logger_1.log.info("Config loaded:", {
            hasPrivateKey: !!config.novalnetPrivateKey,
            hasTariff: !!config.novalnetTariff,
            privateKeyLength: config.novalnetPrivateKey?.length || 0
        });
        await (0, custom_fields_1.createTransactionCommentsType)();
        const { testMode, paymentAction } = getNovalnetConfigValues(type, config);
        logger_1.log.info("Novalnet config:", { testMode, paymentAction });
        const cartId = (0, context_1.getCartIdFromContext)();
        logger_1.log.info("Cart ID from context:", cartId);
        const ctCart = await this.ctCartService.getCart({
            id: cartId,
        });
        logger_1.log.info("Cart retrieved:", {
            id: ctCart.id,
            version: ctCart.version,
            customerId: ctCart.customerId,
            anonymousId: ctCart.anonymousId,
            customerEmail: ctCart.customerEmail
        });
        const deliveryAddress = await this.ctcc(ctCart);
        const billingAddress = await this.ctbb(ctCart);
        logger_1.log.info("Addresses:", {
            billing: billingAddress,
            delivery: deliveryAddress
        });
        const parsedCart = typeof ctCart === "string" ? JSON.parse(ctCart) : ctCart;
        logger_1.log.info("Cart amount:", {
            centAmount: parsedCart?.taxedPrice?.totalGross?.centAmount,
            currency: parsedCart?.taxedPrice?.totalGross?.currencyCode
        });
        const processorURL = Context.getProcessorUrlFromContext();
        const sessionId = Context.getCtSessionIdFromContext();
        logger_1.log.info("Context data:", {
            processorURL,
            sessionId
        });
        const paymentAmount = await this.ctCartService.getPaymentAmount({
            cart: ctCart,
        });
        logger_1.log.info("Payment amount calculated:", paymentAmount);
        const paymentInterface = (0, context_1.getPaymentInterfaceFromContext)() || "mock";
        logger_1.log.info("Payment interface:", paymentInterface);
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
        logger_1.log.info("CT Payment created:", {
            id: ctPayment.id,
            amountPlanned: ctPayment.amountPlanned
        });
        await this.ctCartService.addPayment({
            resource: { id: ctCart.id, version: ctCart.version },
            paymentId: ctPayment.id,
        });
        // Generate transaction comments
        const transactionComments = `Novalnet Transaction ID: ${"N/A"}\nPayment Type: ${"N/A"}\nStatus: ${"N/A"}`;
        const pspReference = (0, crypto_2.randomUUID)().toString();
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
            },
        });
        const paymentRef = updatedPayment?.id ?? ctPayment.id;
        const paymentCartId = ctCart.id;
        const orderNumber = (0, context_1.getFutureOrderNumberFromContext)() ?? "";
        const ctPaymentId = ctPayment.id;
        // 🔹 1) Prepare name variables
        let firstName = "";
        let lastName = "";
        // 🔹 2) If the cart is linked to a CT customer, fetch it directly from CT
        if (ctCart.customerId) {
            const customerRes = await ct_client_1.projectApiRoot
                .customers()
                .withId({ ID: ctCart.customerId })
                .get()
                .execute();
            const ctCustomer = customerRes.body;
            firstName = ctCustomer.firstName ?? "";
            lastName = ctCustomer.lastName ?? "";
        }
        else {
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
        const ReturnurlContext = (0, context_1.getMerchantReturnUrlFromContext)();
        const novalnetPayload = {
            merchant: {
                signature: String((0, config_1.getConfig)()?.novalnetPrivateKey ?? ""),
                tariff: String((0, config_1.getConfig)()?.novalnetTariff ?? ""),
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
            transaction: {
                test_mode: testMode === "1" ? "1" : "0",
                payment_type: type.toUpperCase(),
                amount: String(parsedCart?.taxedPrice?.totalGross?.centAmount),
                currency: String(parsedCart?.taxedPrice?.totalGross?.currencyCode),
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
                input1: "customerEmail",
                inputval1: String(parsedCart.customerEmail ?? "Email not available"),
                input2: "getFutureOrderNumberFromContext",
                inputval2: String(orderNumber ?? "getFutureOrderNumberFromContext"),
            },
        };
        logger_1.log.info("Full Novalnet payload:", JSON.stringify(novalnetPayload, null, 2));
        let parsedResponse = {};
        try {
            const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
            const base64Key =  btoa(accessKey);
            const novalnetResponse = await fetch("https://payport.novalnet.de/v2/seamless/payment", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-NN-Access-Key': base64Key,
                },
                body: JSON.stringify(novalnetPayload),
            });
            logger_1.log.info("Novalnet response status:", novalnetResponse.status);
            if (!novalnetResponse.ok) {
                throw new Error(`Novalnet API error: ${novalnetResponse.status}`);
            }
            parsedResponse = await novalnetResponse.json();
            logger_1.log.info("Novalnet response parsed:", JSON.stringify(parsedResponse, null, 2));
        }
        catch (err) {
            logger_1.log.error("Failed to process payment with Novalnet:", err);
            throw new Error("Payment initialization failed");
        }
        // Check for Novalnet API errors
        if (parsedResponse?.result?.status !== 'SUCCESS') {
            logger_1.log.error("Novalnet API error - Status not SUCCESS:", {
                status: parsedResponse?.result?.status,
                statusText: parsedResponse?.result?.status_text,
                fullResponse: parsedResponse
            });
            throw new Error(parsedResponse?.result?.status_text || "Payment initialization failed");
        }
        const redirectResult = parsedResponse?.result?.redirect_url;
        const txnSecret = parsedResponse?.transaction?.txn_secret;
        if (!txnSecret) {
            logger_1.log.error("No txn_secret in Novalnet response:", {
                transaction: parsedResponse?.transaction,
                fullResponse: parsedResponse
            });
            throw new Error("Payment initialization failed - missing transaction secret");
        }
        logger_1.log.info("=== IDEAL PAYMENT SUCCESS ===, returning txn_secret:", txnSecret);
        return {
            paymentReference: paymentRef,
            txnSecret: redirectResult,
        };
    }
    async handleTransaction(transactionDraft) {
        const TRANSACTION_AUTHORIZATION_TYPE = "Authorization";
        const TRANSACTION_STATE_SUCCESS = "Success";
        const TRANSACTION_STATE_FAILURE = "Failure";
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
        const isBelowSuccessStateThreshold = amountPlanned.centAmount < maxCentAmountIfSuccess;
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
        const transactionState = isBelowSuccessStateThreshold
            ? TRANSACTION_STATE_SUCCESS
            : TRANSACTION_STATE_FAILURE;
        const pspReference = (0, crypto_2.randomUUID)().toString();
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
        }
        else {
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
    convertPaymentResultCode(resultCode) {
        switch (resultCode) {
            case novalnet_payment_dto_1.PaymentOutcome.AUTHORIZED:
                return "Success";
            case novalnet_payment_dto_1.PaymentOutcome.REJECTED:
                return "Failure";
            default:
                return "Initial";
        }
    }
}
exports.NovalnetPaymentService = NovalnetPaymentService;
