import dayjs from 'dayjs';

export interface IRecordRevision {
  id?: number;
  sourceType?: string;
  sourceId?: number;
  action?: string;
  reason?: string | null;
  beforeSnapshot?: string;
  afterSnapshot?: string;
  changedAt?: dayjs.Dayjs;
}

export const defaultValue: Readonly<IRecordRevision> = {};
