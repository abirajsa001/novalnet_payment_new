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
      document.addEventListener("click", (event) => {
        const el = event.target;
      
        if (el?.name === "payment-selector-list") {
          if (el.value.startsWith("creditcard-")) {
            this.initialize(payButton);
          }
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
          await this.getConfigValues();
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
    // initialize sdk for the request if needed
    try {
      this.sdk.init({ environment: this.environment });
    } catch (e) {
      console.warn("SDK init failed (continuing):", e);
    }

    try {
      const panhashInput = document.getElementById("pan_hash") as HTMLInputElement | null;
      const uniqueIdInput = document.getElementById("unique_id") as HTMLInputElement | null;
      const doRedirectInput = document.getElementById("do_redirect") as HTMLInputElement | null;

      const panhash = panhashInput?.value?.trim() ?? "";
      const uniqueId = uniqueIdInput?.value?.trim() ?? "";
      const doRedirect = doRedirectInput?.value?.trim() ?? "";

      console.log("PAN HASH:", panhash);
      console.log("UNIQUE ID:", uniqueId);
      console.log("DO REDIRECT:", doRedirect);

      if (!panhash || !uniqueId) {
        this.onError("Credit card information is missing or invalid.");
        return;
      }

      const requestData: PaymentRequestSchemaDTO = {
        paymentMethod: {
          type: "CREDITCARD",
          panHash: panhash,
          uniqueId: uniqueId,
          doRedirect: doRedirect,
        },
        paymentOutcome: PaymentOutcome.AUTHORIZED,
      };

      const response = await fetch(this.processorUrl + "/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        console.error("Payment endpoint returned non-200:", response.status);
        const text = await response.text().catch(() => "");
        console.error("Payment response body:", text);
        this.onError("Payment failed. Please try again.");
        return;
      }

      const data = await response.json().catch((e) => {
        console.error("Failed parsing payment response JSON:", e);
        return null;
      });

      if (data && data.paymentReference) {
        this.onComplete?.({
          isSuccess: true,
          paymentReference: data.paymentReference,
        });
      } else {
        console.warn("Payment response missing paymentReference:", data);
        this.onError("Payment failed. Please try again.");
      }
    } catch (e) {
      console.error("submit() error:", e);
      this.onError("Some error occurred. Please try again.");
    }
  }
  /* =========================================================================
     TEMPLATE
  ========================================================================= */
  private template() {
    const payButton = this.showPayButton
      ? `<button class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}" id="purchaseOrderForm-paymentButton">Pay</button>`
      : "";

    return `
      <div class="${styles.wrapper}">
          <iframe id="novalnet_iframe" frameborder="0" scrolling="no"></iframe>
          <input type="hidden" id="pan_hash" name="pan_hash"/>
          <input type="hidden" id="unique_id" name="unique_id"/>
          <input type="hidden" id="do_redirect" name="do_redirect"/>
          ${payButton}
      </div>
    `;
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
  private async getConfigValues() {
    try {
      const requestData = {
        paymentMethod: { type: "CREDITCARD" },
        paymentOutcome: "AUTHORIZED",
      };
    
      const body = JSON.stringify(requestData);
      console.log("Outgoing body string:", body);
    
      const response = await fetch(this.processorUrl + "/getconfig", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          // no X-Session-Id for public client call
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
    
        if (json && json.paymentReference) {
          this.clientKey = String(json.paymentReference);
          console.log("Client key set from server:", this.clientKey);
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
      if (!this.clientKey) throw new Error("Missing clientKey");

      const NovalnetUtility = (window as any).NovalnetUtility;
      NovalnetUtility.setClientKey(this.clientKey);
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
      };

      NovalnetUtility.createCreditCardForm(config);
  }
}
