import dayjs from 'dayjs';

import { IFarm } from 'app/shared/model/farm.model';

export interface IReminderParameter {
  id?: number;
  parameterType?: string;
  paramValue?: string;
  versionNo?: number;
  effectiveFrom?: dayjs.Dayjs;
  farm?: IFarm;
}

export const defaultValue: Readonly<IReminderParameter> = {};
