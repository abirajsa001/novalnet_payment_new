import Fastify from 'fastify';
import autoLoad from '@fastify/autoload';
import { join } from 'path';
import requestContextPlugin from '../libs/fastify/context/context';

export async function setupFastify() {
  const server = Fastify({ logger: true });
  await server.register(requestContextPlugin);
  await server.register(autoLoad, { dir: join(__dirname, '../routes') });
  server.get('/health', async () => ({ status: 'UP' }));
  return server;
}