import { IAppUser } from 'app/shared/model/app-user.model';
import { IFarm } from 'app/shared/model/farm.model';

export interface ISupportTicket {
  id?: number;
  category?: string;
  priority?: string;
  status?: string;
  requester?: IAppUser;
  farm?: IFarm | null;
  assignedCs?: IAppUser | null;
}

export const defaultValue: Readonly<ISupportTicket> = {};
