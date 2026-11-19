import dayjs from 'dayjs';

import { IFarm } from 'app/shared/model/farm.model';
import { IVaccine } from 'app/shared/model/vaccine.model';

export interface IVaccinationSchedule {
  id?: number;
  targetGroup?: string;
  firstDueDate?: dayjs.Dayjs;
  doseCount?: number;
  intervalDays?: number;
  status?: string;
  farm?: IFarm;
  vaccine?: IVaccine;
}

export const defaultValue: Readonly<IVaccinationSchedule> = {};
