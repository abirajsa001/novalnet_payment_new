import { setupFastify } from './server/server';

(async () => {
  const server = await setupFastify();
  const port = Number(process.env.PORT || 8080);
  await server.listen({ port, host: '0.0.0.0' });
})();