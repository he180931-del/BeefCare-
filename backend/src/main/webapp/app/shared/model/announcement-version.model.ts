import dayjs from 'dayjs';

import { IFarmAnnouncement } from 'app/shared/model/farm-announcement.model';

export interface IAnnouncementVersion {
  id?: number;
  versionNo?: number;
  title?: string;
  body?: string;
  publishedTime?: dayjs.Dayjs;
  announcement?: IFarmAnnouncement;
}

export const defaultValue: Readonly<IAnnouncementVersion> = {};
