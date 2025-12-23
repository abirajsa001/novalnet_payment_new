import * as paymentSdk from '@commercetools/connect-payments-sdk';
import {
  fastifyRequestContext,
  requestContext,
} from '@fastify/request-context';
import { randomUUID } from 'crypto';
import {
  FastifyInstance,
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------ */

export type ContextData = {
  anonymousId?: string;
  customerId?: string;
  path?: string;
  pathTemplate?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pathParams?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: any;
  correlationId: string;
  requestId: string;
  authentication?: paymentSdk.Authentication;
};

/* ------------------------------------------------------------------
 * Fastify request type augmentation
 * ------------------------------------------------------------------ */

declare module 'fastify' {
  interface FastifyRequest {
    correlationId?: string;
  }
}

/* ------------------------------------------------------------------
 * Request Context Plugin (SINGLE source of truth)
 * ------------------------------------------------------------------ */

const requestContextPlugin = fp(
  async (fastify: FastifyInstance) => {
    // Decorate request
    fastify.decorateRequest('correlationId', undefined);

    // Extract correlation id early
    fastify.addHook('onRequest', (req, _reply, done) => {
      req.correlationId =
        (req.headers['x-correlation-id'] as string) ??
        randomUUID();
      done();
    });

    // Register request context
    await fastify.register(fastifyRequestContext, {
      hook: 'onRequest',
      defaultStoreValues: (req: FastifyRequest) => ({
        request: {
          path: req.url,
          pathTemplate: req.routeOptions.url,
          pathParams: req.params,
          query: req.query,
          correlationId: req.correlationId!,
          requestId: req.id,
        },
      }),
    });
  },
  {
    name: 'request-context-plugin',
  }
);

export default requestContextPlugin;

/* ------------------------------------------------------------------
 * Context helpers
 * ------------------------------------------------------------------ */

export const getRequestContext = (): Partial<ContextData> => {
  return requestContext.get('request') ?? {};
};

export const setRequestContext = (ctx: ContextData) => {
  requestContext.set('request', ctx);
};

export const updateRequestContext = (ctx: Partial<ContextData>) => {
  const current = getRequestContext();
  setRequestContext({
    ...(current as ContextData),
    ...ctx,
  });
};

/* ------------------------------------------------------------------
 * commercetools payment-sdk helpers
 * ------------------------------------------------------------------ */

export const getCtSessionIdFromContext = (): string => {
  return paymentSdk.getCtSessionIdFromContext(
    getRequestContext() as ContextData
  ) as string;
};

export const getCartIdFromContext = (): string => {
  return paymentSdk.getCartIdFromContext(
    getRequestContext() as ContextData
  ) as string;
};

export const getAllowedPaymentMethodsFromContext = (): string[] => {
  return paymentSdk.getAllowedPaymentMethodsFromContext(
    getRequestContext() as ContextData
  ) as string[];
};

export const getPaymentInterfaceFromContext = (): string | undefined => {
  return paymentSdk.getPaymentInterfaceFromContext(
    getRequestContext() as ContextData
  );
};

export const getProcessorUrlFromContext = (): string => {
  return paymentSdk.getProcessorUrlFromContext(
    getRequestContext() as ContextData
  ) as string;
};

export const getMerchantReturnUrlFromContext = (): string | undefined => {
  return paymentSdk.getMerchantReturnUrlFromContext(
    getRequestContext() as ContextData
  );
};

export const getFutureOrderNumberFromContext = (): string | undefined => {
  return paymentSdk.getFutureOrderNumberFromContext(
    getRequestContext() as ContextData
  );
};
