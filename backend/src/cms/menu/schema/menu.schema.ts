import { STATUS } from '@core/constants/enums.constants';
import { UserInfoSchema } from '@core/schema/general.schema';
import { UserInfo } from '@core/utils/utilVars';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FileSub } from '@utilities/file-upload/entities/file-sub.schema';
import { Document, HydratedDocument } from 'mongoose';
import { Icon, Item, ItemSchema, MenuSub } from './menu-sub.schema';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';

// Schema for Menu (main schema)
@Schema({ timestamps: true })
export class Menu extends Document {
  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE })
  status: string;

  @Prop({ type: [ItemSchema], required: true })
  items: Item[];

  @Prop({ type: FileSub, required: false })
  image?: FileSub;

  @Prop({ type: FileSub, required: false })
  bannerImage?: FileSub;

  @Prop({ type: Icon, required: false })
  icon?: Icon;

  @Prop({ type: MenuSub, required: false })
  parentMenu?: MenuSub;

  @Prop({ required: true })
  organization: OrganizationSub;

  @Prop({ required: true })
  property: PropertySub;

  @Prop({ type: UserInfoSchema, required: true })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema, required: true })
  updatedBy: UserInfo;

  @Prop({ type: Number, default: 0 })
  rank: number;

  @Prop({ type: String, required: true })
  slug: string;

  @Prop({ type: Number, required: false })
  wpMenuId?: number;
}

export type TMenuDocument = HydratedDocument<Menu>;

// Create schemas using SchemaFactory
export const MenuSchema = SchemaFactory.createForClass(Menu);
