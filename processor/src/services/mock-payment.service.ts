import { SessionHeaderAuthenticationHook } from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  PaymentRequestSchema,
  PaymentRequestSchemaDTO,
  PaymentResponseSchema,
  PaymentResponseSchemaDTO,
} from '../dtos/mock-payment.dto';
import { MockPaymentService } from '../services/mock-payment.service';
import { log } from '../libs/logger';
import { getConfig } from '../config/config';
type PaymentRoutesOptions = {
  paymentService: MockPaymentService;
  sessionHeaderAuthHook: SessionHeaderAuthenticationHook;
};
export const paymentRoutes = async (fastify: FastifyInstance, opts: FastifyPluginOptions & PaymentRoutesOptions) => {

fastify.post('/test', async (request, reply) => {
    const novalnetPayload = {
      merchant: {
        signature: '7ibc7ob5|tuJEH3gNbeWJfIHah||nbobljbnmdli0poys|doU3HJVoym7MQ44qf7cpn7pc',
        tariff: '10004',
      },
      customer: {
        billing: {
          city: 'test',
          country_code: 'DE',
          house_no: '2,musterer',
          street: 'kaiserlautern',
          zip: '68662',
        },
        first_name: 'Max',
        last_name: 'Mustermann',
        email: 'yogarajan_r@novalnetsolutions.com',
      },
      transaction: {
        test_mode: '1',
        payment_type: 'PREPAYMENT',
        amount: 10,
        currency: 'EUR',
      },
      custom: {
        input1: 'accesskey',
        inputval1: getConfig().novalnetwebhookurl,
      },
    };

    const novalnetResponse = await fetch('https://payport.novalnet.de/v2/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-NN-Access-Key': 'YTg3ZmY2NzlhMmYzZTcxZDkxODFhNjdiNzU0MjEyMmM=',
      },
      body: JSON.stringify(novalnetPayload),
    });    
      console.log(novalnetResponse);
  });
  
  fastify.post<{ Body: PaymentRequestSchemaDTO; Reply: PaymentResponseSchemaDTO }>(
    '/payments',
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
};
