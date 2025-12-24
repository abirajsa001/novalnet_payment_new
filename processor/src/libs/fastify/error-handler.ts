export const errorHandler = (err: any, _req: any, reply: any) => {
  reply.status(500).send({ message: err?.message ?? 'error' });
};