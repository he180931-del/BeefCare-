import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';

export interface ICattleProfileChange {
  id?: number;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  effectiveDate?: dayjs.Dayjs;
  reason?: string | null;
  cattle?: ICattle;
}

export const defaultValue: Readonly<ICattleProfileChange> = {};
