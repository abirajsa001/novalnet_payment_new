"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server/server");
(async () => {
    const server = await (0, server_1.setupFastify)();
    const port = Number(process.env.PORT || 8080);
    const host = '0.0.0.0';
    try {
        await server.listen({ port, host });
        server.log.info(`Server listening on ${host}:${port}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
})();
