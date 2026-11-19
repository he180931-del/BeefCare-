import { IFarm } from 'app/shared/model/farm.model';

export interface IBreed {
  id?: number;
  code?: string;
  name?: string;
  description?: string | null;
  available?: boolean;
  farm?: IFarm;
}

export const defaultValue: Readonly<IBreed> = {
  available: false,
};
