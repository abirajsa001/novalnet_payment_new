import autoLoad from '@fastify/autoload';
import cors from '@fastify/cors';
import fastifyFormBody from '@fastify/formbody';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { join } from 'path';
import requestContextPlugin from '../libs/fastify/context/context';

export const setupFastify = async () => {
  const server = Fastify({
    logger: true,
    genReqId: () => randomUUID().toString(),
    requestIdLogLabel: 'requestId',
    requestIdHeader: 'x-request-id',
  });

  await server.register(cors, {
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-Request-ID',
      'X-Session-ID',
    ],
    origin: '*',
  });

  await server.register(fastifyFormBody);
  await server.register(requestContextPlugin);

  await server.register(autoLoad, {
    dir: join(__dirname, '../routes'),
  });

  return server;
};