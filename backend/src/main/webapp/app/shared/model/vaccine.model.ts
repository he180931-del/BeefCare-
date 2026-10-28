import { IFarm } from 'app/shared/model/farm.model';

export interface IVaccine {
  id?: number;
  code?: string;
  name?: string;
  diseasePrevented?: string;
  manufacturer?: string;
  dose?: string;
  route?: string;
  boosterInterval?: number;
  withdrawalInfo?: string;
  available?: boolean;
  farm?: IFarm;
}

export const defaultValue: Readonly<IVaccine> = {
  available: false,
};
