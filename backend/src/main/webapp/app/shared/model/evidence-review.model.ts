import dayjs from 'dayjs';

import { IAppUser } from 'app/shared/model/app-user.model';
import { IBankTransferEvidence } from 'app/shared/model/bank-transfer-evidence.model';

export interface IEvidenceReview {
  id?: number;
  decision?: string;
  reason?: string | null;
  reviewedAt?: dayjs.Dayjs;
  evidence?: IBankTransferEvidence;
  pmUser?: IAppUser;
}

export const defaultValue: Readonly<IEvidenceReview> = {};
