import { IFarmMembership } from 'app/shared/model/farm-membership.model';
import { IFarm } from 'app/shared/model/farm.model';

export interface IFarmAnnouncement {
  id?: number;
  state?: string;
  farm?: IFarm;
  author?: IFarmMembership;
}

export const defaultValue: Readonly<IFarmAnnouncement> = {};
