export interface IFarm {
  id?: number;
  name?: string;
  location?: string;
  contact?: string;
  serviceStatus?: string;
}

export const defaultValue: Readonly<IFarm> = {};
