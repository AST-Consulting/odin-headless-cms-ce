import { PartialType } from '@nestjs/swagger';
import { CreateStaticPageDto } from './static-page.create.dto';

export class UpdateStaticPageDto extends PartialType(CreateStaticPageDto) {}
