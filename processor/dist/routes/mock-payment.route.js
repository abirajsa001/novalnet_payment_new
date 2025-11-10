"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mock_payment_dto_1 = require("../dtos/mock-payment.dto");
const logger_1 = require("../libs/logger");
const config_1 = require("../config/config");
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
            body: mock_payment_dto_1.PaymentRequestSchema,
            response: {
                200: mock_payment_dto_1.PaymentResponseSchema,
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
            body: mock_payment_dto_1.PaymentRequestSchema,
            response: {
                200: mock_payment_dto_1.PaymentResponseSchema,
            },
        },
    }, async (request, reply) => {
        const resp = await opts.paymentService.createPayment({
            data: request.body,
        });
        return reply.status(200).send(resp);
    });
    fastify.get("/success", async (request, reply) => {
        const query = request.query;
        const accessKey = String((0, config_1.getConfig)()?.novalnetPublicKey ?? "");
        const reverseKey = accessKey.split("").reverse().join("");
        if (query.tid && query.status && query.checksum && query.txn_secret) {
            const tokenString = `${query.tid}${query.txn_secret}${query.status}${reverseKey}`;
            // const orderNumber = query.orderNumber as string | undefined;
            // if (!orderNumber) {
            //   return reply.code(400).send('Missing orderNumber');
            // }
            // log.info(orderNumber + 'orderNumber')
            const generatedChecksum = crypto_1.default
                .createHash("sha256")
                .update(tokenString)
                .digest("hex");
            if (generatedChecksum === query.checksum) {
                try {
                    // const orderId = await getOrderIdFromOrderNumber(orderNumber);
                    // if (!orderId) return reply.code(404).send('Order not found');
                    // const thirdPartyUrl = 'https://poc-novalnetpayments.frontend.site/en/thank-you/?orderId=' + orderId;
                    const thirdPartyUrl = 'https://poc-novalnetpayments.frontend.site/en/thank-you/';
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
        const thirdPartyUrl = 'https://poc-novalnetpayments.frontend.site/en/thank-you/?orderId=c52dc5f2-f1ad-4e9c-9dc7-e60bf80d4a52';
        return reply.code(302).redirect(thirdPartyUrl);
    });
    fastify.get("/callback", async (request, reply) => {
        return reply.send("sucess");
    });
    fastify.post('/webhook', async (req, reply) => {
        const rawBody = req.body;
        const rawString = JSON.stringify(req.body);
        return reply.send(rawBody);
    });
    fastify.get("/payments", {
        preHandler: [opts.sessionHeaderAuthHook.authenticate()],
        schema: {
            querystring: mock_payment_dto_1.PaymentRequestSchema,
            response: {
                200: mock_payment_dto_1.PaymentResponseSchema,
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
