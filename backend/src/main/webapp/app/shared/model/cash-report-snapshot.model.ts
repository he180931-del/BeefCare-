import dayjs from 'dayjs';

import { IAppUser } from 'app/shared/model/app-user.model';
import { IFarm } from 'app/shared/model/farm.model';

export interface ICashReportSnapshot {
  id?: number;
  asOf?: dayjs.Dayjs;
  dateFrom?: dayjs.Dayjs;
  dateTo?: dayjs.Dayjs;
  totals?: number;
  pmUser?: IAppUser;
  farm?: IFarm | null;
}

export const defaultValue: Readonly<ICashReportSnapshot> = {};
