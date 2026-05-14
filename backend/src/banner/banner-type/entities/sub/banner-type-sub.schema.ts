import { Sub } from '@core/schema/sub.schema';
import { Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
export class BannerTypeSub extends Sub {}
