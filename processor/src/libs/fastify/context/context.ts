import { fastifyRequestContext, requestContext } from '@fastify/request-context';
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

declare module '@fastify/request-context' {
  interface RequestContextData {
    request?: Record<string, any>;
  }
}

const requestContextPlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyRequestContext, {
    defaultStoreValues: {
      request: {},
    },
  });
});

export default requestContextPlugin;

export const getRequestContext = (): Record<string, any> => {
  return (requestContext.get('request') as Record<string, any>) ?? {};
};

export const updateRequestContext = (ctx: Record<string, any>) => {
  const current = getRequestContext();
  requestContext.set('request', { ...current, ...ctx });
};
