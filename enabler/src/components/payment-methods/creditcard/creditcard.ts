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

/* -----------------------------------------------------------
   BUILDER
----------------------------------------------------------- */
export class CreditcardBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;

  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
    return new Creditcard(this.baseOptions, config);
  }
}

/* -----------------------------------------------------------
   CREDIT CARD COMPONENT
----------------------------------------------------------- */
export class Creditcard extends BaseComponent {
  private showPayButton: boolean;
  private clientKey?: string;
  private initialized = false; // prevent multiple init

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.creditcard, baseOptions, componentOptions);
    this.showPayButton = componentOptions?.showPayButton ?? false;
  }

  /* -----------------------------------------------------------
     MOUNT — DISPLAY TEMPLATE ONLY
----------------------------------------------------------- */
  mount(selector: string) {
    if (typeof window === "undefined") return;

    const root = document.querySelector(selector);
    if (!root) {
      console.error("Mount selector not found:", selector);
      return;
    }

    root.insertAdjacentHTML("afterbegin", this._getTemplate());

    const payButton = document.querySelector(
      "#purchaseOrderForm-paymentButton"
    ) as HTMLButtonElement | null;

    if (this.showPayButton && payButton) {
      payButton.disabled = true;
      payButton.addEventListener("click", async (e) => {
        e.preventDefault();
        await this.submit();
      });
    }

    /* -----------------------------------------------------------
       DO NOT AUTO-INITIALIZE
       Instead, wait for "creditcard" selection event
----------------------------------------------------------- */
    document.addEventListener("payment-method-selected", (event: any) => {
      if (event.detail?.method === "creditcard") {
        this.initializeCreditCard(payButton);
      }
    });

    /* -----------------------------------------------------------
       Optional — confirm button integration
----------------------------------------------------------- */
    const reviewOrderButton = document.querySelector(
      '[data-ctc-selector="confirmMethod"]'
    );
    if (reviewOrderButton) {
      reviewOrderButton.addEventListener("click", async (event) => {
        event.preventDefault();
        const NovalnetUtility = (window as any).NovalnetUtility;
        if (NovalnetUtility?.getPanHash) {
          await NovalnetUtility.getPanHash();
        }
      });
    }
  }

  /* -----------------------------------------------------------
     INIT ONLY WHEN CREDIT CARD TAB IS CLICKED
----------------------------------------------------------- */
  private async initializeCreditCard(payButton: HTMLButtonElement | null) {
    if (this.initialized) {
      console.log("Credit Card already initialized — skipping");
      return;
    }
    this.initialized = true;

    await this._loadNovalnetScriptOnce();
    await this._initNovalnetCreditCardForm(payButton);
  }

  /* -----------------------------------------------------------
     SUBMIT (EXECUTES AFTER PANHASH IS READY)
----------------------------------------------------------- */
  async submit() {
    try {
      this.sdk.init({ environment: this.environment });
    } catch (_) {}

    try {
      const panhash =
        (document.getElementById("pan_hash") as HTMLInputElement)?.value ??
        "";
      const uniqueId =
        (document.getElementById("unique_id") as HTMLInputElement)?.value ??
        "";
      const doRedirect =
        (document.getElementById("do_redirect") as HTMLInputElement)?.value ??
        "";

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
        this.onError("Payment failed. Please try again.");
        return;
      }

      const data = await response.json().catch(() => null);
      if (data?.paymentReference) {
        this.onComplete?.({
          isSuccess: true,
          paymentReference: data.paymentReference,
        });
      } else {
        this.onError("Payment failed. Please try again.");
      }
    } catch (e) {
      this.onError("Some error occurred. Please try again.");
    }
  }

  /* -----------------------------------------------------------
     TEMPLATE
----------------------------------------------------------- */
  private _getTemplate() {
    const payButton = this.showPayButton
      ? `<button class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}" id="purchaseOrderForm-paymentButton">Pay</button>`
      : "";

    return `
      <div class="${styles.wrapper}">
          <iframe id="novalnet_iframe" frameborder="0" scrolling="no"></iframe>
          <input type="hidden" id="pan_hash" />
          <input type="hidden" id="unique_id" />
          <input type="hidden" id="do_redirect" />
          ${payButton}
      </div>
    `;
  }

  /* -----------------------------------------------------------
     LOAD SCRIPT ONCE
----------------------------------------------------------- */
  private async _loadNovalnetScriptOnce(): Promise<void> {
    if ((window as any).NovalnetUtility) return;

    const src = "https://cdn.novalnet.de/js/v2/NovalnetUtility-1.1.2.js";
    const existing = document.querySelector(`script[src="${src}"]`);

    if (existing && (existing as any)._nnLoadingPromise) {
      await (existing as any)._nnLoadingPromise;
      return;
    }

    const script = document.createElement("script");
    script.src = src;

    const loadPromise = new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
    });

    (script as any)._nnLoadingPromise = loadPromise;
    document.head.appendChild(script);

    await loadPromise;
  }

  /* -----------------------------------------------------------
     INIT CREDIT CARD IFRAME + CUSTOMER DATA
----------------------------------------------------------- */
  private async _initNovalnetCreditCardForm(
    payButton: HTMLButtonElement | null
  ) {
    const NovalnetUtility = (window as any).NovalnetUtility;
    if (!NovalnetUtility) return;

    /* -----------------------------
       Fetch config
    ----------------------------- */
    try {
      const response = await fetch(this.processorUrl + "/getconfig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: { type: "CREDITCARD" },
          paymentOutcome: "AUTHORIZED",
        }),
      });

      const json = response.ok ? await response.json() : null;
      if (json?.paymentReference) {
        this.clientKey = json.paymentReference;
      }
    } catch (e) {
      console.warn("getconfig failed", e);
    }

    /* -----------------------------
       Fetch customer address
    ----------------------------- */
    try {
      const response = await fetch(this.processorUrl + "/getCustomerAddress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify({
          paymentMethod: { type: "CREDITCARD" },
          paymentOutcome: "AUTHORIZED",
        }),
      });

      const json = response.ok ? await response.json() : null;

      if (json?.firstName) {
        this.firstName = json.firstName;
        this.lastName = json.lastName;
        this.email = json.email;
        this.json = json;
      }
    } catch (e) {
      console.warn("getCustomerAddress failed", e);
    }

    /* -----------------------------
       Set Client Key
    ----------------------------- */
    try {
      NovalnetUtility.setClientKey(this.clientKey);
    } catch (e) {}

    /* -----------------------------
       Iframe config
    ----------------------------- */
    const config = {
      callback: {
        on_success: (data: any) => {
          (document.getElementById("pan_hash") as HTMLInputElement).value =
            data.hash ?? "";
          (document.getElementById("unique_id") as HTMLInputElement).value =
            data.unique_id ?? "";
          (document.getElementById("do_redirect") as HTMLInputElement).value =
            data.do_redirect ?? "";

          if (payButton) payButton.disabled = false;
          return true;
        },
        on_error: (data: any) => {
          alert(data?.error_message ?? "Card error");
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
          street: this.json?.billingAddress?.streetName ?? "",
          city: this.json?.billingAddress?.city ?? "",
          zip: this.json?.billingAddress?.postalCode ?? "",
          country_code: this.json?.billingAddress?.country ?? "",
        },
        shipping: {
          same_as_billing: 1,
        },
      },
    };

    NovalnetUtility.createCreditCardForm(config);
  }
}
