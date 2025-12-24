"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupFastify = setupFastify;
const fastify_1 = __importDefault(require("fastify"));
const autoload_1 = __importDefault(require("@fastify/autoload"));
const path_1 = require("path");
const context_1 = __importDefault(require("../libs/fastify/context/context"));
async function setupFastify() {
    const server = (0, fastify_1.default)({ logger: true });
    await server.register(context_1.default);
    await server.register(autoload_1.default, { dir: (0, path_1.join)(__dirname, '../routes') });
    server.get('/health', async () => ({ status: 'UP' }));
    return server;
}
