import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  ValidationPipe,
  Query,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Version,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { GetCurrentUser, Public } from 'src/auth/common/decorators';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { QueryArticleDto } from './dto/query-artilce.dto';
import { CreatePrintArticleDto } from './dto/create-print-article.dto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PAGINATION } from 'src/core/constants/enums.constants';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';

@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) { }

  private _handleError(error: any, defaultMessage: string): never {
    this._logger.error(`${defaultMessage}: ${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof ConflictException ||
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    } else if (error.name === 'ValidationError') {
      throw new BadRequestException(error.message);
    } else {
      // Security: Don't expose internal error details to clients
      throw new InternalServerErrorException(defaultMessage);
    }
  }



  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() createArticleDto: CreateArticleDto,
    @GetCurrentUser() user: TCurrentUserType
  ) {
    return await this.articlesService.create(createArticleDto, user);
  }

  @Get()
  async findAll(@Query() query: QueryArticleDto, @GetCurrentUser() user: TCurrentUserType) {
    try {
      const blogTopic = await this.articlesService.findAll(query, user);
      return {
        data: blogTopic.data,
        message: MESSAGE.ARTICLE.FETCHED,
        total: blogTopic.total,
        lastId: blogTopic.lastId,
        lastSortValues: blogTopic.lastSortValues,
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        pageCount: Math.ceil(blogTopic.total / (query.limit ?? blogTopic.total)),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.ARTICLE.ERRORS.FETCHING);
    }
  }

  //  @Public()
  //   @Get('wp-json/api/v1/newsnap')
  //   async getMenusWp(@Query() query: QueryArticleDto, @GetCurrentUser() user: TCurrentUserType) {
  //     const result = await this.articlesService.findAll(query, user);
  //     return this.articlesService.mapArticleToNewsnapFormat(result.data);
  //   }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @GetCurrentUser() user: TCurrentUserType) {
    return this.articlesService.findOne(id, user);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(@Param('id') id: string, @Body() updateArticleDto: UpdateArticleDto) {
    return this.articlesService.update(id, updateArticleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }

  @Delete(':articleId/rich-blocks/:blockId')
  deleteRichBlock(
    @Param('articleId') articleId: string,
    @Param('blockId') blockId: string
  ) {
    return this.articlesService.deleteRichBlock(articleId, blockId);
  }

  @Version('2')
  @Get()
  async findAllFromElastic(
    @Query() query: QueryArticleDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<any> {
    try {
      const articles = await this.articlesService.findAllFromElastic(query, user);
      const total =
        typeof articles.total === 'object'
          ? articles.total.value
          : articles.total;

      const limit = Number(query.limit) || 10;
      return {
        data: articles.data,
        message: MESSAGE.ARTICLE.FETCHED,
        total: total,
        lastId: articles.lastId,
        lastSortValues: articles.lastSortValues,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(Number(total) / Number(limit)),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.ARTICLE.ERRORS.FETCHING);
    }
  }

  /**
   * Called by wordpress-migrator for each print story.
   * Receives raw HTML content and queues it for async conversion to rich blocks + article creation.
   */
  @Public()
  @Post('print-migration')
  @HttpCode(202)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async queuePrintMigration(
    @Body() dto: CreatePrintArticleDto,
  ): Promise<{ queued: boolean; id: string }> {
    await this.articlesService.enqueuePrintMigration(dto);
    return { queued: true, id: dto.id };
  }

  @Public()
  @Get('print-migration/status')
  async printMigrationQueueStatus() {
    return this.articlesService.getPrintMigrationQueueStatus();
  }

  // @Post('import/wordpress')
  // @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  // async importFromWordPress(
  //   @Query('propertyId') propertyId: string,
  //   @GetCurrentUser() user: TCurrentUserType
  // ) {
  //   try {
  //     if (!propertyId) {
  //       throw new BadRequestException('propertyId is required');
  //     }

  //     const result = await this.articlesService.fetchAndSaveWordPressArticles(user, propertyId);

  //     return {
  //       success: result.success,
  //       message: `Successfully imported ${result.imported} articles from WordPress`,
  //       imported: result.imported,
  //       duration: result.duration,
  //       avgTimePerArticle: result.avgTimePerArticle,
  //       errors: result.errors.length > 0 ? result.errors : undefined,
  //     };
  //   } catch (error) {
  //     this._handleError(error, 'Failed to import WordPress articles');
  //   }
  // }
}
