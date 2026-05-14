import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { DriveService } from './drive.service';
import { TCurrentUserType } from '../../auth/types/user.type';
import { UploadBlogDto } from './dto/upload-blog.dto';

// Security: Allowed file types with their valid MIME types
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/csv'],
};

const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_FILE_TYPES);

// Security: File filter to validate extension and MIME type
const fileFilter = (req: Express.Request, file: Express.Multer.File, callback: Function) => {
  const ext = extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return callback(
      new BadRequestException(`File type '${ext}' is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`),
      false
    );
  }
  const allowedMimes = ALLOWED_FILE_TYPES[ext];
  if (!allowedMimes.includes(file.mimetype)) {
    return callback(
      new BadRequestException(`File MIME type '${file.mimetype}' does not match expected type for '${ext}'`),
      false
    );
  }
  callback(null, true);
};

const multerOptions = {
  storage: memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
};

@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  /**
   * Get Google Drive authorization URL
   */
  @Get('auth-url')
  async getAuthUrl(@Req() req: any) {
    const user = req.user as TCurrentUserType;
    console.log(user, 'user');
    const authUrl = await this.driveService.getAuthUrl(user.sub);
    return {
      success: true,
      authUrl,
    };
  }

  /**
   * Handle Google Drive OAuth callback
   */
  @Get('callback')
  async handleCallback(@Query('code') code: string, @Query('state') state: string) {
    if (!code || !state) {
      return {
        success: false,
        message: 'Missing authorization code or state',
      };
    }
    console.log(code, state, 'code, state');
    const result = await this.driveService.handleAuthCallback(code, state);
    return result;
  }

  /**
   * Check Google Drive connection status
   */
  @Get('status')
  async getConnectionStatus(@Req() req: any) {
    const user = req.user as TCurrentUserType;
    const status = await this.driveService.getConnectionStatus(user.sub);
    return {
      success: true,
      ...status,
    };
  }

  /**
   * Disconnect Google Drive
   */
  @Post('disconnect')
  async disconnectDrive(@Req() req: any) {
    const user = req.user as TCurrentUserType;
    const result = await this.driveService.disconnectDrive(user.sub);
    return result;
  }

  /**
   * Upload any file to Google Drive
   */
  @Post('upload-file')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadFile(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body()
    body: {
      folderPath?: string;
      metadata?: string;
    }
  ) {
    const user = req.user as TCurrentUserType;
    console.log(body.folderPath, 'folderPath');
    if (!file) {
      return {
        success: false,
        message: 'No file provided',
      };
    }

    let metadata = {};
    if (body.metadata) {
      try {
        metadata = JSON.parse(body.metadata);
      } catch (error) {
        // If metadata is not valid JSON, ignore it
      }
    }

    const result = await this.driveService.uploadFile(
      user.sub,
      file.originalname,
      file.buffer,
      file.mimetype,
      body.folderPath,
      metadata
    );

    return result;
  }

  /**
   * Upload blog file to Google Drive
   */
  @Post('upload-blog')
  async uploadBlogFile(@Req() req: any, @Body() body: UploadBlogDto) {
    const user = req.user as TCurrentUserType;
    const { blogTitle, htmlContent, authorName, siteSlug } = body;

    const result = await this.driveService.uploadBlogFile(
      user.sub,
      blogTitle,
      htmlContent,
      authorName,
      siteSlug
    );

    return result;
  }

  /**
   * Upload multiple files to Google Drive
   */
  @Post('upload-multiple-files')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  async uploadMultipleFiles(
    @Req() req: any,
    @UploadedFiles() files: any[],
    @Body()
    body: {
      folderPath?: string;
      metadata?: string;
    }
  ) {
    const user = req.user as TCurrentUserType;

    if (!files || files.length === 0) {
      return {
        success: false,
        message: 'No files provided',
      };
    }

    let metadata = {};
    if (body.metadata) {
      try {
        metadata = JSON.parse(body.metadata);
      } catch (error) {
        // If metadata is not valid JSON, ignore it
      }
    }

    const filesToUpload = files.map((file) => ({
      fileName: file.originalname,
      fileBuffer: file.buffer,
      mimeType: file.mimetype,
      folderPath: body.folderPath,
      metadata: { ...metadata, originalName: file.originalname },
    }));

    const results = await this.driveService.uploadMultipleFiles(user.sub, filesToUpload);

    return {
      success: true,
      message: `Uploaded ${files.length} files`,
      results,
    };
  }
}
