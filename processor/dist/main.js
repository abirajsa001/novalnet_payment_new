"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server/server");
(async () => {
    const server = await (0, server_1.setupFastify)();
    const port = Number(process.env.PORT || 8080);
    await server.listen({ port, host: '0.0.0.0' });
})();
