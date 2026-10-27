import dayjs from 'dayjs';

import { IAppUser } from 'app/shared/model/app-user.model';
import { IFarm } from 'app/shared/model/farm.model';

export interface IAuditLog {
  id?: number;
  action?: string;
  targetType?: string;
  targetId?: number;
  loggedAt?: dayjs.Dayjs;
  actor?: IAppUser;
  farm?: IFarm | null;
}

export const defaultValue: Readonly<IAuditLog> = {};
