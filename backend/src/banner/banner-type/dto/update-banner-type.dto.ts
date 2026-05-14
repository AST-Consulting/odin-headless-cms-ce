import { PartialType } from '@nestjs/mapped-types';
import { CreateBannerTypeDto } from './create-banner-type.dto';

export class UpdateBannerTypeDto extends PartialType(CreateBannerTypeDto) {}
