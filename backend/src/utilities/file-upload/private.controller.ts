import { Controller, Get, Param, Res, Req, HttpStatus, ForbiddenException } from '@nestjs/common';
import { Response, Request } from 'express';
import { resolve, relative } from 'path';
import { existsSync } from 'fs';
import { FileUploadService } from './fileUpload.service';
@Controller('private')
export class PrivateFileController {
  constructor(private readonly _fileService: FileUploadService) {}

  @Get('/:folder/:fileType/:year/:month/:day/:folderId/:filename')
  async getPrivateFile(
    @Param('folder') folder: string,
    @Param('fileType') fileType: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @Param('day') day: string,
    @Param('folderId') folderId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
    @Req() req: Request
  ) {
    // Validate path components to prevent path traversal (including URL-encoded attempts)
    const pathComponents = [folder, fileType, year, month, day, folderId, filename];
    for (const component of pathComponents) {
      let decodedComponent: string;
      try {
        decodedComponent = decodeURIComponent(component);
      } catch {
        // Reject components with invalid URL encoding
        throw new ForbiddenException('Invalid path component encoding');
      }
      if (
        decodedComponent.includes('..') ||
        decodedComponent.includes('/') ||
        decodedComponent.includes('\\')
      ) {
        throw new ForbiddenException('Invalid path component');
      }
    }

    // Construct and validate file path
    const basePath = resolve(process.cwd(), 'private');
    const filePath = resolve(basePath, folder, fileType, year, month, day, folderId, filename);

    // Use path.relative() to verify path is within base directory (handles Windows edge cases)
    const relativePath = relative(basePath, filePath);
    if (relativePath.startsWith('..') || relative(basePath, filePath).includes('..')) {
      throw new ForbiddenException('Access denied');
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'File not found' });
    }

    return await this._fileService.findByPath(
      `private/${folder}/${fileType}/${year}/${month}/${day}/${folderId}/${filename}`,
      res
    );
  }
}
