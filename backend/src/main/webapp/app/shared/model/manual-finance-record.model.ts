import dayjs from 'dayjs';

import { IFarm } from 'app/shared/model/farm.model';

export interface IManualFinanceRecord {
  id?: number;
  type?: string;
  category?: string;
  amountVnd?: number;
  occurredOn?: dayjs.Dayjs;
  state?: string;
  farm?: IFarm | null;
}

export const defaultValue: Readonly<IManualFinanceRecord> = {};
