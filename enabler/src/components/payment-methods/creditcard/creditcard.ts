import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod,
} from "../../../payment-enabler/payment-enabler";

import { BaseComponent } from "../../base";
import styles from "../../../style/style.module.scss";
import buttonStyles from "../../../style/button.module.scss";

import {
  PaymentOutcome,
  PaymentRequestSchemaDTO,
} from "../../../dtos/mock-payment.dto";

import { BaseOptions } from "../../../payment-enabler/payment-enabler-mock";

/* ============================================================================
 BUILDER
============================================================================ */
export class CreditcardBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;

  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
      return new Creditcard(this.baseOptions, config);
  }
}

/* ============================================================================
 CREDIT CARD COMPONENT
============================================================================ */
export class Creditcard extends BaseComponent {
  private initialized = false;
  private clientKey: string = "";
  private showPayButton = false;
  private customer: any = {};

  constructor(baseOptions: BaseOptions, options: ComponentOptions) {
      super(PaymentMethod.creditcard, baseOptions, options);
      this.showPayButton = options?.showPayButton ?? false;
  }

  /* =========================================================================
     MOUNT — Only renders template, does *NOT* init Novalnet
  ========================================================================= */
  mount(selector: string) {
      if (typeof window === "undefined") return;

      const root = document.querySelector(selector);
      if (!root) {
          console.error("Creditcard mount selector not found:", selector);
          return;
      }

      root.insertAdjacentHTML("afterbegin", this.template());

      const payButton = document.getElementById(
          "purchaseOrderForm-paymentButton"
      ) as HTMLButtonElement | null;

      if (this.showPayButton && payButton) {
          payButton.disabled = true;
          payButton.onclick = (e) => {
              e.preventDefault();
              this.submit();
          };
      }

      // Wait for user to select "creditcard"
      document.addEventListener("payment-method-selected", (event: any) => {
          if (event?.detail?.method === "creditcard") {
              this.initialize(payButton);
          }
      });
  }

  /* =========================================================================
     INITIALIZE (only once)
  ========================================================================= */
  private async initialize(payButton: HTMLButtonElement | null) {
      if (this.initialized) return;
      this.initialized = true;

      try {
          await this.loadNovalnetScript();
          await this.loadConfig();
          await this.loadCustomerAddress();
          await this.initIframe(payButton);
      } catch (err) {
          console.error("Creditcard initialization failed:", err);
          this.onError?.("Failed to load credit card form.");
      }
  }

  /* =========================================================================
     SUBMIT — called after panHash is generated
  ========================================================================= */
  async submit() {
      try {
          const panHash = (document.getElementById("pan_hash") as HTMLInputElement)?.value;
          const uniqueId = (document.getElementById("unique_id") as HTMLInputElement)?.value;

          if (!panHash || !uniqueId) {
              this.onError("Invalid or missing card token.");
              return;
          }

          const payload: PaymentRequestSchemaDTO = {
              paymentMethod: {
                  type: "CREDITCARD",
                  panHash,
                  uniqueId,
              },
              paymentOutcome: PaymentOutcome.AUTHORIZED,
          };

          const res = await fetch(this.processorUrl + "/payment", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  "X-Session-Id": this.sessionId,
              },
              body: JSON.stringify(payload),
          });

          if (!res.ok) {
              this.onError("Payment failed.");
              return;
          }

          const json = await res.json();

          if (json?.paymentReference) {
              this.onComplete?.({
                  isSuccess: true,
                  paymentReference: json.paymentReference,
              });
          } else {
              this.onError("Payment failed.");
          }
      } catch (err) {
          this.onError("Unexpected error occurred.");
      }
  }

  /* =========================================================================
     TEMPLATE
  ========================================================================= */
  private template() {
      return `
      <div class="${styles.wrapper}">
          <iframe id="novalnet_iframe" frameborder="0" scrolling="no"></iframe>

          <input type="hidden" id="pan_hash" />
          <input type="hidden" id="unique_id" />

          ${
              this.showPayButton
                  ? `<button id="purchaseOrderForm-paymentButton" class="${buttonStyles.button} ${buttonStyles.fullWidth}">
                      Pay
                    </button>`
                  : ""
          }
      </div>`;
  }

  /* =========================================================================
     LOAD Novalnet JS (only once)
  ========================================================================= */
  private loadNovalnetScript(): Promise<void> {
      return new Promise((resolve, reject) => {
          if ((window as any).NovalnetUtility) return resolve();

          const script = document.createElement("script");
          script.src = "https://cdn.novalnet.de/js/v2/NovalnetUtility-1.1.2.js";

          script.onload = () => resolve();
          script.onerror = () => reject("Novalnet script failed to load");

          document.head.appendChild(script);
      });
  }

  /* =========================================================================
     LOAD CONFIG (must contain clientKey)
  ========================================================================= */
  private async loadConfig() {
      const res = await fetch(this.processorUrl + "/getconfig", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethod: { type: "CREDITCARD" } }),
      });

      const json = await res.json();

      this.clientKey = json?.clientKey;
      if (!this.clientKey) throw new Error("Missing clientKey");

      const NovalnetUtility = (window as any).NovalnetUtility;
      NovalnetUtility.setClientKey(this.clientKey);
  }

  /* =========================================================================
     LOAD CUSTOMER DETAILS
  ========================================================================= */
  private async loadCustomerAddress() {
      const res = await fetch(this.processorUrl + "/getCustomerAddress", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "X-Session-Id": this.sessionId,
          },
          body: JSON.stringify({ paymentMethod: { type: "CREDITCARD" } }),
      });

      this.customer = res.ok ? await res.json() : {};
  }

  /* =========================================================================
     INIT CREDIT CARD IFRAME
  ========================================================================= */
  private async initIframe(payButton: HTMLButtonElement | null) {
      const NovalnetUtility = (window as any).NovalnetUtility;

      const config = {
          callback: {
              on_success: (data: any) => {
                  (document.getElementById("pan_hash") as HTMLInputElement).value = data.hash;
                  (document.getElementById("unique_id") as HTMLInputElement).value = data.unique_id;
                  if (payButton) payButton.disabled = false;
              },
              on_error: () => {
                  if (payButton) payButton.disabled = true;
              },
          },
          iframe: {
              id: "novalnet_iframe",
              inline: 1,
          },
          customer: {
              first_name: this.customer?.firstName ?? "",
              last_name: this.customer?.lastName ?? "",
              email: this.customer?.email ?? "",
              billing: {
                  street: this.customer?.billingAddress?.streetName ?? "",
                  city: this.customer?.billingAddress?.city ?? "",
                  zip: this.customer?.billingAddress?.postalCode ?? "",
                  country_code: this.customer?.billingAddress?.country ?? "",
              },
              shipping: {
                  same_as_billing: 1,
              },
          },
      };

      NovalnetUtility.createCreditCardForm(config);
  }
}
