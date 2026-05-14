import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RoleSub } from '@role/entities/role-sub.schema';
import { Permission } from '@role/entities/role.schema';

export type PropertySubDocument = PropertySub & Document;

@Schema({ _id: false })
export class PropertySub {
  @Prop({ required: true })
  id: string;

  @Prop({ required: false })
  name: string;

  @Prop({ required: true })
  domain: string;
}


export type UserPropertySubDocument = UserPropertySub & Document;

@Schema({ _id: false })
export class UserPropertySub {
  @Prop({ required: true })
  id: string;

  @Prop({ required: false })
  name?: string;

  @Prop({ required: true })
  domain: string;

  @Prop({ type: [Object], default: [] })
  roles?: RoleSub[];

  @Prop({ type: [Object], default: [] })
  permissions?: Permission[];

  @Prop({ default: 'active' })
  status?: string;
}


export const PropertySubSchema = SchemaFactory.createForClass(PropertySub);
export const UserPropertySubSchema = SchemaFactory.createForClass(UserPropertySub);
