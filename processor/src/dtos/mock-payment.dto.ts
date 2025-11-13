import { Static, Type } from "@sinclair/typebox";

export enum PaymentOutcome {
  AUTHORIZED = "Authorized",
  REJECTED = "Rejected",
}

export enum PaymentMethodType {
  CARD = "card",
  INVOICE = "invoice",
  PREPAYMENT = "prepayment",
  IDEAL = "ideal",
  PAYPAL = "paypal",
  ONLINE_BANK_TRANSFER = "onlinebanktransfer",
  ALIPAY = "alipay",
  BANCONTACT = "bancontact",
  BLIK = "blik",
  EPS = "eps",
  MBWAY = "mbway",
  MULTIBANCO = "multibanco",
  PAYCONIQ = "payconiq",
  POSTFINANCE = "postfinance",
  POSTFINANCE_CARD = "postfinancecard",
  PRZELEWY24 = "przelewy24",
  TRUSTLY = "trustly",
  TWINT = "twint",
  WECHATPAY = "wechatpay",
  SEPA = "sepa",
  ACH = "ach",
  CREDITCARD = "creditcard",
}

export const PaymentResponseSchema = Type.Object({
  paymentReference: Type.Optional(Type.String()),
  txnSecret: Type.Optional(Type.String()),
});
console.log("mock-payment-dto.ts");
export const PaymentOutcomeSchema = Type.Enum(PaymentOutcome);

export const PaymentRequestSchema = Type.Object({
  paymentMethod: Type.Object({
    type: Type.String(),
    accHolder: Type.Optional(Type.String()),
    poNumber: Type.Optional(Type.String()),
    invoiceMemo: Type.Optional(Type.String()),
    panHash: Type.Optional(Type.String()),
    uniqueId: Type.Optional(Type.String()),
    doRedirect: Type.Optional(Type.String()),
    returnUrl: Type.Optional(Type.String()),
  }),
  paymentOutcome: PaymentOutcomeSchema,
});

export type PaymentRequestSchemaDTO = Static<typeof PaymentRequestSchema>;
export type PaymentResponseSchemaDTO = Static<typeof PaymentResponseSchema>;
