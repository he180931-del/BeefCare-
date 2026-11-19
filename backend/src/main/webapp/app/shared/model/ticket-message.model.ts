import { IAppUser } from 'app/shared/model/app-user.model';
import { ISupportTicket } from 'app/shared/model/support-ticket.model';

export interface ITicketMessage {
  id?: number;
  type?: string;
  audience?: string;
  content?: string;
  ticket?: ISupportTicket;
  author?: IAppUser;
}

export const defaultValue: Readonly<ITicketMessage> = {};
