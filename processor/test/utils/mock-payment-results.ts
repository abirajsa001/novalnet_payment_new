import { Payment, Transaction } from '@commercetools/connect-payments-sdk';

const novalnetChargePaymentTransaction: Transaction = {
  id: 'dummy-transaction-id',
  timestamp: '2024-02-13T00:00:00.000Z',
  type: 'Charge',
  amount: {
    type: 'centPrecision',
    centAmount: 120000,
    currencyCode: 'GBP',
    fractionDigits: 2,
  },
  state: 'Success',
};
console.log('novalnet-payment.service.spec.ts-test');
export const novalnetGetPaymentResult: Payment = {
  id: '123456',
  version: 1,
  amountPlanned: {
    type: 'centPrecision',
    currencyCode: 'GBP',
    centAmount: 120000,
    fractionDigits: 2,
  },
  interfaceId: '92C12661DS923781G',
  paymentMethodInfo: {
    method: 'Debit Card',
    name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
  },
  paymentStatus: { interfaceText: 'Paid' },
  transactions: [novalnetChargePaymentTransaction],
  interfaceInteractions: [],
  createdAt: '2024-02-13T00:00:00.000Z',
  lastModifiedAt: '2024-02-13T00:00:00.000Z',
};

export const novalnetGetPaymentResultWithoutTransactions: Payment = {
  id: '123456',
  version: 1,
  amountPlanned: {
    type: 'centPrecision',
    currencyCode: 'GBP',
    centAmount: 120000,
    fractionDigits: 2,
  },
  interfaceId: '92C12661DS923781G',
  paymentMethodInfo: {
    method: 'Debit Card',
    name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
  },
  paymentStatus: { interfaceText: 'Paid' },
  transactions: [],
  interfaceInteractions: [],
  createdAt: '2024-02-13T00:00:00.000Z',
  lastModifiedAt: '2024-02-13T00:00:00.000Z',
};

const novalnetCancelPaymentTransaction: Transaction = {
  id: 'dummy-transaction-id',
  timestamp: '2024-02-13T00:00:00.000Z',
  type: 'CancelAuthorization',
  amount: {
    type: 'centPrecision',
    centAmount: 120000,
    currencyCode: 'GBP',
    fractionDigits: 2,
  },
  state: 'Initial',
};

const novalnetRefundPaymentTransaction: Transaction = {
  id: 'dummy-transaction-id',
  timestamp: '2024-02-13T00:00:00.000Z',
  type: 'Charge',
  amount: {
    type: 'centPrecision',
    centAmount: 120000,
    currencyCode: 'GBP',
    fractionDigits: 2,
  },
  state: 'Success',
};

export const novalnetUpdatePaymentResult: Payment = {
  id: '123456',
  version: 1,
  amountPlanned: {
    type: 'centPrecision',
    currencyCode: 'GBP',
    centAmount: 120000,
    fractionDigits: 2,
  },
  interfaceId: '92C12661DS923781G',
  paymentMethodInfo: {
    method: 'Debit Card',
    name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
  },
  paymentStatus: { interfaceText: 'Paid' },
  transactions: [novalnetCancelPaymentTransaction],
  interfaceInteractions: [],
  createdAt: '2024-02-13T00:00:00.000Z',
  lastModifiedAt: '2024-02-13T00:00:00.000Z',
};

export const novalnetUpdatePaymentResultWithRefundTransaction: Payment = {
  id: '123456',
  version: 1,
  amountPlanned: {
    type: 'centPrecision',
    currencyCode: 'GBP',
    centAmount: 120000,
    fractionDigits: 2,
  },
  interfaceId: '92C12661DS923781G',
  paymentMethodInfo: {
    method: 'Debit Card',
    name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
  },
  paymentStatus: { interfaceText: 'Paid' },
  transactions: [novalnetRefundPaymentTransaction],
  interfaceInteractions: [],
  createdAt: '2024-02-13T00:00:00.000Z',
  lastModifiedAt: '2024-02-13T00:00:00.000Z',
};
