 import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod
} from '../../../payment-enabler/payment-enabler';
import { BaseComponent } from "../../base";
import styles from '../../../style/style.module.scss';
import buttonStyles from "../../../style/button.module.scss";
import {
  PaymentOutcome,
  PaymentRequestSchemaDTO,
} from "../../../dtos/novalnet-payment.dto";
import { BaseOptions } from "../../../payment-enabler/payment-enabler-mock";

export class AchBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;
  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
    return new Ach(this.baseOptions, config);
  }
}

export class Ach extends BaseComponent {
  private showPayButton: boolean;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.ach, baseOptions, componentOptions);
    this.showPayButton = componentOptions?.showPayButton ?? false;
  }

  mount(selector: string) {
    document
      .querySelector(selector)
      .insertAdjacentHTML("afterbegin", this._getTemplate());

    if (this.showPayButton) {
      document
        .querySelector("#purchaseOrderForm-paymentButton")
        .addEventListener("click", (e) => {
          e.preventDefault();
          this.submit();
        });
    }
  }

  async submit() {
    // here we would call the SDK to submit the payment
    this.sdk.init({ environment: this.environment });
    const pathLocale = window.location.pathname.split("/")[1];
    const url = new URL(window.location.href);
    const baseSiteUrl = url.origin;
    try {
      // start original
    const accountHolderInput = document.getElementById('purchaseOrderForm-accHolder') as HTMLInputElement;
    const accountNumberInput = document.getElementById('purchaseOrderForm-accountNumber') as HTMLInputElement;
    const routingNumberInput = document.getElementById('purchaseOrderForm-routingNumber') as HTMLInputElement;

    const accountHolder = accountHolderInput?.value.trim();
    const accountNumber = accountNumberInput?.value.trim();
    const routingNumber = routingNumberInput?.value.trim();

    const requestData: PaymentRequestSchemaDTO = {
        paymentMethod: {
          type: "DIRECT_DEBIT_ACH",
          accHolder: accountHolder,
          accountNumber: accountNumber,
          routingNumber: routingNumber,
        },
        paymentOutcome: PaymentOutcome.AUTHORIZED,
        lang: pathLocale ?? 'de',
        path: baseSiteUrl ,
      };

    const response = await fetch(this.processorUrl + "/directPayment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify(requestData),
      });
      const data = await response.json();
      if (data.paymentReference) {
        this.onComplete &&
          this.onComplete({
            isSuccess: true,
            paymentReference: data.paymentReference,
          });
      } else {
        this.onError("Some error occurred. Please try again.");
      }

    } catch (e) {
      this.onError("Some error occurred. Please try again.");
    }
  }

private _getTemplate() {
  const payButton = this.showPayButton
    ? `<button class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}" id="purchaseOrderForm-paymentButton">Pay</button>`
      : "";

      return `
      <div style="width:100%; display:flex; flex-direction:column;">
      
        <form id="purchaseOrderForm"
          style="
            width:100%;
            display:flex;
            flex-direction:column;
            gap:20px;
          "
        >
      
          <!-- Account Holder -->
          <div style="display:flex; flex-direction:column; width:100%;">
            <label for="purchaseOrderForm-accHolder"
              style="font-size:14px; font-weight:600; color:#333; margin-bottom:6px;"
            >
              Account Holder <span style="color:#d70000;">*</span>
            </label>
      
            <input
              type="text"
              id="purchaseOrderForm-accHolder"
              name="accHolder"
              style="
                padding:12px 14px;
                border:1.5px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
                transition:all 0.2s ease-in-out;
                outline:none;
              "
            />
      
            <span
              style="
                display:none;
                margin-top:4px;
                font-size:12px;
                color:#d70000;
              "
            >Invalid Account Holder</span>
          </div>
      
          <!-- Account Number -->
          <div style="display:flex; flex-direction:column; width:100%;">
            <label for="purchaseOrderForm-accountNumber"
              style="font-size:14px; font-weight:600; color:#333; margin-bottom:6px;"
            >
              Account Number <span style="color:#d70000;">*</span>
            </label>
      
            <input
              type="text"
              id="purchaseOrderForm-accountNumber"
              name="accountNumber"
              style="
                padding:12px 14px;
                border:1.5px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
                transition:all 0.2s ease-in-out;
                outline:none;
              "
            />
      
            <span
              style="
                display:none;
                margin-top:4px;
                font-size:12px;
                color:#d70000;
              "
            >Invalid PO number</span>
          </div>
      
          <!-- Routing Number -->
          <div style="display:flex; flex-direction:column; width:100%;">
            <label for="purchaseOrderForm-routingNumber"
              style="font-size:14px; font-weight:600; color:#333; margin-bottom:6px;"
            >
              Routing number
            </label>
      
            <input
              type="text"
              id="purchaseOrderForm-routingNumber"
              name="routingNumber"
              style="
                padding:12px 14px;
                border:1.5px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
                transition:all 0.2s ease-in-out;
                outline:none;
              "
            />
      
            <span
              style="
                display:none;
                margin-top:4px;
                font-size:12px;
                color:#d70000;
              "
            >Invalid Invoice memo</span>
          </div>
      
          ${payButton}
      
        </form>
      </div>
      `;
      
}

}
