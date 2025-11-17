import { SessionHeaderAuthenticationHook } from "@commercetools/connect-payments-sdk";
import { getOrderIdFromOrderNumber } from '../services/order.service';

import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { getCartIdFromContext } from "../libs/fastify/context/context";
import crypto from "crypto";
import * as Context from "../libs/fastify/context/context";

import {
  PaymentRequestSchema,
  PaymentRequestSchemaDTO,
  PaymentResponseSchema,
  PaymentResponseSchemaDTO,
} from "../dtos/mock-payment.dto";

import { MockPaymentService } from "../services/mock-payment.service";
import { log } from "../libs/logger";
import { getConfig } from "../config/config";
type PaymentRoutesOptions = {
  paymentService: MockPaymentService;
  sessionHeaderAuthHook: SessionHeaderAuthenticationHook;
};
console.log("before-payment-routes");
log.info("before-payment-routes");
export const paymentRoutes = async (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & PaymentRoutesOptions,
) => {
  fastify.post("/test", async (request, reply) => {
    console.log("Received payment request in processor");
    // Call Novalnet API server-side (no CORS issue)
    const novalnetPayload = {
      merchant: {
        signature: String(getConfig()?.novalnetPrivateKey ?? ""),
        tariff: String(getConfig()?.novalnetTariff ?? ""),
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

    const novalnetResponse = await fetch(
      "https://payport.novalnet.de/v2/payment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-NN-Access-Key": String(getConfig()?.novalnetPrivateKey ?? ""),
        },
        body: JSON.stringify(novalnetPayload),
      },
    );
    console.log("handle-novalnetResponse");
    console.log(novalnetResponse);
  });

  fastify.post<{
    Body: PaymentRequestSchemaDTO;
    Reply: PaymentResponseSchemaDTO;
  }>(
    "/payments",
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],

      schema: {
        body: PaymentRequestSchema,
        response: {
          200: PaymentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      log.info("=== PAYMENT ROUTE /payments CALLEDS ===");
      log.info("Request body:", JSON.stringify(request.body, null, 2));
      log.info("Request headers:", request.headers);
      
      try {
        const resp = await opts.paymentService.createPayments({
          data: request.body,
        });

        log.info("Payment service response:", JSON.stringify(resp, null, 2));
        return reply.status(200).send(resp);
      } catch (error) {
        log.error("Payment route error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error("Error details:", {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined
        });
        return reply.status(500).send({ paymentReference: 'error' });
      }
    },
  );

  fastify.post<{
    Body: PaymentRequestSchemaDTO;
    Reply: PaymentResponseSchemaDTO;
  }>(
    "/payment",
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],

      schema: {
        body: PaymentRequestSchema,
        response: {
          200: PaymentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createPayment({
        data: request.body,
      });

      return reply.status(200).send(resp);
    },
  );

  fastify.get("/success", async (request, reply) => {
    const query = request.query as {
      tid?: string;
      status?: string;
      checksum?: string;
      txn_secret?: string;
      paymentReference?: string;
      ctsid?: string;
      orderNumber?: string;
    };

    const accessKey = String(getConfig()?.novalnetPublicKey ?? "");
    const reverseKey =  accessKey.split("").reverse().join("");

    if (query.tid && query.status && query.checksum && query.txn_secret) {
      const tokenString = `${query.tid}${query.txn_secret}${query.status}${reverseKey}`;
      const orderNumber = query.orderNumber as string | undefined;
      
      if (!orderNumber) {
        return reply.code(400).send('Missing orderNumber');
      }

      log.info(orderNumber + 'orderNumber')

      const generatedChecksum = crypto
        .createHash("sha256")
        .update(tokenString)
        .digest("hex");
      
      if (generatedChecksum === query.checksum) {
        try {
          const result = await opts.paymentService.createPaymentt({
            data: {
              interfaceId: query.tid,
              ctId: ctsid,
            },
          }); 

          const orderId = await getOrderIdFromOrderNumber(orderNumber);
          if (!orderId) return reply.code(404).send('Order not found');

          const thirdPartyUrl = 'https://poc-novalnetpayments.frontend.site/en/thank-you/?orderId=' + orderId;

          //const thirdPartyUrl = 'https://poc-novalnetpayments.frontend.site/en/thank-you/';
          return reply.code(302).redirect(thirdPartyUrl);
        } catch (error) {
          log.error("Error processing payment:", error);
          return reply.code(400).send("Payment processing failed");
        }
      } else {
        log.error("Checksum verification failed", { expected: generatedChecksum, received: query.checksum });
        return reply.code(400).send('Checksum verification failed.');
      }
    } else {
      return reply.code(400).send("Missing required query parameters.");
    }
  });

  fastify.get("/failure", async (request, reply) => {
    const query = request.query as {
      tid?: string;
      status?: string;
      paymentReference?: string;
    };

    const thirdPartyUrl = 'https://poc-novalnetpayments.frontend.site/en/thank-you/?orderId=c52dc5f2-f1ad-4e9c-9dc7-e60bf80d4a52';
    return reply.code(302).redirect(thirdPartyUrl);
  });

  fastify.get("/callback", async (request, reply) => {
    return reply.send("sucess");
  });

fastify.post('/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
  const rawBody = req.body;
  const rawString = JSON.stringify(req.body);
  
  return reply.send(rawBody);
});

  fastify.get<{
    Querystring: PaymentRequestSchemaDTO;
    Reply: PaymentResponseSchemaDTO;
  }>(
    "/payments",
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
      schema: {
        querystring: PaymentRequestSchema,
        response: {
          200: PaymentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createPayment({
        data: request.query,
      });
      const thirdPartyUrl =
        "https://poc-novalnetpayments.frontend.site/en/thank-you/?orderId=c52dc5f2-f1ad-4e9c-9dc7-e60bf80d4a52";
      // return reply.redirect(302, thirdPartyUrl);
      return reply.code(302).redirect(thirdPartyUrl);
      // return reply.status(200).send(resp);
    },
  );
};