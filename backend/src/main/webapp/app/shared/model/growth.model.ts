import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';

export interface IGrowth {
  id?: number;
  checkDate?: dayjs.Dayjs;
  entryTime?: dayjs.Dayjs;
  weightKg?: number;
  weightType?: string;
  bcs?: number;
  status?: string;
  correctionReason?: string | null;
  cattle?: ICattle;
}

export const defaultValue: Readonly<IGrowth> = {};
