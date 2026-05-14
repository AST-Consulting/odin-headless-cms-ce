import {
  Controller,
  Get,
  Post,
  Body,
  Logger,
  Inject,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ImageGenerationService } from './image-generation.service';
import { GenerateImageDto } from './dto/generate-image.dto';
import { GenerateInfographicDto } from './dto/generate-infographic.dto';
import { PrepareInfographicPromptDto } from './dto/prepare-infographic-prompt.dto';
import { ExtractScreenshotInsightsDto } from './dto/extract-screenshot-insights.dto';
import { GetCurrentUser } from 'src/auth/common/decorators';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Permissions } from 'src/auth/common/decorators/permissions.decorator';

@Controller('image-generation')
export class ImageGenerationController {
  constructor(
    private readonly _imageGenerationService: ImageGenerationService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {}

  private _handleError(error: any, defaultMessage: string): never {
    this._logger.error(`${defaultMessage}: ${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof ConflictException ||
      error instanceof UnprocessableEntityException
    ) {
      throw error;
    } else if (error.name === 'ValidationError') {
      throw new BadRequestException(error.message);
    } else {
      throw new InternalServerErrorException(defaultMessage);
    }
  }

  @Post()
  @Permissions('ai.write')
  async generateImage(
    @Body() generateImageDto: GenerateImageDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<any> {
    try {
      return await this._imageGenerationService.generateOrReuseImage(generateImageDto, user);
    } catch (error) {
      this._handleError(error, 'Image generation and upload failed');
    }
  }

  @Post('infographic')
  @Permissions('ai.write')
  async generateInfographic(
    @Body() generateInfographicDto: GenerateInfographicDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<any> {
    try {
      return await this._imageGenerationService.generateInfographic(generateInfographicDto, user);
    } catch (error) {
      this._handleError(error, 'Infographic generation and upload failed');
    }
  }

  @Get('infographic/templates')
  @Permissions('ai.write')
  getInfographicTemplates(): { data: ReturnType<ImageGenerationService['getInfographicPromptTemplates']> } {
    return { data: this._imageGenerationService.getInfographicPromptTemplates() };
  }

  @Post('infographic/prepare-prompt')
  @Permissions('ai.write')
  async prepareInfographicPrompt(
    @Body() payload: PrepareInfographicPromptDto
  ): Promise<{ data: Awaited<ReturnType<ImageGenerationService['prepareInfographicPrompt']>> }> {
    return { data: await this._imageGenerationService.prepareInfographicPrompt(payload) };
  }

  @Post('infographic/extract-screenshot')
  @Permissions('ai.write')
  async extractInfographicScreenshot(
    @Body() payload: ExtractScreenshotInsightsDto
  ): Promise<{ data: Awaited<ReturnType<ImageGenerationService['extractInfographicInsightsFromScreenshot']>> }> {
    return { data: await this._imageGenerationService.extractInfographicInsightsFromScreenshot(payload) };
  }
}
