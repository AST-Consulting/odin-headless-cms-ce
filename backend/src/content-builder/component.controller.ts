import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { GetCurrentUser } from '@auth/common/decorators';
import { TCurrentUserType } from '@auth/types/user.type';
import { ComponentService } from './component.service';
import { CreateComponentDto, UpdateComponentDto } from './dto/component.dto';

@Controller('content-builder/components')
export class ComponentController {
  constructor(private readonly _service: ComponentService) {}

  @Post()
  create(
    @Body() dto: CreateComponentDto,
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
    return this._service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateComponentDto,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    return this._service.update(id, dto, user?.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this._service.remove(id);
  }
}
