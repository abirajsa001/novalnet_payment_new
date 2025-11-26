import { PaymentRequestSchemaDTO } from '../../dtos/mock-payment.dto';
import { CommercetoolsCartService, CommercetoolsPaymentService } from '@commercetools/connect-payments-sdk';
console.log('mock-payment.type.ts');
export type MockPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

export type CreatePaymentRequest = {
  data: PaymentRequestSchemaDTO;
};

export interface UpdatePayment {
  id: string;
  pspReference?: string;
  paymentMethod?: string;
  transaction?: {
    type: string;
    amount: any;
    interactionId?: string;
    state?: string;
  };
  paymentStatus?: {
    interfaceCode: string;
    interfaceText: string;
  }; 
}
