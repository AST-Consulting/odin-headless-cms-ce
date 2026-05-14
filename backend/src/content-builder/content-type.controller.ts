import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsArray, IsString } from 'class-validator';
import { GetCurrentUser } from '@auth/common/decorators';
import { TCurrentUserType } from '@auth/types/user.type';
import { ContentTypeService } from './content-type.service';
import { CreateContentTypeDto } from './dto/content-type.create.dto';
import { UpdateContentTypeDto } from './dto/content-type.update.dto';

class ListColumnsDto {
  @IsArray()
  @IsString({ each: true })
  columns: string[];
}

@Controller('content-builder/content-types')
export class ContentTypeController {
  constructor(private readonly _service: ContentTypeService) {}

  @Post()
  create(
    @Body() dto: CreateContentTypeDto,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    return this._service.create(dto, user?.sub);
  }

  @Get()
  findAll() {
    return this._service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this._service.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContentTypeDto,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    return this._service.update(id, dto, user?.sub);
  }

  @Patch(':id/list-columns')
  setListColumns(@Param('id') id: string, @Body() dto: ListColumnsDto) {
    return this._service.setListColumns(id, dto.columns);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @GetCurrentUser() user: TCurrentUserType) {
    return this._service.publish(id, user?.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this._service.remove(id);
  }
}
