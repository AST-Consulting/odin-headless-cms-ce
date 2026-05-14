import { ObjectId } from 'mongodb';
import { IUserSub } from 'src/user/entities/user-sub.interface';

export interface Property {
  _id: ObjectId;
  domain: string;
  year: number;
  credential: { username: string; password: string; _id: ObjectId };
  siteSlug: string;
  status: string;
  articleType: string;
  platform: string;
  week?: number;
  lastScheduledAt?: Date;
  publish_type?: string;
  autoKeyword?: boolean;
  user: IUserSub;
}
