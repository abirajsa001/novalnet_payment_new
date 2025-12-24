"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFutureOrderNumberFromContext = exports.getMerchantReturnUrlFromContext = exports.getProcessorUrlFromContext = exports.getPaymentInterfaceFromContext = exports.getAllowedPaymentMethodsFromContext = exports.getCartIdFromContext = exports.getCtSessionIdFromContext = exports.updateRequestContext = exports.setRequestContext = exports.getRequestContext = void 0;
const paymentSdk = __importStar(require("@commercetools/connect-payments-sdk"));
const request_context_1 = require("@fastify/request-context");
const crypto_1 = require("crypto");
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
/* ------------------------------------------------------------------
 * Request Context Plugin (SINGLE source of truth)
 * ------------------------------------------------------------------ */
const requestContextPlugin = (0, fastify_plugin_1.default)(async (fastify) => {
    // Decorate request
    fastify.decorateRequest('correlationId', undefined);
    // Extract correlation id early
    fastify.addHook('onRequest', (req, _reply, done) => {
        req.correlationId =
            req.headers['x-correlation-id'] ??
                (0, crypto_1.randomUUID)();
        done();
    });
    // Register request context
    await fastify.register(request_context_1.fastifyRequestContext, {
        hook: 'onRequest',
        defaultStoreValues: (req) => ({
            request: {
                path: req.url,
                pathTemplate: req.routeOptions.url,
                pathParams: req.params,
                query: req.query,
                correlationId: req.correlationId,
                requestId: req.id,
            },
        }),
    });
}, {
    name: 'request-context-plugin',
});
exports.default = requestContextPlugin;
/* ------------------------------------------------------------------
 * Context helpers
 * ------------------------------------------------------------------ */
const getRequestContext = () => {
    return request_context_1.requestContext.get('request') ?? {};
};
exports.getRequestContext = getRequestContext;
const setRequestContext = (ctx) => {
    request_context_1.requestContext.set('request', ctx);
};
exports.setRequestContext = setRequestContext;
const updateRequestContext = (ctx) => {
    const current = (0, exports.getRequestContext)();
    (0, exports.setRequestContext)({
        ...current,
        ...ctx,
    });
};
exports.updateRequestContext = updateRequestContext;
/* ------------------------------------------------------------------
 * commercetools payment-sdk helpers
 * ------------------------------------------------------------------ */
const getCtSessionIdFromContext = () => {
    return paymentSdk.getCtSessionIdFromContext((0, exports.getRequestContext)());
};
exports.getCtSessionIdFromContext = getCtSessionIdFromContext;
const getCartIdFromContext = () => {
    return paymentSdk.getCartIdFromContext((0, exports.getRequestContext)());
};
exports.getCartIdFromContext = getCartIdFromContext;
const getAllowedPaymentMethodsFromContext = () => {
    return paymentSdk.getAllowedPaymentMethodsFromContext((0, exports.getRequestContext)());
};
exports.getAllowedPaymentMethodsFromContext = getAllowedPaymentMethodsFromContext;
const getPaymentInterfaceFromContext = () => {
    return paymentSdk.getPaymentInterfaceFromContext((0, exports.getRequestContext)());
};
exports.getPaymentInterfaceFromContext = getPaymentInterfaceFromContext;
const getProcessorUrlFromContext = () => {
    return paymentSdk.getProcessorUrlFromContext((0, exports.getRequestContext)());
};
exports.getProcessorUrlFromContext = getProcessorUrlFromContext;
const getMerchantReturnUrlFromContext = () => {
    return paymentSdk.getMerchantReturnUrlFromContext((0, exports.getRequestContext)());
};
exports.getMerchantReturnUrlFromContext = getMerchantReturnUrlFromContext;
const getFutureOrderNumberFromContext = () => {
    return paymentSdk.getFutureOrderNumberFromContext((0, exports.getRequestContext)());
};
exports.getFutureOrderNumberFromContext = getFutureOrderNumberFromContext;
