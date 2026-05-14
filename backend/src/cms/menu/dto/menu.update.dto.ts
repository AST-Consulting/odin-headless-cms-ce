import { PartialType } from '@nestjs/swagger';
import { CreateMenuDto } from './menu.create.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateMenuDto extends PartialType(CreateMenuDto) {
  // You can add additional properties or validation decorators here if needed
  @IsOptional()
  @IsString()
  slug?: string;
}
