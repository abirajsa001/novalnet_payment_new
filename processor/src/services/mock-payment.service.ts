import {
  statusHandler,
  healthCheckCommercetoolsPermissions,
  Cart,
  ErrorRequiredField,
  TransactionType,
  TransactionState,
  ErrorInvalidOperation,
} from '@commercetools/connect-payments-sdk';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  ReversePaymentRequest,
  StatusResponse,
} from './types/operation.type';

import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import packageJSON from '../../package.json';

import { AbstractPaymentService } from './abstract-payment.service';
import { getConfig } from '../config/config';
import { appLogger, paymentSDK } from '../payment-sdk';
import { CreatePaymentRequest, MockPaymentServiceOptions } from './types/mock-payment.type';
import { PaymentMethodType, PaymentOutcome, PaymentResponseSchemaDTO } from '../dtos/mock-payment.dto';
import { getCartIdFromContext, getPaymentInterfaceFromContext } from '../libs/fastify/context/context';
import { randomUUID } from 'crypto';
import { TransactionDraftDTO, TransactionResponseDTO } from '../dtos/operations/transaction.dto';
import { log } from '../libs/logger';

export class MockPaymentService extends AbstractPaymentService {
  constructor(opts: MockPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService);
  }

  /**
   * Get configurations
   *
   * @remarks
   * Implementation to provide mocking configuration information
   *
   * @returns Promise with mocking object containing configuration information
   */
  public async config(): Promise<ConfigResponse> {
    const config = getConfig();
    console.log('config');
    log.info('config');
    console.log(config);
    return {
      clientKey: config.mockClientKey,
      environment: config.mockEnvironment,
    };
  }

  /**
   * Get status
   *
   * @remarks
   * Implementation to provide mocking status of external systems
   *
   * @returns Promise with mocking data containing a list of status from different external systems
   */
  public async status(): Promise<StatusResponse> {
    const handler = await statusHandler({
      timeout: getConfig().healthCheckTimeout,
      log: appLogger,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions: [
            'manage_payments',
            'view_sessions',
            'view_api_clients',
            'manage_orders',
            'introspect_oauth_tokens',
            'manage_checkout_payment_intents',
            'manage_types',
          ],
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: getConfig().projectKey,
        }),
        async () => {
          try {
            const paymentMethods = 'card';
            return {
              name: 'Mock Payment API',
              status: 'UP',
              message: 'Mock api is working',
              details: {
                paymentMethods,
              },
            };
          } catch (e) {
            return {
              name: 'Mock Payment API',
              status: 'DOWN',
              message: 'The mock payment API is down for some reason. Please check the logs for more details.',
              details: {
                // TODO do not expose the error
                error: e,
              },
            };
          }
        },
      ],
      metadataFn: async () => ({
        name: packageJSON.name,
        description: packageJSON.description,
        '@commercetools/connect-payments-sdk': packageJSON.dependencies['@commercetools/connect-payments-sdk'],
      }),
    })();
