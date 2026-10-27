import dayjs from 'dayjs';

import { IBreed } from 'app/shared/model/breed.model';
import { IFarm } from 'app/shared/model/farm.model';
import { IProductionPurpose } from 'app/shared/model/production-purpose.model';

export interface ICattle {
  id?: number;
  displayCode?: string;
  earTag?: string;
  sex?: string | null;
  birthDate?: dayjs.Dayjs | null;
  lifeStage?: string;
  herdStatus?: string;
  farm?: IFarm;
  breed?: IBreed;
  purpose?: IProductionPurpose;
  dam?: ICattle | null;
  sire?: ICattle | null;
}

export const defaultValue: Readonly<ICattle> = {};
