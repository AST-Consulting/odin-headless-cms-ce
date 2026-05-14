import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDTO } from './category.create.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDTO) {}
