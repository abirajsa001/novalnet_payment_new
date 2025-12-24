"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRequestContext = exports.getRequestContext = void 0;
const request_context_1 = require("@fastify/request-context");
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const requestContextPlugin = (0, fastify_plugin_1.default)(async (fastify) => {
    await fastify.register(request_context_1.fastifyRequestContext, {
        defaultStoreValues: {
            request: {},
        },
    });
});
exports.default = requestContextPlugin;
const getRequestContext = () => {
    return request_context_1.requestContext.get('request') ?? {};
};
exports.getRequestContext = getRequestContext;
const updateRequestContext = (ctx) => {
    const current = (0, exports.getRequestContext)();
    request_context_1.requestContext.set('request', { ...current, ...ctx });
};
exports.updateRequestContext = updateRequestContext;
