import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';
import { IReproductionEvent } from 'app/shared/model/reproduction-event.model';

export interface IPregnancyEpisode {
  id?: number;
  expectedCalvingDate?: dayjs.Dayjs;
  parity?: number;
  status?: string;
  confirmingCheck?: IReproductionEvent;
  cattle?: ICattle;
}

export const defaultValue: Readonly<IPregnancyEpisode> = {};
