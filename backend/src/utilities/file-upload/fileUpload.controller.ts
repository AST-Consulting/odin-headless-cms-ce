import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UnprocessableEntityException,
  UploadedFiles,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { OrganizationService } from '@organization/organization.service';
import { PropertyService } from '@property/property.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';

// Allowed file extensions mapped to their expected MIME types
// Note: SVG is allowed because uploads are served cross-origin (S3/Cloudinary),
// which prevents embedded scripts from accessing the CMS origin's cookies/session.
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  // Images
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
  // Documents
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  // Text
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'text/plain', 'application/csv'],
  '.json': ['application/json', 'text/json'],
  // Video
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.mov': ['video/quicktime'],
  // Audio
  '.mp3': ['audio/mpeg', 'audio/mp3'],
  '.wav': ['audio/wav', 'audio/wave'],
};

const ALLOWED_FILE_EXTENSIONS = Object.keys(ALLOWED_FILE_TYPES);

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// File filter function for multer - validates both extension AND MIME type
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void
) => {
  const ext = extname(file.originalname).toLowerCase();

  // Check if extension is allowed
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    return callback(
      new BadRequestException(
        `File type '${ext}' is not allowed. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`
      ),
      false
    );
  }

  // Validate MIME type matches expected type for the extension
  const allowedMimes = ALLOWED_FILE_TYPES[ext];
  if (!allowedMimes.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        `File MIME type '${file.mimetype}' does not match expected type for '${ext}' extension`
      ),
      false
    );
  }

  callback(null, true);
};
import {
  FILE_UPLOAD_SERVICE,
  FILE_UPLOAD_STRATEGY,
  PAGINATION,
} from '../../core/constants/enums.constants';
import { LocalService } from './providers/local.service';
import { CloudinaryService } from './providers/cloudinary.service';
import { AWSService } from './providers/aws.service';
import { GetCurrentUser } from '../../auth/common/decorators';
import { FileUploadService } from './fileUpload.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { FileUploadQueryDto } from './dto/query-file-upload.dto';
import { RefitMediaDto } from './dto/refit-media.dto';
import { aspectMatches, parseAspectRatio, fitBufferToAspectWithBlur } from './utils/aspect-fit';
import {
  getImageFormat,
  getExtForFormat,
  getMimeForFormat,
  isAnimatedFormat,
} from './utils/image-format';
import axios from 'axios';
import slugify from 'slugify';
import { Request, Response } from 'express';
import { ApiConfigService } from 'src/core/config/config.service';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { TApiResponse } from 'src/core/types/response';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { SwaggerFacade } from '@core/swagger/swagger-facade';

// import { ApiConfigService } from 'src/core/config/config.service';

