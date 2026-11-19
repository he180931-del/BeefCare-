import dayjs from 'dayjs';

import { IAppUser } from 'app/shared/model/app-user.model';
import { ICattle } from 'app/shared/model/cattle.model';

export interface IHerdExit {
  id?: number;
  type?: string;
  exitDate?: dayjs.Dayjs;
  reason?: string | null;
  cattle?: ICattle;
  confirmedBy?: IAppUser;
}

export const defaultValue: Readonly<IHerdExit> = {};
