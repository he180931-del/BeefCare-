import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';
import { IVaccine } from 'app/shared/model/vaccine.model';

export interface IVaccination {
  id?: number;
  vaccinationDate?: dayjs.Dayjs;
  entryTime?: dayjs.Dayjs;
  dose?: string;
  batchNo?: string | null;
  source?: string | null;
  vaccinator?: string;
  cattle?: ICattle;
  vaccine?: IVaccine;
}

export const defaultValue: Readonly<IVaccination> = {};
