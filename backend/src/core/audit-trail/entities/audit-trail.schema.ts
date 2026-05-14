import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ACTIONS, ModuleName } from 'src/core/constants/enums.constants';

export type TAuditTrailDocument = AuditTrail & Document;

@Schema({ timestamps: true })
export class AuditTrail {
  @Prop({ enum: ACTIONS })
  action: string;

  @Prop({ enum: ModuleName })
  collectionName: string;

  @Prop({ type: String })
  objectId: string;

  @Prop([{ fieldName: String, oldValue: String, newValue: String, _id: false }])
  changes: { fieldName: string; oldValue: string; newValue: string }[];

  @Prop({ type: String, default: false })
  status: string;

  @Prop({ type: Date })
  deletionDate: Date;

  @Prop({
    type: {
      userId: { type: String, required: true },
      userName: { type: String, required: true },
    },
  })
  updatedBy: {
    userId: string;
    userName: string;
  };

  @Prop({
    type: {
      userId: { type: String, required: true },
      userName: { type: String, required: true },
    },
  })
  createdBy: {
    userId: string;
    userName: string;
  };
}

export const auditTrailSchema = SchemaFactory.createForClass(AuditTrail);
