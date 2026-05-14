import { Seo } from '@core/schema/seo.schema';
import { ISubUserInterface } from '@user/entities/user.interface';

export interface ITag {
  name: string;
  description?: string;
  slug: string;
  rank?: number;
  status: string;
  isFeatured?: boolean;
  link?: string;
  seo: Seo;
  createdBy: ISubUserInterface;
  updatedBy?: ISubUserInterface;
}
