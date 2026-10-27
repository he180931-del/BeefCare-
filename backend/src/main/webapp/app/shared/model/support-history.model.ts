import dayjs from 'dayjs';

import { IAppUser } from 'app/shared/model/app-user.model';
import { ISupportTicket } from 'app/shared/model/support-ticket.model';

export interface ISupportHistory {
  id?: number;
  eventType?: string;
  priorState?: string | null;
  newState?: string;
  occurredAt?: dayjs.Dayjs;
  ticket?: ISupportTicket;
  actor?: IAppUser;
}

export const defaultValue: Readonly<ISupportHistory> = {};
