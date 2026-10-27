import dayjs from 'dayjs';

import { IPen } from 'app/shared/model/pen.model';

export interface IPenReceptionCriteria {
  id?: number;
  versionNo?: number;
  acceptedPurposes?: string;
  acceptedStages?: string;
  thresholds?: string | null;
  effectiveFrom?: dayjs.Dayjs;
  pen?: IPen;
}

export const defaultValue: Readonly<IPenReceptionCriteria> = {};
