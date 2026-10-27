import { IFarm } from 'app/shared/model/farm.model';

export interface IPen {
  id?: number;
  code?: string;
  name?: string;
  capacity?: number;
  status?: string;
  farm?: IFarm;
}

export const defaultValue: Readonly<IPen> = {};
