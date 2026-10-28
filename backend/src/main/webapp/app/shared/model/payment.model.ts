import dayjs from 'dayjs';

import { IAppUser } from 'app/shared/model/app-user.model';
import { ISubscription } from 'app/shared/model/subscription.model';

export interface IPayment {
  id?: number;
  quoteRef?: string;
  durationYears?: number;
  amountVnd?: number;
  state?: string;
  expiresAt?: dayjs.Dayjs;
  purchasedStart?: dayjs.Dayjs | null;
  purchasedEnd?: dayjs.Dayjs | null;
  subscription?: ISubscription;
  requestedBy?: IAppUser;
}

export const defaultValue: Readonly<IPayment> = {};
