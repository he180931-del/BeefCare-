import dayjs from 'dayjs';

import { IPayment } from 'app/shared/model/payment.model';

export interface IBankTransferEvidence {
  id?: number;
  providerTxnId?: number;
  amount?: number;
  bankPaidAt?: dayjs.Dayjs;
  quoteRef?: string | null;
  deliveryOutcome?: string | null;
  authOutcome?: string | null;
  payment?: IPayment | null;
}

export const defaultValue: Readonly<IBankTransferEvidence> = {};
