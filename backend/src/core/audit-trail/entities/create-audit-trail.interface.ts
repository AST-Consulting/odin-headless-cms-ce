import mongoose, { Document } from 'mongoose';
import { TCurrentUserType } from 'src/auth/types/user.type';

export interface ICreateAuditTrail {
  action: string;
  collectionName: string;
  user: TCurrentUserType;
  objectId: mongoose.Types.ObjectId;
  existingData?: Document;
  newData?: Document;
}
