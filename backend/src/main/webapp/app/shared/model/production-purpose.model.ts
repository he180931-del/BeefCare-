import { IFarm } from 'app/shared/model/farm.model';

export interface IProductionPurpose {
  id?: number;
  code?: string;
  name?: string;
  description?: string | null;
  available?: boolean;
  farm?: IFarm;
}

export const defaultValue: Readonly<IProductionPurpose> = {
  available: false,
};