@Controller('files')
export class FileUploadController {
  constructor(
    private readonly _awsService: AWSService,
    private readonly _cloudinaryService: CloudinaryService,
    private readonly _localService: LocalService,
    private readonly _configService: ApiConfigService,
    private readonly _fileUploadService: FileUploadService,
    private readonly _organizationService: OrganizationService,
    private readonly _propertyService: PropertyService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {}

  private _handleError(error: any, defaultMessage: string): never {
    this._logger.error(`${defaultMessage}:${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof ConflictException ||
      error instanceof UnprocessableEntityException
    ) {
      throw error;
    }
    throw new InternalServerErrorException(defaultMessage);
  }

  // @Roles()
  @Post('/upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      fileFilter,
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10,
      },
    })
  )
  async upload(
    @Req() req: Request,
    @Query() query: FileUploadQueryDto,
    @GetCurrentUser() user: TCurrentUserType,
    @UploadedFiles() files: Express.Multer.File[]
  ): Promise<any> {
    query.service = query.service || process.env.UPLOAD_SERVICE;
    query.strategy = query.strategy || process.env.UPLOAD_STRATEGY;

    const { strategy: uploadStrategy, service: uploadService, propertyId } = query;

    if (uploadStrategy === FILE_UPLOAD_STRATEGY.FULL) {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files to uploaded');
      }
    }

    const folderName = await this._resolveFolderName(propertyId, user.organizationId);

    if (uploadService === FILE_UPLOAD_SERVICE.S3) {
      // S3
      return await this._awsService.handleRequest(files, req, query, folderName, user);
    } else if (uploadService === FILE_UPLOAD_SERVICE.CLOUDINARY) {
      // CLOUDINARY
      return await this._cloudinaryService.handleRequest(files, req, query, folderName, user);
    } else {
      // LOCAL
      return await this._localService.handleRequest(files, req, query, folderName, user);
    }
  }

  private async _resolveFolderName(
    propertyId: string | undefined,
    organizationId: string | undefined
  ): Promise<string> {
    if (propertyId) {
      const property = await this._propertyService.getById(propertyId);
      if (property && property.name) return slugify(property.name, { lower: true });
    }
    if (organizationId) {
      const organization = await this._organizationService.findOne(organizationId);
      if (organization && organization.organization_name) {
        return slugify(organization.organization_name, { lower: true });
      }
    }
    return 'default';
  }

  /**
   * Refit an existing media to a target aspect ratio by padding it with a
   * blurred copy of itself. If the source already matches the target (within
   * tolerance) the original media record is returned unchanged. Otherwise the
   * refitted image is uploaded as a new media record (skipping watermark —
   * the source already has one, and re-stamping would produce a visible double).
   */
  @Post('/refit')
  async refit(
    @Body() body: RefitMediaDto,
    @Req() req: Request,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    let media: any = null;
    try {
      const { mediaId, fitAspect, propertyId } = body;

      media = await this._fileUploadService.findOneById(mediaId);
      if (!media) {
        throw new NotFoundException('Media not found');
      }

      const targetAspect = parseAspectRatio(fitAspect);

      // Short-circuit without touching the file if stored metadata already matches
      const srcW = Number(media.media_details?.width);
      const srcH = Number(media.media_details?.height);
      if (srcW && srcH && aspectMatches(srcW / srcH, targetAspect)) {
        return { message: 'Media already matches target aspect', data: media };
      }

      // Refit pads with a blurred copy (aspect-fit) — a reshape that can't be
      // applied per-frame to animated content. Reject animated GIFs with a
      // clear error instead of silently freezing them.
      const sourceFormat = getImageFormat(media.mimeType);
      if (!sourceFormat || isAnimatedFormat(sourceFormat)) {
        throw new BadRequestException(`Refit is not supported for '${media.mimeType}' media`);
      }

      // Prefer the clean pre-watermark copy (persisted as `${path}.orig` during
      // upload). Reading from storage directly avoids a self-HTTP round-trip and
      // the associated static-handler quirks. Falls back to the watermarked main
      // file for legacy uploads that predate the .orig copy.
      const configuredUploadService = String(process.env.UPLOAD_SERVICE || FILE_UPLOAD_SERVICE.LOCAL).toUpperCase();
      const uploadService =
        configuredUploadService === FILE_UPLOAD_SERVICE.S3
          ? FILE_UPLOAD_SERVICE.S3
          : configuredUploadService === FILE_UPLOAD_SERVICE.CLOUDINARY
            ? FILE_UPLOAD_SERVICE.CLOUDINARY
            : FILE_UPLOAD_SERVICE.LOCAL;
      let sourceBuffer: Buffer | null = null;
      let sourceWasClean = false;

      if (uploadService === FILE_UPLOAD_SERVICE.S3) {
        sourceBuffer = await this._awsService.readStoredBuffer(media.path + '.orig');
        if (sourceBuffer) {
          sourceWasClean = true;
        } else {
          sourceBuffer = await this._awsService.readStoredBuffer(media.path);
        }
      } else if (uploadService === FILE_UPLOAD_SERVICE.LOCAL) {
        sourceBuffer = this._localService.readStoredBuffer(media.path + '.orig');
        if (sourceBuffer) {
          sourceWasClean = true;
        } else {
          sourceBuffer = this._localService.readStoredBuffer(media.path);
        }
      }

      // Last-resort: fetch via the public URL (covers Cloudinary + any stragglers)
      if (!sourceBuffer) {
        try {
          const response = await axios.get(media.url, {
            responseType: 'arraybuffer',
            timeout: 15000,
          });
          sourceBuffer = Buffer.from(response.data);
        } catch (fetchErr: any) {
          // If legacy/public URL is gone (404), keep the original media instead
          // of surfacing a hard 500 to editors.
          if (fetchErr?.response?.status === 404) {
            this._logger.warn(
              `Refit source URL not found (404) for media ${mediaId}, returning original media`,
              this.constructor.name
            );
            return {
              message: 'Source media is unavailable for refit, using original media',
              data: media,
            };
          }
          throw fetchErr;
        }
      }

      const { buffer: fittedBuffer, wasModified } = await fitBufferToAspectWithBlur(
        sourceBuffer,
        targetAspect,
        sourceFormat
      );
      if (!wasModified) {
        return { message: 'Media already matches target aspect', data: media };
      }

      // Shape a Multer-like file and dispatch through the existing upload pipeline.
      // Preserve the source format so PNG/WebP refits don't silently transcode to JPEG.
      const file = {
        buffer: fittedBuffer,
        originalname: `refit-${Date.now()}${getExtForFormat(sourceFormat)}`,
        mimetype: getMimeForFormat(sourceFormat),
        size: fittedBuffer.length,
        fieldname: 'files',
        encoding: '7bit',
      } as unknown as Express.Multer.File;

      const query = {
        service: uploadService,
        strategy: FILE_UPLOAD_STRATEGY.FULL,
        isPrivate: false,
        propertyId,
        // Clean source (.orig) → watermark once on the outer 16:9 canvas.
        // Legacy watermarked source → skip watermark to avoid stacking a new
        // one on top of the one already baked into the centered subject.
        skipWatermark: !sourceWasClean,
      } as unknown as FileUploadQueryDto;

      const folderName = await this._resolveFolderName(propertyId, user.organizationId);

      let result: TApiResponse;
      if (uploadService === FILE_UPLOAD_SERVICE.S3) {
        result = (await this._awsService.handleRequest(
          [file],
          req,
          query,
          folderName,
          user
        )) as TApiResponse;
      } else if (uploadService === FILE_UPLOAD_SERVICE.CLOUDINARY) {
        result = (await this._cloudinaryService.handleRequest(
          [file],
          req,
          query,
          folderName,
          user
        )) as TApiResponse;
      } else {
        result = await this._localService.handleRequest([file], req, query, folderName, user);
      }

      // Provider responses wrap data as an array for multi-file uploads but a
      // single object for single-file uploads; return the single record.
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      return { message: 'Media refitted to target aspect', data };
    } catch (error) {
      // Refit is a quality enhancement, not a hard requirement for editor flow.
      // If anything fails after media lookup, return original media so insert can continue.
      if (media) {
        this._logger.warn(
          `Refit failed for media ${media?._id || 'unknown'}; falling back to original: ${
            error instanceof Error ? error.message : String(error)
          }`,
          this.constructor.name
        );
        return { message: 'Refit unavailable, using original media', data: media };
      }
      this._handleError(error, 'Failed to refit media');
    }
  }
  @Get()
  async findAll(@Query() query: FileUploadQueryDto): Promise<TApiResponse> {
    try {
      const allFiles = await this._fileUploadService.findAll(query);

      if (allFiles) {
        this._logger.log(MESSAGE.FILE.LIST_FETCHED, this.constructor.name);

        return {
          data: allFiles.data,
          message: MESSAGE.FILE.LIST_FETCHED,
          total: allFiles.total,
          page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
          limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
          pageCount: Math.ceil(allFiles.total / (query.limit ?? allFiles.total)),
        };
      }
    } catch (error) {
      this._handleError(error, MESSAGE.FILE.LIST_FETCHED_FAILED);
    }
  }

  @Version('2')
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.BANNER.LIST)
  async findAllFromElastic(@Query() query: FileUploadQueryDto): Promise<any> {
    try {
      const files = await this._fileUploadService.findAllFromElastic(query);
      const total = typeof files.total === 'object' ? files.total.value : files.total;
      const limit = Number(query.limit) || 20;

      return {
        data: files.data,
        message: MESSAGE.FILE.LIST_FETCHED,
        total: total,
        limit: limit,
        page: query.page,
        pageCount: Math.ceil(Number(total) / limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.FILE.ERRORS.FETCHING);
    }
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request, // Inject the authenticated user from the request
    @Res() res: Response
  ): Promise<void> {
    try {
      // const user = req.user; // Assuming user is available in req object (via authentication middleware)
      return await this._fileUploadService.findOne(id, res);
    } catch (error) {
      // Custom error handler (optional)
      this._handleError(error, 'File fetching failed');
    }
  }
}
