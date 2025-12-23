"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const server_1 = require("./server/server");
console.log('main.ts');
(async () => {
    const server = await (0, server_1.setupFastify)();
    const HOST = '0.0.0.0';
    try {
        await server.listen({
            port: 8080,
            host: HOST,
        });
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
})();
