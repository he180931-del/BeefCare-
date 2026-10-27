import dayjs from 'dayjs';

import { IHealthCase } from 'app/shared/model/health-case.model';
import { IPregnancyEpisode } from 'app/shared/model/pregnancy-episode.model';

export interface IPregnancyUpdate {
  id?: number;
  type?: string;
  occurredTime?: dayjs.Dayjs;
  details?: string | null;
  episode?: IPregnancyEpisode;
  healthCase?: IHealthCase | null;
}

export const defaultValue: Readonly<IPregnancyUpdate> = {};
