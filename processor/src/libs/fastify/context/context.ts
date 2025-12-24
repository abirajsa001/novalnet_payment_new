import { fastifyRequestContext, requestContext } from '@fastify/request-context';
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

const plugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyRequestContext);
});

export default plugin;

export const getRequestContext = () => requestContext.get('request') ?? {};
export const updateRequestContext = (_: any) => {};
export const getCartIdFromContext = () => '';
export const getPaymentInterfaceFromContext = () => '';
export const getMerchantReturnUrlFromContext = () => '';
export const getFutureOrderNumberFromContext = () => '';
export const getProcessorUrlFromContext = () => '';
export const getCtSessionIdFromContext = () => '';
