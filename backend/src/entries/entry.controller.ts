import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GetCurrentUser, Public } from '@auth/common/decorators';
import { TCurrentUserType } from '@auth/types/user.type';
import { EntryService } from './entry.service';
import { CreateEntryDto, UpdateEntryDto } from './dto/entry.dto';

/**
 * REST surface:
 *
 *   GET    /:pluralName                                  → list
 *   POST   /:singularName                                → create
 *   GET    /:singularName/:id                            → find one
 *   PUT    /:singularName/:id                            → update
 *   DELETE /:singularName/:id                            → delete
 *   POST   /:singularName/:id/actions/publish
 *   POST   /:singularName/:id/actions/unpublish
 */
const PASSTHROUGH_QUERY = new ValidationPipe({
  transform: true,
  whitelist: false,
});

@Controller()
export class EntryController {
  constructor(private readonly _service: EntryService) {}

  @Public()
  @Get(':pluralName')
  list(
    @Param('pluralName') pluralName: string,
    @Query(PASSTHROUGH_QUERY) query: Record<string, any>,
  ) {
    return this._service.list(pluralName, query);
  }

  @Post(':singularName/actions/import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importFromExcel(
    @Param('singularName') singularName: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, any>,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      throw new BadRequestException('Only .xlsx and .xls files are accepted');
    }
    return this._service.importFromExcel(singularName, file.buffer, body, user?.sub);
  }

  @Post(':singularName')
  create(
    @Param('singularName') singularName: string,
    @Body() dto: CreateEntryDto,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    return this._service.create(singularName, dto, user?.sub);
  }

  @Public()
  @Get(':singularName/:id')
  findOne(
    @Param('singularName') singularName: string,
    @Param('id') id: string,
  ) {
    return this._service.findOne(singularName, id);
  }

  @Put(':singularName/:id')
  update(
    @Param('singularName') singularName: string,
    @Param('id') id: string,
    @Body() dto: UpdateEntryDto,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    return this._service.update(singularName, id, dto, user?.sub);
  }

  @Delete(':singularName/:id')
  remove(
    @Param('singularName') singularName: string,
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    return this._service.remove(singularName, id, user?.sub);
  }

  @Post(':singularName/:id/actions/publish')
  publish(
    @Param('singularName') singularName: string,
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    return this._service.publish(singularName, id, user?.sub);
  }

  @Post(':singularName/:id/actions/unpublish')
  unpublish(
    @Param('singularName') singularName: string,
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    return this._service.unpublish(singularName, id, user?.sub);
  }
}
