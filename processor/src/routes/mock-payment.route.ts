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
import {
  Address,
  Customer,
  CustomerSetCustomFieldAction,
  CustomerSetCustomTypeAction,
} from '@commercetools/platform-sdk';
import { MockPaymentService } from "../services/mock-payment.service";
import { log } from "../libs/logger";
import { getConfig } from "../config/config";
import { projectApiRoot } from '../utils/ct-client';
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
      if(resp?.transactionStatus == 'FAILURE') {
        const baseUrl = "https://poc-novalnetpayments.frontend.site/checkout";
        return reply.code(302).redirect(baseUrl);
      }
      return reply.status(200).send(resp);
    },
  );

  fastify.post('/getconfig', async (req, reply) => {
    // safe retrieval of client key
    const clientKey = String(getConfig()?.novalnetClientkey ?? '');

    // send a JSON object matching expected shape
    // Fastify will set Content-Type: application/json automatically for objects
    return reply.code(200).send({ paymentReference: clientKey });
  });
  
fastify.post<{ Body: PaymentRequestSchemaDTO }>(
  '/getCustomerAddress',
  async (req: FastifyRequest<{ Body: PaymentRequestSchemaDTO }>, reply: FastifyReply) => {
    log.info('route-customer-address'); 
    log.info("getCartIdFromContext():");
    log.info(getCartIdFromContext());
    const carts = await projectApiRoot.carts().get().execute();
    log.info("CART LIST:", carts.body.results);
    log.info(carts.body.results[0]?.id ?? 'empty1');
    const cartId = carts.body.results[0]?.id ?? 'empty1';
    // req.body is typed as PaymentRequestSchemaDTO now
    const resp = await opts.paymentService.getCustomerAddress({
      data: req.body,
      cartId,
    }as any);

   return reply.code(200).send(resp);
  }
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
      ctPaymentID?: string;
      pspReference?: string;
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
          const requestData = {
            interfaceId: query.tid,
            ctId: query.ctsid,
            ctPaymentId: query.ctPaymentID,
            pspReference: query.pspReference,
          };
        
          // Convert to JSON string
          const jsonBody = JSON.stringify(requestData);
        
          const result = await opts.paymentService.createPaymentt({
            data: jsonBody,  // send JSON string
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
      paymentReference?: string;
      ctsid?: string;
      orderNumber?: string;
      ctPaymentID?: string;
      pspReference?: string;
      tid?: string;
      status_text?: string;
      payment_type?: string;
    };
  
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
        data: jsonBody,  // send JSON string
      });
      return reply.code(302).redirect(redirectUrl.toString());
    } catch (error) {
      log.error("Error processing payment:", error);
      return reply.code(400).send("Payment processing failed");
    }
  });
  
  fastify.get("/callback", async (request, reply) => {
    return reply.send("sucess");
  });

  fastify.post<{ Body: any }>('/webhook', async (req, reply) => {
    try {
      const body = req.body as Record<string, any> | any[];
  
      // normalize payload → always array
      const responseData = Array.isArray(body) ? body : [body];
  
      const webhook = responseData[0] as Record<string, any>;
  
      log.info('route-webhook');
      log.info('checksum:', webhook?.event?.checksum);
  
      // Call service
      const serviceResponse = await opts.paymentService.createWebhook(responseData);
  
      // Novalnet expects 200 OK
      return reply.code(200).send({
        success: true,
        data: serviceResponse,
      });
    } catch (error) {
      log.error(error);
  
      return reply.code(500).send({ 
        success: false, 
        message: 'Webhook processing failed',
      });
    }
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
