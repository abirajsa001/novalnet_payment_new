"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
const order_service_1 = require("../services/order.service");
const context_1 = require("../libs/fastify/context/context");
const crypto_1 = __importDefault(require("crypto"));
const novalnet_payment_dto_1 = require("../dtos/novalnet-payment.dto");
const logger_1 = require("../libs/logger");
const config_1 = require("../config/config");
const ct_client_1 = require("../utils/ct-client");
console.log("before-payment-routes");
logger_1.log.info("before-payment-routes");
const paymentRoutes = async (fastify, opts) => {
    fastify.post("/test", async (request, reply) => {
        console.log("Received payment request in processor");
        // Call Novalnet API server-side (no CORS issue)
        const novalnetPayload = {
            merchant: {
                signature: String((0, config_1.getConfig)()?.novalnetPrivateKey ?? ""),
                tariff: String((0, config_1.getConfig)()?.novalnetTariff ?? ""),
            },
            customer: {
                billing: {
                    city: "test",
                    country_code: "DE",
                    house_no: "test",
                    street: "test",
                    zip: "68662",
                },
                first_name: "Max",
                last_name: "Mustermann",
                email: "abiraj_s@novalnetsolutions.com",
            },
            transaction: {
                test_mode: "1",
                payment_type: "PREPAYMENT",
                amount: 10,
                currency: "EUR",
            },
            custom: {
                input1: "request",
                inputval1: String(request ?? "empty"),
                input2: "reply",
                inputval2: String(reply ?? "empty"),
            },
        };
        const novalnetResponse = await fetch("https://payport.novalnet.de/v2/payment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-NN-Access-Key": String((0, config_1.getConfig)()?.novalnetPrivateKey ?? ""),
            },
            body: JSON.stringify(novalnetPayload),
        });
        console.log("handle-novalnetResponse");
        console.log(novalnetResponse);
    });
    fastify.post("/payments", {
        preHandler: [opts.sessionHeaderAuthHook.authenticate()],
        schema: {
            body: novalnet_payment_dto_1.PaymentRequestSchema,
            response: {
                200: novalnet_payment_dto_1.PaymentResponseSchema,
            },
        },
    }, async (request, reply) => {
        logger_1.log.info("=== PAYMENT ROUTE /payments CALLEDS ===");
        logger_1.log.info("Request body:", JSON.stringify(request.body, null, 2));
        logger_1.log.info("Request headers:", request.headers);
        try {
            const resp = await opts.paymentService.createPayments({
                data: request.body,
            });
            logger_1.log.info("Payment service response:", JSON.stringify(resp, null, 2));
            return reply.status(200).send(resp);
        }
        catch (error) {
            logger_1.log.error("Payment route error:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.log.error("Error details:", {
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : undefined
            });
            return reply.status(500).send({ paymentReference: 'error' });
        }
    });
    fastify.post("/payment", {
        preHandler: [opts.sessionHeaderAuthHook.authenticate()],
        schema: {
            body: novalnet_payment_dto_1.PaymentRequestSchema,
            response: {
                200: novalnet_payment_dto_1.PaymentResponseSchema,
            },
        },
    }, async (request, reply) => {
        const resp = await opts.paymentService.createPayment({
            data: request.body,
        });
        if (resp?.transactionStatus == 'FAILURE') {
            const baseUrl = "https://poc-novalnetpayments.frontend.site/checkout";
            return reply.code(302).redirect(baseUrl);
        }
        return reply.status(200).send(resp);
    });
    fastify.post('/getconfig', async (req, reply) => {
        // safe retrieval of client key
        const clientKey = String((0, config_1.getConfig)()?.novalnetClientkey ?? '');
        // send a JSON object matching expected shape
        // Fastify will set Content-Type: application/json automatically for objects
        return reply.code(200).send({ paymentReference: clientKey });
    });
    fastify.post('/getCustomerAddress', async (req, reply) => {
        logger_1.log.info('route-customer-address');
        logger_1.log.info("getCartIdFromContext():");
        logger_1.log.info((0, context_1.getCartIdFromContext)());
        const carts = await ct_client_1.projectApiRoot.carts().get().execute();
        logger_1.log.info("CART LIST:", carts.body.results);
        logger_1.log.info(carts.body.results[0]?.id ?? 'empty1');
        const cartId = carts.body.results[0]?.id ?? 'empty1';
        // req.body is typed as PaymentRequestSchemaDTO now
        const resp = await opts.paymentService.getCustomerAddress({
            data: req.body,
            cartId,
        });
        return reply.code(200).send(resp);
    });
    fastify.get("/success", async (request, reply) => {
        const query = request.query;
        const accessKey = String((0, config_1.getConfig)()?.novalnetPublicKey ?? "");
        const reverseKey = accessKey.split("").reverse().join("");
        if (query.tid && query.status && query.checksum && query.txn_secret) {
            const tokenString = `${query.tid}${query.txn_secret}${query.status}${reverseKey}`;
            const orderNumber = query.orderNumber;
            if (!orderNumber) {
                return reply.code(400).send('Missing orderNumber');
            }
            logger_1.log.info(orderNumber + 'orderNumber');
            const generatedChecksum = crypto_1.default
                .createHash("sha256")
                .update(tokenString)
                .digest("hex");
            if (generatedChecksum === query.checksum) {
                try {
                    const requestData = {
                        interfaceId: query.tid,
                        ctId: query.ctsid,
                        ctPaymentId: query.ctPaymentID,
                        pspReference: query.pspReference,
                    };
                    // Convert to JSON string
                    const jsonBody = JSON.stringify(requestData);
                    const result = await opts.paymentService.createPaymentt({
                        data: jsonBody, // send JSON string
                    });
                    const orderId = await (0, order_service_1.getOrderIdFromOrderNumber)(orderNumber);
                    if (!orderId)
                        return reply.code(404).send('Order not found');
                    const thirdPartyUrl = 'https://poc-novalnetpayments.frontend.site/en/thank-you/?orderId=' + orderId;
                    //const thirdPartyUrl = 'https://poc-novalnetpayments.frontend.site/en/thank-you/';
                    return reply.code(302).redirect(thirdPartyUrl);
                }
                catch (error) {
                    logger_1.log.error("Error processing payment:", error);
                    return reply.code(400).send("Payment processing failed");
                }
            }
            else {
                logger_1.log.error("Checksum verification failed", { expected: generatedChecksum, received: query.checksum });
                return reply.code(400).send('Checksum verification failed.');
            }
        }
        else {
            return reply.code(400).send("Missing required query parameters.");
        }
    });
    fastify.get("/failure", async (request, reply) => {
        const query = request.query;
        const baseUrl = "https://poc-novalnetpayments.frontend.site/checkout";
        const redirectUrl = new URL(baseUrl);
        if (query.paymentReference) {
            redirectUrl.searchParams.set("paymentReference", query.paymentReference);
        }
        if (query.ctsid) {
            redirectUrl.searchParams.set("ctsid", query.ctsid);
        }
        if (query.orderNumber) {
            redirectUrl.searchParams.set("orderNumber", query.orderNumber);
        }
        if (query.ctPaymentID) {
            redirectUrl.searchParams.set("ctPaymentID", query.ctPaymentID);
        }
        if (query.pspReference) {
            redirectUrl.searchParams.set("pspReference", query.pspReference);
        }
        try {
            const requestData = {
                paymentReference: query.paymentReference,
                ctsid: query.ctsid,
                orderNumber: query.orderNumber,
                ctPaymentID: query.ctPaymentID,
                pspReference: query.pspReference,
                tid: query.tid ?? 'empty-tid',
                status_text: query.status_text ?? 'empty-status-text',
                payment_type: query.payment_type ?? 'empty-payment-type',
            };
            // Convert to JSON string
            const jsonBody = JSON.stringify(requestData);
            const result = await opts.paymentService.failureResponse({
                data: jsonBody, // send JSON string
            });
            return reply.code(302).redirect(redirectUrl.toString());
        }
        catch (error) {
            logger_1.log.error("Error processing payment:", error);
            return reply.code(400).send("Payment processing failed");
        }
    });
    fastify.get("/callback", async (request, reply) => {
        return reply.send("sucess");
    });
    fastify.post('/webhook', async (req, reply) => {
        try {
            const body = req.body;
            // normalize payload → always array
            const responseData = Array.isArray(body) ? body : [body];
            const webhook = responseData[0];
            logger_1.log.info('route-webhook');
            logger_1.log.info('checksum:', webhook?.event?.checksum);
            // Call service
            const serviceResponse = await opts.paymentService.createWebhook(responseData);
            // Novalnet expects 200 OK
            return reply.code(200).send({
                success: true,
                data: serviceResponse,
            });
        }
        catch (error) {
            logger_1.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Webhook processing failed',
            });
        }
    });
    fastify.get("/payments", {
        preHandler: [opts.sessionHeaderAuthHook.authenticate()],
        schema: {
            querystring: novalnet_payment_dto_1.PaymentRequestSchema,
            response: {
                200: novalnet_payment_dto_1.PaymentResponseSchema,
            },
        },
    }, async (request, reply) => {
        const resp = await opts.paymentService.createPayment({
            data: request.query,
        });
        const thirdPartyUrl = "https://poc-novalnetpayments.frontend.site/en/thank-you/?orderId=c52dc5f2-f1ad-4e9c-9dc7-e60bf80d4a52";
        // return reply.redirect(302, thirdPartyUrl);
        return reply.code(302).redirect(thirdPartyUrl);
        // return reply.status(200).send(resp);
    });
};
exports.paymentRoutes = paymentRoutes;