console.log('status-handler');
    log.info('status-handler');
    return handler.body;
  }

  /**
   * Get supported payment components
   *
   * @remarks
   * Implementation to provide the mocking payment components supported by the processor.
   *
   * @returns Promise with mocking data containing a list of supported payment components
   */
  public async getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO> {
    return {
      dropins: [],
      components: [
        {
          type: PaymentMethodType.CARD,
        },
        {
          type: PaymentMethodType.INVOICE,
        },
        {
          type: PaymentMethodType.PREPAYMENT,
        },
      ],
    };
  }

  /**
   * Capture payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment capture in external PSPs
   *
   * @param request - contains the amount and {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  public async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: 'Charge',
        amount: request.amount,
        interactionId: request.payment.interfaceId,
        state: 'Success',
      },
    });
    console.log('capture-payment');
    log.info('capture-payment');
    return { outcome: PaymentModificationStatus.APPROVED, pspReference: request.payment.interfaceId as string };
  }

  /**
   * Cancel payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment cancel in external PSPs
   *
   * @param request - contains {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  public async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: 'CancelAuthorization',
        amount: request.payment.amountPlanned,
        interactionId: request.payment.interfaceId,
        state: 'Success',
      },
    });
    return { outcome: PaymentModificationStatus.APPROVED, pspReference: request.payment.interfaceId as string };
  }

  /**
   * Refund payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment refund in external PSPs
   *
   * @param request - contains amount and {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  public async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: 'Refund',
        amount: request.amount,
        interactionId: request.payment.interfaceId,
        state: 'Success',
      },
    });
    return { outcome: PaymentModificationStatus.APPROVED, pspReference: request.payment.interfaceId as string };
  }

  /**
   * Reverse payment
   *
   * @remarks
   * Abstract method to execute payment reversals in support of automated reversals to be triggered by checkout api. The actual invocation to PSPs should be implemented in subclasses
   *
   * @param request
   * @returns Promise with outcome containing operation status and PSP reference
   */
  public async reversePayment(request: ReversePaymentRequest): Promise<PaymentProviderModificationResponse> {
    const hasCharge = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'Charge',
      states: ['Success'],
    });
    const hasRefund = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'Refund',
      states: ['Success', 'Pending'],
    });
    const hasCancelAuthorization = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'CancelAuthorization',
      states: ['Success', 'Pending'],
    });

    const wasPaymentReverted = hasRefund || hasCancelAuthorization;

    if (hasCharge && !wasPaymentReverted) {
      return this.refundPayment({
        payment: request.payment,
        merchantReference: request.merchantReference,
        amount: request.payment.amountPlanned,
      });
    }

    const hasAuthorization = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'Authorization',
      states: ['Success'],
    });
    if (hasAuthorization && !wasPaymentReverted) {
      return this.cancelPayment({ payment: request.payment });
    }

    throw new ErrorInvalidOperation('There is no successful payment transaction to reverse.');
  }

  public async ctcc(cart: Cart) {
     const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart });
     return deliveryAddress;
   }

  public async ctbb(cart: Cart) {
    const billingAddress = cart.billingAddress;
    return billingAddress;
  }
  
  /**
   * Create payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment creation in external PSPs
   *
   * @param request - contains paymentType defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  public async createPayment(request: CreatePaymentRequest): Promise<PaymentResponseSchemaDTO> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });
    const deliveryAddress = await this.ctcc(ctCart);
    const billingAddress  = await this.ctbb(ctCart);
    const parsedCart = typeof ctCart === 'string' ? JSON.parse(ctCart) : ctCart;
      // 🔐 Call Novalnet API server-side (no CORS issue)
	const novalnetPayload = {
	  merchant: {
	    signature: String(getConfig()?.novalnetPrivateKey ?? '7ibc7ob5|tuJEH3gNbeWJfIHah||nbobljbnmdli0poys|doU3HJVoym7MQ44qf7cpn7pc'),
	    tariff: String(getConfig()?.novalnetTariff ?? '10004'),
	  },
	  customer: {
	    billing: {
	      city: String(billingAddress?.city ?? 'demo'),
	      country_code: String(billingAddress?.country ?? 'US'),
	      house_no: String(billingAddress?.streetName ?? '10'),
	      street: String(billingAddress?.streetName ?? 'teststreet'),
	      zip: String(billingAddress?.postalCode ?? '12345'),
	    },
	    shipping: {
	      city: String(deliveryAddress?.city ?? 'demoshipping'),
	      country_code: String(deliveryAddress?.country ?? 'US'),
	      house_no: String(deliveryAddress?.streetName ?? '11'),
	      street: String(deliveryAddress?.streetName ?? 'testshippingstreet'),
	      zip: String(deliveryAddress?.postalCode ?? '12345'),
	    },
	    first_name: 'Max',
	    last_name: 'Mustermann',
	    email: 'yogarajan_r@@novalnetsolutions.com',
	  },
	  transaction: {
	    test_mode: '1',
	    payment_type: 'PREPAYMENT',
	    amount: '123',
	    currency: 'EUR',
	  },
	  custom: {
	    input1: 'checking',
	    inputval1: 'check value',
	  }
	};

	  const novalnetResponse = await fetch('https://payport.novalnet.de/v2/payment', {
	    method: 'POST',
	    headers: {
	      'Content-Type': 'application/json',
	      'Accept': 'application/json',
	      'X-NN-Access-Key': 'YTg3ZmY2NzlhMmYzZTcxZDkxODFhNjdiNzU0MjEyMmM=',
	    },
	    body: JSON.stringify(novalnetPayload),
	  });

	let responseString = '';
	try {
	  const responseData = await novalnetResponse.json(); 
	  responseString = JSON.stringify(responseData);
	} catch (err) {
	  responseString = 'Unable to parse Novalnet response';
	}
	  
	

	const parsedResponse = JSON.parse(responseString); // convert JSON string to object
	const transactiondetails = `Novalnet Transaction ID: ${parsedResponse?.transaction?.tid}
	Test Order`;
	let bankDetails = ''; // Use `let` instead of `const` so we can reassign it
	if (parsedResponse?.transaction?.bank_details) {
	  bankDetails = `Please transfer the amount of ${parsedResponse?.transaction?.amount} to the following account.
	Account holder: ${parsedResponse.transaction.bank_details.account_holder}
	IBAN: ${parsedResponse.transaction.bank_details.iban}
	BIC: ${parsedResponse.transaction.bank_details.bic}
	BANK NAME: ${parsedResponse.transaction.bank_details.bank_name}
	BANK PLACE: ${parsedResponse.transaction.bank_details.bank_place}
	Please use the following payment reference for your money transfer, as only through this way your payment is matched and assigned to the order:
	Payment Reference 1: ${parsedResponse.transaction.tid}`;
	}

    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned: await this.ctCartService.getPaymentAmount({
        cart: ctCart,
      }),
      paymentMethodInfo: {
        paymentInterface: getPaymentInterfaceFromContext() || 'mock',
      },
    paymentStatus: { 
        interfaceCode:  transactiondetails + '\n' + bankDetails,
        interfaceText: responseString,
      },
      ...(ctCart.customerId && {
        customer: {
          typeId: 'customer',
          id: ctCart.customerId,
        },
      }),
      ...(!ctCart.customerId &&
        ctCart.anonymousId && {
          anonymousId: ctCart.anonymousId,
        }),
    });

    await this.ctCartService.addPayment({
      resource: {
        id: ctCart.id,
        version: ctCart.version,
      },
      paymentId: ctPayment.id,
    });

    const pspReference = randomUUID().toString();
    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: pspReference,
      paymentMethod: request.data.paymentMethod.type,
      transaction: {
        type: 'Authorization',
        amount: ctPayment.amountPlanned,
        interactionId: pspReference,
        state: this.convertPaymentResultCode(request.data.paymentOutcome),
      },
    });

    return {
      paymentReference: updatedPayment.id,
    };
  }

  public async handleTransaction(transactionDraft: TransactionDraftDTO): Promise<TransactionResponseDTO> {
    const TRANSACTION_AUTHORIZATION_TYPE: TransactionType = 'Authorization';
    const TRANSACTION_STATE_SUCCESS: TransactionState = 'Success';
    const TRANSACTION_STATE_FAILURE: TransactionState = 'Failure';
    console.log('handle-transaction');
    log.info('handle-transaction');
    const maxCentAmountIfSuccess = 10000;

    const ctCart = await this.ctCartService.getCart({ id: transactionDraft.cartId });

    let amountPlanned = transactionDraft.amount;
    if (!amountPlanned) {
      amountPlanned = await this.ctCartService.getPaymentAmount({ cart: ctCart });
    }

    const isBelowSuccessStateThreshold = amountPlanned.centAmount < maxCentAmountIfSuccess;

    const newlyCreatedPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: transactionDraft.paymentInterface,
      },
    });

    await this.ctCartService.addPayment({
      resource: {
        id: ctCart.id,
        version: ctCart.version,
      },
      paymentId: newlyCreatedPayment.id,
    });

    const transactionState: TransactionState = isBelowSuccessStateThreshold
      ? TRANSACTION_STATE_SUCCESS
      : TRANSACTION_STATE_FAILURE;

    const pspReference = randomUUID().toString();

    await this.ctPaymentService.updatePayment({
      id: newlyCreatedPayment.id,
      pspReference: pspReference,
      transaction: {
        amount: amountPlanned,
        type: TRANSACTION_AUTHORIZATION_TYPE,
        state: transactionState,
        interactionId: pspReference,
      },

    });

    if (isBelowSuccessStateThreshold) {
      return {
        transactionStatus: {
          errors: [],
          state: 'Pending',
        },
      };
    } else {
      return {
        transactionStatus: {
          errors: [
            {
              code: 'PaymentRejected',
              message: `Payment '${newlyCreatedPayment.id}' has been rejected.`,
            },
          ],
          state: 'Failed',
        },
      };
    }
  }

  private convertPaymentResultCode(resultCode: PaymentOutcome): string {
    switch (resultCode) {
      case PaymentOutcome.AUTHORIZED:
        return 'Success';
      case PaymentOutcome.REJECTED:
        return 'Failure';
      default:
        return 'Initial';
    }
  }

}
