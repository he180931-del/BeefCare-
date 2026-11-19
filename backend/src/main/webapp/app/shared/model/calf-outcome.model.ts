import { ICalvingEvent } from 'app/shared/model/calving-event.model';
import { ICattle } from 'app/shared/model/cattle.model';

export interface ICalfOutcome {
  id?: number;
  outcome?: string | null;
  sex?: string | null;
  birthWeight?: number | null;
  registrationState?: string;
  calving?: ICalvingEvent;
  registeredCattle?: ICattle | null;
}

export const defaultValue: Readonly<ICalfOutcome> = {};
