import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { STATUS } from 'src/core/constants/enums.constants';
import { UserInfoSchema } from 'src/core/schema/general.schema';
import { UserInfo } from 'src/core/utils/utilVars';
import { IUserSub } from 'src/user/entities/user-sub.interface';
import { UserSub } from 'src/user/entities/user-sub.schema';
import { PropertySub } from 'src/property/schema/property.sub-schema';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';

export type TRoleDocument = HydratedDocument<Role>;

export enum TActionType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EDIT = 'edit',
  UPDATE = 'update',
}

// ✅ Subschema for module + actions (permissions per module))
export class Permission {
  @Prop({ type: String, required: true })
  module: string; // Example: "property", "user", "analytics"

  @Prop({ type: [String], enum: TActionType, default: [] })
  actions: TActionType[]; // Example: ["read", "write"]
}

@Schema({ timestamps: true })
export class Role {
  @Prop({ type: String, required: true })
  name: string; // Example: 'admin', 'superadmin'

  @Prop({ default: STATUS.ACTIVE })
  status: string;

  @Prop({ type: UserSub, required: true })
  user: IUserSub;

  @Prop({
    type: [OrganizationSub],
    default: []
  })
  organization: OrganizationSub[];

  @Prop({ type: [PropertySub], default: [] })
  properties: PropertySub[];

  @Prop({ type: [Permission], default: [] })
  permissions: Permission[];

  @Prop({ type: UserInfoSchema })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema })
  updatedBy: UserInfo;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
