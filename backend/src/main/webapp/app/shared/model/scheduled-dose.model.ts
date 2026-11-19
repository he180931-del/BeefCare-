import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';
import { IVaccinationSchedule } from 'app/shared/model/vaccination-schedule.model';
import { IVaccination } from 'app/shared/model/vaccination.model';

export interface IScheduledDose {
  id?: number;
  doseNo?: number;
  dueDate?: dayjs.Dayjs;
  status?: string;
  deferralReason?: string | null;
  newExpectedDate?: dayjs.Dayjs | null;
  vaccination?: IVaccination | null;
  schedule?: IVaccinationSchedule;
  cattle?: ICattle;
}

export const defaultValue: Readonly<IScheduledDose> = {};
