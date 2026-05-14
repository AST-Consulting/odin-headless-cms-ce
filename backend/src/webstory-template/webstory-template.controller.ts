import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { WebStoryTemplateService } from './webstory-template.service';
import { PermissionResource } from '../auth/common/decorators/permission-resource.decorator';
import { GetCurrentUser } from '../auth/common/decorators';
import { TCurrentUserType } from '../auth/types/user.type';

@PermissionResource('webstory-template')
@Controller('webstory-templates')
export class WebStoryTemplateController {
  constructor(private readonly service: WebStoryTemplateService) {}

  @Post()
  create(@Body() data: any, @GetCurrentUser() user: TCurrentUserType) {
    return this.service.create(data, user);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: any,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    return this.service.update(id, data, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetCurrentUser() user: TCurrentUserType) {
    return this.service.remove(id, user);
  }
}
