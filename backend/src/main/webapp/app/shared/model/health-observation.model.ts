import dayjs from 'dayjs';

import { IHealthCase } from 'app/shared/model/health-case.model';
import { IVaccination } from 'app/shared/model/vaccination.model';

export interface IHealthObservation {
  id?: number;
  observedTime?: dayjs.Dayjs;
  entryTime?: dayjs.Dayjs;
  signsProgress?: string;
  source?: string | null;
  healthCase?: IHealthCase;
  vaccination?: IVaccination | null;
}

export const defaultValue: Readonly<IHealthObservation> = {};
