import { describe, test, expect, afterEach, jest, beforeEach } from '@jest/globals';
import { SessionAuthentication, SessionPrincipal } from '@commercetools/connect-payments-sdk';
import * as Context from '../../../../src/libs/fastify/context/context';
console.log('context.spec.ts-test');
describe('context', () => {
  const sessionId: string = '123456-123456-123456-123456';
  const principal: SessionPrincipal = {
    cartId: '123456',
    allowedPaymentMethods: [],
    processorUrl: 'http://127.0.0.1',
    paymentInterface: 'dummyPaymentInterface',
    merchantReturnUrl: 'https://merchant.return.url',
  };

  const novalnetSessionAuthentication: SessionAuthentication = new SessionAuthentication(sessionId, principal);

  beforeEach(() => {
    jest.setTimeout(10000);
    jest.resetAllNovalnets();
  });

  afterEach(() => {
    jest.restoreAllNovalnets();
  });

  test('getCtSessionIdFromContext', async () => {
    const novalnetRequestContext = {
      authentication: novalnetSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').novalnetReturnValue(novalnetRequestContext);
    const result = Context.getCtSessionIdFromContext();
    expect(result).toStrictEqual(sessionId);
  });

  test('getAllowedPaymentMethodsFromContext', async () => {
    const novalnetRequestContext = {
      authentication: novalnetSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').novalnetReturnValue(novalnetRequestContext);
    const result = Context.getAllowedPaymentMethodsFromContext();
    expect(result).toHaveLength(0);
  });

  test('getCartIdFromContext', async () => {
    const novalnetRequestContext = {
      authentication: novalnetSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').novalnetReturnValue(novalnetRequestContext);
    const result = Context.getCartIdFromContext();
    expect(result).toStrictEqual('123456');
  });

  test('getMerchantReturnUrlFromContext', async () => {
    const novalnetRequestContext = {
      authentication: novalnetSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').novalnetReturnValue(novalnetRequestContext);
    const result = Context.getMerchantReturnUrlFromContext();
    expect(result).toStrictEqual('https://merchant.return.url');
  });

  test('getProcessorUrlFromContext', async () => {
    const novalnetRequestContext = {
      authentication: novalnetSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').novalnetReturnValue(novalnetRequestContext);
    const result = Context.getProcessorUrlFromContext();
    expect(result).toStrictEqual('http://127.0.0.1');
  });
});
