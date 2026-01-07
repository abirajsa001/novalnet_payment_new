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
} from "../dtos/novalnet-payment.dto";
import {
  Address,
  Customer,
  CustomerSetCustomFieldAction,
  CustomerSetCustomTypeAction,
} from '@commercetools/platform-sdk';
import { NovalnetPaymentService } from "../services/novalnet-payment.service";
import { log } from "../libs/logger";
import { getConfig } from "../config/config";
import { projectApiRoot } from '../utils/ct-client';
type PaymentRoutesOptions = {
  paymentService: NovalnetPaymentService;
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
        const resp = await opts.paymentService.createRedirectPayment({
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
      const resp = await opts.paymentService.createDirectPayment({
        data: request.body,
      });
      log.info("locale-pathurl-direct");
      log.info(request.body.path);
      if(resp?.transactionStatus == 'FAILURE') {
        const baseUrl = request.body.path + "/checkout";
        return reply.code(302).redirect(baseUrl);
      }
      return reply.status(200).send(resp);
    },
  );

  fastify.post('/getconfig', async (req, reply) => {
    const clientKey = String(getConfig()?.novalnetClientkey ?? '');
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
      lang?: string;
      path?: string;
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
            lang: query.lang,
            path: query.path
          };
        log.info("path-route");
        log.info(requestData?.path);
          // Convert to JSON string
          const jsonBody = JSON.stringify(requestData);
        
          const result = await opts.paymentService.transactionUpdate({
            data: jsonBody,  // send JSON string
          });
        
          const orderId = await getOrderIdFromOrderNumber(orderNumber);
          if (!orderId) return reply.code(404).send('Order not found');
		  let requestPath = requestData?.path ?? '';
		  let requestlang = requestData?.lang ?? '';
          const thirdPartyUrl = requestPath + '/' +requestlang + '/thank-you/?orderId=' + orderId;
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
      path?: string;
    };
  
    if (query.path) {
      log.info('failure-path-route');
      log.info(query.path);
    }
    const baseUrl = query.path + "/checkout";
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
  
  fastify.post<{ Body: any }>('/webhook', async (req, reply) => {
    try {
      const body = req.body as Record<string, any> | any[];
      const responseData = Array.isArray(body) ? body : [body];
      const webhook = responseData[0] as Record<string, any>;
  
      log.info('route-webhook');
      log.info('checksum:', webhook?.event?.checksum);
  
      // Call service
      const serviceResponse = await opts.paymentService.createWebhook(responseData);
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
  
};
