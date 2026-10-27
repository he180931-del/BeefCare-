import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';

export interface IHealthCase {
  id?: number;
  openedDate?: dayjs.Dayjs;
  status?: string;
  outcome?: string | null;
  closedDate?: dayjs.Dayjs | null;
  cattle?: ICattle;
}

export const defaultValue: Readonly<IHealthCase> = {};
