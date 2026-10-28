import { IAppUser } from 'app/shared/model/app-user.model';
import { IFarm } from 'app/shared/model/farm.model';

export interface IFarmMembership {
  id?: number;
  role?: string;
  status?: string;
  farm?: IFarm;
  user?: IAppUser;
}

export const defaultValue: Readonly<IFarmMembership> = {};
