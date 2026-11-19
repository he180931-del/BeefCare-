import dayjs from 'dayjs';

export interface IPlanVersion {
  id?: number;
  price1y?: number;
  price2y?: number;
  price3y?: number;
  terms?: string | null;
  effectiveAt?: dayjs.Dayjs;
}

export const defaultValue: Readonly<IPlanVersion> = {};
