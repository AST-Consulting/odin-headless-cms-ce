import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { FileSub, fileSubSchema } from '@utilities/file-upload/entities/file-sub.schema';

@Schema({ _id: false })
export class AuthorStub {
  @Prop({ type: Types.ObjectId, required: true })
  id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  slug?: string;

  @Prop()
  profileUrl?: string;

  @Prop({ type: String })
  username?: string;

  @Prop({ type: fileSubSchema })
  profilePicture?: FileSub;
}

export const AuthorStubSchema = SchemaFactory.createForClass(AuthorStub);
