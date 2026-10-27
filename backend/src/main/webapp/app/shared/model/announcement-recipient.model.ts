import dayjs from 'dayjs';

import { IAnnouncementVersion } from 'app/shared/model/announcement-version.model';
import { IFarmMembership } from 'app/shared/model/farm-membership.model';

export interface IAnnouncementRecipient {
  id?: number;
  deliveredTime?: dayjs.Dayjs;
  readTime?: dayjs.Dayjs | null;
  version?: IAnnouncementVersion;
  membership?: IFarmMembership;
}

export const defaultValue: Readonly<IAnnouncementRecipient> = {};
