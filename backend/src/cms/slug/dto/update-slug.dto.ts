import { PartialType } from '@nestjs/mapped-types';
import { CreateSlugDto } from './create-slug.dto';

export class UpdateSlugDto extends PartialType(CreateSlugDto) {}
