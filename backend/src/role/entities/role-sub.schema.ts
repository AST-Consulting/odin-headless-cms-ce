import { Prop, Schema } from '@nestjs/mongoose';
import { IsOptional, IsString } from 'class-validator';

export interface IRoleSub {
  id: string;
  name: string;
}

@Schema({ _id: false })
export class RoleSub {
  @IsOptional()
  @IsString()
  @Prop({ type: String, required: false })
  id: string;

  @IsOptional()
  @IsString()
  @Prop({ type: String, required: false })
  name: string;
}
