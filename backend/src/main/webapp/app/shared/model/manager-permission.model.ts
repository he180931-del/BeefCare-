import { IFarmMembership } from 'app/shared/model/farm-membership.model';

export interface IManagerPermission {
  id?: number;
  permissionCode?: string;
  enabled?: boolean;
  membership?: IFarmMembership;
}

export const defaultValue: Readonly<IManagerPermission> = {
  enabled: false,
};
