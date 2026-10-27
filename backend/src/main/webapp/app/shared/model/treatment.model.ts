import dayjs from 'dayjs';

import { IHealthCase } from 'app/shared/model/health-case.model';
import { IMedicine } from 'app/shared/model/medicine.model';

export interface ITreatment {
  id?: number;
  treatmentTime?: dayjs.Dayjs;
  entryTime?: dayjs.Dayjs;
  treatmentDetail?: string;
  dose?: string;
  route?: string;
  withdrawalPeriod?: string;
  result?: string;
  healthCase?: IHealthCase;
  medicine?: IMedicine | null;
}

export const defaultValue: Readonly<ITreatment> = {};
