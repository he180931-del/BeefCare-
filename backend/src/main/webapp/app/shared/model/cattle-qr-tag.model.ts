import { ICattle } from 'app/shared/model/cattle.model';

export interface ICattleQrTag {
  id?: number;
  tagCode?: string;
  status?: string;
  cattle?: ICattle;
}

export const defaultValue: Readonly<ICattleQrTag> = {};
