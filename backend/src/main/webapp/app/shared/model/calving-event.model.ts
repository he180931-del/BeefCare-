import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';
import { IPregnancyEpisode } from 'app/shared/model/pregnancy-episode.model';

export interface ICalvingEvent {
  id?: number;
  birthTime?: dayjs.Dayjs;
  course?: string;
  damCondition?: string;
  dam?: ICattle;
  episode?: IPregnancyEpisode | null;
}

export const defaultValue: Readonly<ICalvingEvent> = {};
