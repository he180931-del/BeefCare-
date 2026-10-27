import { IAppUser } from 'app/shared/model/app-user.model';

export interface IPlatformStaffAccess {
  id?: number;
  role?: string;
  status?: string;
  user?: IAppUser;
}

export const defaultValue: Readonly<IPlatformStaffAccess> = {};
