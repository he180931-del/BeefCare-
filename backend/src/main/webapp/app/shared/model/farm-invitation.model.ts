import dayjs from 'dayjs';

import { IFarm } from 'app/shared/model/farm.model';

export interface IFarmInvitation {
  id?: number;
  invitedEmail?: string;
  proposedRole?: string;
  proposedPermissions?: string | null;
  status?: string;
  expiresAt?: dayjs.Dayjs;
  farm?: IFarm;
}

export const defaultValue: Readonly<IFarmInvitation> = {};
