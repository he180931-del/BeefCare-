import { IFarm } from 'app/shared/model/farm.model';

export interface IMedicine {
  id?: number;
  code?: string;
  name?: string;
  description?: string | null;
  dose?: string;
  route?: string;
  withdrawalInfo?: string;
  available?: boolean;
  farm?: IFarm;
}

export const defaultValue: Readonly<IMedicine> = {
  available: false,
};
