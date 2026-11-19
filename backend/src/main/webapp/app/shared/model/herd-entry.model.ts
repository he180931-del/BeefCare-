import dayjs from 'dayjs';

import { ICattle } from 'app/shared/model/cattle.model';
import { IPen } from 'app/shared/model/pen.model';

export interface IHerdEntry {
  id?: number;
  source?: string | null;
  entryDate?: dayjs.Dayjs;
  historyDeclarations?: string | null;
  cattle?: ICattle;
  initialPen?: IPen;
}

export const defaultValue: Readonly<IHerdEntry> = {};
