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
  private showPayButton = false;

  private clientKey = "";
  private customer: any = {};

  constructor(baseOptions: BaseOptions, options: ComponentOptions) {
    super(PaymentMethod.creditcard, baseOptions, options);
    this.showPayButton = options?.showPayButton ?? false;
  }

  /* =========================================================================
     MOUNT
  ========================================================================= */
  async mount(selector: string) {
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
        (window as any).NovalnetUtility?.getPanHash();
      };
    }

    document.addEventListener("click", (event: any) => {
      if (
        event?.target?.name === "payment-selector-list" &&
        event.target.value?.startsWith("creditcard-")
      ) {
        this.initialize(payButton);
      }
    });
  }

  /* =========================================================================
     INITIALIZE (ONLY ONCE)
  ========================================================================= */
  private async initialize(payButton: HTMLButtonElement | null) {
    if (this.initialized) return;
    this.initialized = true;

    try {
      await this.loadNovalnetScript();
      await this.getClientKey();
      await this.loadCustomerAddress();
      await this.initIframe(payButton);
    } catch (err) {
      console.error("Creditcard init failed:", err);
      this.onError?.("Failed to initialize credit card form.");
    }
  }

  /* =========================================================================
     TEMPLATE
  ========================================================================= */
  private template() {
    const payButton = this.showPayButton
      ? `<button id="purchaseOrderForm-paymentButton"
                 class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}">
           Pay
         </button>`
      : "";

    return `
      <div class="${styles.wrapper}">
        <div id="novalnet_iframe" style="width:100%; min-height:180px;"></div>
        ${payButton}
      </div>
    `;
  }

  /* =========================================================================
     LOAD NOVALNET SCRIPT (SPA SAFE)
  ========================================================================= */
  private loadNovalnetScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).NovalnetUtility) return resolve();

      const script = document.createElement("script");
      script.src = "https://cdn.novalnet.de/js/v2/NovalnetUtility.js";
      script.async = true;

      script.onload = () => resolve();
      script.onerror = () => reject("Failed to load NovalnetUtility");

      document.head.appendChild(script);
    });
  }

  /* =========================================================================
     GET CLIENT KEY
  ========================================================================= */
  private async getClientKey() {
    const res = await fetch(this.processorUrl + "/getconfig", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        paymentMethod: { type: "CREDITCARD" },
        paymentOutcome: "AUTHORIZED",
      }),
    });

    const json = await res.json();
    if (!json?.paymentReference) {
      throw new Error("Missing clientKey");
    }

    this.clientKey = String(json.paymentReference);
    (window as any).NovalnetUtility.setClientKey(this.clientKey);
  }

  /* =========================================================================
     LOAD CUSTOMER DETAILS
  ========================================================================= */
  private async loadCustomerAddress() {
    try {
      const requestData = {
        paymentMethod: { type: "CREDITCARD" },
        paymentOutcome: "AUTHORIZED",
      };
    
      const body = JSON.stringify(requestData);
      console.log("Outgoing body string:", body);
      const currentCartId = window.localStorage.getItem('cartId');
      console.log(currentCartId ?? 'not-current-cart-id');

      const currentCartId2 = window.localStorage.getItem('cart-id');
      console.log(currentCartId2 ?? 'not-current-cart-id2');
      console.log(this.sessionId ?? 'sessionId');

      const response = await fetch(this.processorUrl + "/getCustomerAddress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Session-Id": this.sessionId, 
        },
        body,
      });
    
      console.log("Network response status:", response.status, response.statusText, "type:", response.type);
    
      // Inspect content-type header before parsing
      const contentType = response.headers.get("Content-Type") ?? response.headers.get("content-type");
      console.log("Response Content-Type:", contentType);
    
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.warn("getconfig returned non-200:", response.status, text);
      } else if (contentType && contentType.includes("application/json")) {
        const json = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err);
          return null;
        });
        console.log("parsed response JSON:", json);
    
        if (json && json.firstName) {
          this.firstName = String(json.firstName);
          this.lastName = String(json.lastName);
          this.email = String(json.email);
          this.json = json;
          console.log("Customer Address set from server:", this.firstName);
          console.log(String(json.billingAddress.firstName));
          console.log(String(json.shippingAddress.lastName));
        } else {
          console.warn("JSON response missing paymentReference:", json);
        }
      } else {
        // fallback: treat as plain text
        const text = await response.text().catch(() => "");
        console.log("Response text (non-JSON):", text);
      }
    } catch (err) {
      console.warn("initPaymentProcessor: getconfig fetch failed (non-fatal):", err);
    }
  }

  /* =========================================================================
     INIT CREDIT CARD IFRAME
  ========================================================================= */
  private async initIframe(payButton: HTMLButtonElement | null) {
    const NovalnetUtility = (window as any).NovalnetUtility;

    const config = {
      iframe: {
        id: "novalnet_iframe",
        inline: 1,
      },

      customer: {
        first_name: this.firstName,
        last_name: this.lastName,
        email: this.email,
        billing: {
          street: String(this.json.billingAddress.streetName),
          city: String(this.json.billingAddress.city),
          zip: String(this.json.billingAddress.postalCode),
          country_code: String(this.json.billingAddress.country),
        },
        shipping: {
          same_as_billing: 1,
          first_name: String(this.json.billingAddress.firstName),
          last_name: String(this.json.billingAddress.lastName),
          street: String(this.json.billingAddress.streetName),
          city: String(this.json.billingAddress.city),
          zip: String(this.json.billingAddress.postalCode),
          country_code: String(this.json.billingAddress.country),
        },
      },

      callback: {
        on_success: async (data: any) => {
          try {
            if (!data?.hash || !data?.unique_id) {
              this.onError("Invalid card details.");
              return;
            }

            const payload: PaymentRequestSchemaDTO = {
              paymentMethod: {
                type: "CREDITCARD",
                panHash: data.hash,
                uniqueId: data.unique_id,
              },
              paymentOutcome: PaymentOutcome.AUTHORIZED,
            };
             console.log('panhash'); 
             console.log(panHash); 
             console.log(uniqueId); 
            const res = await fetch(this.processorUrl + "/payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Session-Id": this.sessionId,
              },
              body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (json?.paymentReference) {
              this.onComplete?.({
                isSuccess: true,
                paymentReference: json.paymentReference,
              });
            } else {
              this.onError("Payment failed.");
            }
          } catch (e) {
            console.error("Payment error:", e);
            this.onError("Payment failed.");
          }
        },

        on_error: () => {
          if (payButton) payButton.disabled = true;
          this.onError("Invalid credit card information.");
        },
      },
    };

    NovalnetUtility.createCreditCardForm(config);
  }
}
