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

    const accountHolder = accountHolderInput?.value.trim() ?? '';
    const iban = ibanInput?.value.trim() ?? '';
    const bic = bicInput?.value.trim() ?? '';

    console.log('Account Holder:', accountHolder);
    console.log('IBAN:', iban);
    console.log('bic:', bic);

      const requestData: PaymentRequestSchemaDTO = {
        paymentMethod: {
          type: "DIRECT_DEBIT_SEPA",
          accHolder: accountHolder,
          iban: iban,
          bic: bic,
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
      ? `<button class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}" 
           id="purchaseOrderForm-paymentButton">Pay</button>`
      : "";
  
    return `
      <div style="width:100%; display:flex; flex-direction:column;">
        <script type="text/javascript" src="https://cdn.novalnet.de/js/v2/NovalnetUtility.js"></script>
  
        <form id="nn_sepa_form"
          style="
            width:100%;
            display:flex;
            flex-direction:column;
            gap:20px;
          "
        >
  
          <!-- Account Holder -->
          <div style="display:flex; flex-direction:column; width:100%;">
            <label for="nn_account_holder"
              style="font-size:14px; font-weight:600; color:#333; margin-bottom:6px;"
            >
              Account Holder <span style="color:red;">*</span>
            </label>
  
            <input
              type="text"
              id="nn_account_holder"
              name="nn_account_holder"
              style="
                padding:12px 14px;
                border:1.5px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
                transition:all 0.2s ease-in-out;
              "
            />
  
            <span
              style="
                display:none;
                margin-top:4px;
                font-size:12px;
                color:#d70000;
              "
            >Invalid account holder</span>
          </div>
  
          <!-- IBAN -->
          <div style="display:flex; flex-direction:column; width:100%;">
            <label for="nn_sepa_account_no"
              style="font-size:14px; font-weight:600; color:#333; margin-bottom:6px;"
            >
              IBAN <span style="color:red;">*</span>
            </label>
  
            <input
              type="text"
              id="nn_sepa_account_no"
              name="nn_sepa_account_no"
              size="32"
              autocomplete="off"
              onkeypress="return NovalnetUtility.checkIban(event, 'bic_div');"
              onkeyup="return NovalnetUtility.formatIban(event, 'bic_div');"
              onchange="return NovalnetUtility.formatIban(event, 'bic_div');"
              style="
                padding:12px 14px;
                border:1.5px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
                text-transform:uppercase;
                transition:all 0.2s ease-in-out;
              "
            />
  
            <span
              style="
                display:none;
                margin-top:4px;
                font-size:12px;
                color:#d70000;
              "
            >Invalid IBAN</span>
          </div>
  
          <!-- BIC FIELD -->
          <div id="bic_div" style="display:none; flex-direction:column; width:100%;">
            <label for="nn_sepa_bic"
              style="font-size:14px; font-weight:600; color:#333; margin-bottom:6px;"
            >
              BIC <span style="color:red;">*</span>
            </label>
  
            <input
              type="text"
              id="nn_sepa_bic"
              name="nn_sepa_bic"
              size="32"
              autocomplete="off"
              onkeypress="return NovalnetUtility.formatBic(event);"
              onchange="return NovalnetUtility.formatBic(event);"
              style="
                padding:12px 14px;
                border:1.5px solid #d4d4d4;
                border-radius:6px;
                font-size:15px;
                transition:all 0.2s ease-in-out;
              "
            />
  
            <span
              style="
                display:none;
                margin-top:4px;
                font-size:12px;
                color:#d70000;
              "
            >Invalid BIC</span>
          </div>
  <img id="creditCardForm-visa" src="https://www.visa.co.in/dam/VCOM/regional/ap/india/global-elements/images/in-visa-classic-card-498x280.png" width="23" height="16" alt="">
          ${payButton}
  
        </form>
      </div>
    `;
  }
}
