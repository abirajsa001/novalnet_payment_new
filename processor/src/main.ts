import { setupFastify } from './server/server';

(async () => {
  const server = await setupFastify();

  const port = Number(process.env.PORT || 8080);
  const host = '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
})();
