import { IAppUser } from 'app/shared/model/app-user.model';
import { ISupportTicket } from 'app/shared/model/support-ticket.model';

export interface IInternalRequest {
  id?: number;
  targetRole?: string;
  state?: string;
  outcome?: string | null;
  ticket?: ISupportTicket;
  recipient?: IAppUser;
}

export const defaultValue: Readonly<IInternalRequest> = {};
