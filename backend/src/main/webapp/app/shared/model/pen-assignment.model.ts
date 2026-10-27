import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';
import { IPen } from 'app/shared/model/pen.model';

export interface IPenAssignment {
  id?: number;
  effectiveFrom?: dayjs.Dayjs;
  effectiveTo?: dayjs.Dayjs | null;
  source?: string | null;
  reason?: string | null;
  cattle?: ICattle;
  pen?: IPen;
}

export const defaultValue: Readonly<IPenAssignment> = {};
