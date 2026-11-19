import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';

export interface IReproductionEvent {
  id?: number;
  type?: string;
  eventTime?: dayjs.Dayjs;
  method?: string | null;
  result?: string;
  source?: string | null;
  cattle?: ICattle;
  linkedEvent?: IReproductionEvent | null;
}

export const defaultValue: Readonly<IReproductionEvent> = {};
