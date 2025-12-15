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
} from "../../../dtos/mock-payment.dto";
import { BaseOptions } from "../../../payment-enabler/payment-enabler-mock";

export class SepaBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;
  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
    return new Sepa(this.baseOptions, config);
  }
}

export class Sepa extends BaseComponent {
  private showPayButton: boolean;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.sepa, baseOptions, componentOptions);
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
    console.log('submit-triggered');
    try {
      // start original
     const accountHolderInput = document.getElementById('nn_account_holder') as HTMLInputElement;
    const ibanInput = document.getElementById('nn_sepa_account_no') as HTMLInputElement;
    const bicInput = document.getElementById('nn_sepa_bic') as HTMLInputElement;

    const accountHolder = accountHolderInput?.value.trim();
    const iban = ibanInput?.value.trim();
    const bic = bicInput?.value.trim();

    console.log('Account Holder:', accountHolder);
    console.log('IBAN:', iban);
    console.log('bic:', bic);

      const requestData: PaymentRequestSchemaDTO = {
        paymentMethod: {
          type: "DIRECT_DEBIT_SEPA",
          poNumber: accountHolder,
          invoiceMemo: iban,
        },
        paymentOutcome: PaymentOutcome.AUTHORIZED,
      };
      console.log('requestData');
      console.log(requestData);
     
      const response = await fetch(this.processorUrl + "/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify(requestData),
      });
      console.log('responseData-newdata');
      console.log(response);
      const data = await response.json();
      console.log(data);
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
    <div class="${styles.wrapper}">
      <form class="${styles.paymentForm}" id="purchaseOrderForm">
        <div class="inputContainer">
          <label class="inputLabel" for="nn_account_holder">
            Acoount Holder <span aria-hidden="true"> *</span>
          </label>
          <input class="inputField" type="text" id="nn_account_holder" name="nn_account_holder" value="">
          <span class="hidden errorField">Invalid PO number</span>
        </div>

        <div class="inputContainer">
          <label class="inputLabel" for="purchaseOrderForm-invoiceMemo">
            IBAN
          </label>
          <input class="inputField" type="text" id="nn_sepa_account_no" name="nn_sepa_account_no" size="32" autocomplete="off" onkeypress="return NovalnetUtility.checkIban(event, 'bic_div');" onkeyup="return NovalnetUtility.formatIban(event, 'bic_div');" onchange="return NovalnetUtility.formatIban(event, 'bic_div');" style="text-transform:uppercase;">
          <span class="hidden errorField">Invalid Iban feild</span>
        </div>

        <div class="inputContainer" id="bic_div" role="group" style="display:none;"> 
          <label class="inputLabel" for="purchaseOrderForm-invoiceMemo">
            BIC
          </label>
          <input class="inputField" type="text" name="nn_sepa_bic" id="nn_sepa_bic" size="32" autocomplete="off" onkeypress="return NovalnetUtility.formatBic(event);" onchange="return NovalnetUtility.formatBic(event);">
          <span class="hidden errorField">Invalid BIC feild</span>
        </div>

        ${payButton}
      </form>
      <script type="text/javascript" src="https://cdn.novalnet.de/js/v2/NovalnetUtility.js"></script>
    </div>
  `;
}

}
