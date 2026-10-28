import dayjs from 'dayjs';

import { IAppUser } from 'app/shared/model/app-user.model';

export interface INotification {
  id?: number;
  targetType?: string;
  targetId?: number;
  createdTime?: dayjs.Dayjs;
  readTime?: dayjs.Dayjs | null;
  recipient?: IAppUser;
}

export const defaultValue: Readonly<INotification> = {};
