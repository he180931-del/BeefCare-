import dayjs from 'dayjs';

import { IFarm } from 'app/shared/model/farm.model';
import { IPlanVersion } from 'app/shared/model/plan-version.model';

export interface ISubscription {
  id?: number;
  entitlementStatus?: string;
  latestEnd?: dayjs.Dayjs | null;
  farm?: IFarm;
  planVersion?: IPlanVersion;
}

export const defaultValue: Readonly<ISubscription> = {};
