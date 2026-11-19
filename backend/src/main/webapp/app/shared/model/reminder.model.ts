import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';
import { IFarm } from 'app/shared/model/farm.model';

export interface IReminder {
  id?: number;
  ruleType?: string;
  sourceRecord?: string;
  dueTime?: dayjs.Dayjs;
  status?: string;
  farm?: IFarm;
  cattle?: ICattle;
}

export const defaultValue: Readonly<IReminder> = {};
