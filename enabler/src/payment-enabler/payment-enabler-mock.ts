import { CardBuilder } from "../components/payment-methods/card/card";
import { InvoiceBuilder } from "../components/payment-methods/invoice/invoice";
import { PrepaymentBuilder } from "../components/payment-methods/prepayment/prepayment";
import { IdealBuilder } from "../components/payment-methods/ideal/ideal";
import { PaypalBuilder } from "../components/payment-methods/paypal/paypal";
import { OnlinebanktransferBuilder } from "../components/payment-methods/onlinebanktransfer/onlinebanktransfer";
import { AlipayBuilder } from "../components/payment-methods/alipay/alipay";
import { BancontactBuilder } from "../components/payment-methods/bancontact/bancontact";
import { BlikBuilder } from "../components/payment-methods/blik/blik";
import { EpsBuilder } from "../components/payment-methods/eps/eps";
import { MbwayBuilder } from "../components/payment-methods/mbway/mbway";
import { MultibancoBuilder } from "../components/payment-methods/multibanco/multibanco";
import { PayconiqBuilder } from "../components/payment-methods/payconiq/payconiq";
import { PostfinanceBuilder } from "../components/payment-methods/postfinance/postfinance";
import { PostfinancecardBuilder } from "../components/payment-methods/postfinancecard/postfinancecard";
import { Przelewy24Builder } from "../components/payment-methods/przelewy24/przelewy24";
import { TrustlyBuilder } from "../components/payment-methods/trustly/trustly";
import { TwintBuilder } from "../components/payment-methods/twint/twint";
import { WechatpayBuilder } from "../components/payment-methods/wechatpay/wechatpay";
import { SepaBuilder } from "../components/payment-methods/sepa/sepa";
import { AchBuilder } from "../components/payment-methods/ach/ach";
import { CreditcardBuilder } from "../components/payment-methods/creditcard/creditcard";
import { FakeSdk } from "../fake-sdk";
import {
  DropinType,
  EnablerOptions,
  PaymentComponentBuilder,
  PaymentDropinBuilder,
  PaymentEnabler,
  PaymentResult,
} from "./payment-enabler";
import { DropinEmbeddedBuilder } from "../dropin/dropin-embedded";


declare global {
  interface ImportMeta {
    env: any;
  }
}

export type BaseOptions = {
  sdk: FakeSdk;
  processorUrl: string;
  sessionId: string;
  environment: string;
  locale?: string;
  onComplete: (result: PaymentResult) => void;
  onError: (error: any, context?: { paymentReference?: string }) => void;
};

export class MockPaymentEnabler implements PaymentEnabler {
  setupData: Promise<{ baseOptions: BaseOptions }>;

  constructor(options: EnablerOptions) {
    this.setupData = MockPaymentEnabler._Setup(options);
  }

  private static _Setup = async (
    options: EnablerOptions
  ): Promise<{ baseOptions: BaseOptions }> => {
    // Fetch SDK config from processor if needed, for example:

    // const configResponse = await fetch(instance.processorUrl + '/config', {
    //   method: 'GET',
    //   headers: { 'Content-Type': 'application/json', 'X-Session-Id': options.sessionId },
    // });

    // const configJson = await configResponse.json();

    const sdkOptions = {
      // environment: configJson.environment,
      environment: "test",
    };

    return Promise.resolve({
      baseOptions: {
        sdk: new FakeSdk(sdkOptions),
        processorUrl: options.processorUrl,
        sessionId: options.sessionId,
        environment: sdkOptions.environment,
        onComplete: options.onComplete || (() => {}),
        onError: options.onError || (() => {}),
      },
    });
  };

  async createComponentBuilder(
    type: string
  ): Promise<PaymentComponentBuilder | never> {
    const { baseOptions } = await this.setupData;

    const supportedMethods = {
      card: CardBuilder,
      invoice: InvoiceBuilder,
      prepayment: PrepaymentBuilder,
      ideal: IdealBuilder,
      paypal: PaypalBuilder,
      onlinebanktransfer: OnlinebanktransferBuilder,
      alipay: AlipayBuilder,
      bancontact: BancontactBuilder,
      blik: BlikBuilder,
      eps: EpsBuilder,
      mbway: MbwayBuilder,
      multibanco: MultibancoBuilder,
      payconiq: PayconiqBuilder,
      postfinance: PostfinanceBuilder,
      postfinancecard: PostfinancecardBuilder,
      przelewy24: Przelewy24Builder,
      trustly: TrustlyBuilder,
      twint: TwintBuilder,
      wechatpay: WechatpayBuilder,
      sepa: SepaBuilder,
      ach: AchBuilder,
      creditcard: CreditcardBuilder,
    };

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(
          supportedMethods
        ).join(", ")}`
      );
    }

    return new supportedMethods[type](baseOptions);
  }

  async createDropinBuilder(
    type: DropinType
  ): Promise<PaymentDropinBuilder | never> {
    const { baseOptions } = await this.setupData;

    const supportedMethods = {
      embedded: DropinEmbeddedBuilder,
      // hpp: DropinHppBuilder,
    };

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(
          supportedMethods
        ).join(", ")}`
      );
    }

    return new supportedMethods[type](baseOptions);
  }
}
