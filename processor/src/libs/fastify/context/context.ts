import {
  fastifyRequestContext,
  requestContext,
} from '@fastify/request-context';
import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId?: string;
  }
}

const requestContextPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorateRequest('correlationId', undefined);

  fastify.addHook('onRequest', (req, _reply, done) => {
    req.correlationId =
      (req.headers['x-correlation-id'] as string) ?? randomUUID();
    done();
  });

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
});

export default requestContextPlugin;

export const getRequestContext = () => requestContext.get('request') ?? {};