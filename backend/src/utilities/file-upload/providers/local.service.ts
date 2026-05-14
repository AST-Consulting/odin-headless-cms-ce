/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
// import { any } from 'src/auth/interface/auth.interface';
import { cleanFileName, ensureDirectoryPath, getFolderStructure } from '../utils/fileProcessing';
import { FileUploadService } from '../fileUpload.service';
import { getFileType } from '../utils/fileProcessing';
import { FileUpload, TFileUploadDocument } from '../../file-upload/entities/fileUpload.schema';
import { IFile } from '../entities/file.interface';
import { ApiConfigService } from 'src/core/config/config.service';
import { FILE_UPLOAD_STRATEGY } from 'src/core/constants/enums.constants';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { TApiResponse } from '@core/types/response';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { OrganizationService } from '@organization/organization.service';
import { PropertyService } from '@property/property.service';
import { generateImageVariants } from '../utils/image-variant-generator';
import { applyWatermarkToBuffer, WatermarkPosition } from '../utils/watermark';
import { fitBufferToAspectWithBlur, parseAspectRatio } from '../utils/aspect-fit';
import { getImageFormat, isAnimatedFormat } from '../utils/image-format';

@Injectable()
export class LocalService {
  constructor(
    private readonly _fileUploadService: FileUploadService,
    private readonly _configService: ApiConfigService,
    private readonly _organizationService: OrganizationService,
    private readonly _propertyService: PropertyService
  ) {}

  /**
   * Read a stored file directly from disk. Returns null if the path doesn't
   * exist — callers can use this to opportunistically fetch the `.orig`
   * (pre-watermark) sibling without HTTP round-trips.
   */
  readStoredBuffer(storagePath: string): Buffer | null {
    try {
      const raw = String(storagePath || '').trim();
      if (!raw) return null;

      const candidates = new Set<string>();
      const addCandidate = (p?: string) => {
        if (!p) return;
        const normalized = p.replace(/^file:\/\//, '').trim();
        if (!normalized) return;
        candidates.add(normalized);
        if (!path.isAbsolute(normalized)) {
          candidates.add(path.resolve(process.cwd(), normalized));
        }
      };

      addCandidate(raw);
      addCandidate(raw.replace(/^\/+/, ''));

      // If caller passes a URL/path that includes `/public/...` or `/private/...`,
      // extract that filesystem-relative segment and try it too.
      const publicIdx = raw.indexOf('/public/');
      if (publicIdx >= 0) addCandidate(raw.slice(publicIdx + 1));
      const privateIdx = raw.indexOf('/private/');
      if (privateIdx >= 0) addCandidate(raw.slice(privateIdx + 1));

      // URL form support (e.g. https://host/api/public/...)
      if (/^https?:\/\//i.test(raw)) {
        try {
          const pathname = new URL(raw).pathname || '';
          const pIdx = pathname.indexOf('/public/');
          if (pIdx >= 0) addCandidate(pathname.slice(pIdx + 1));
          const prIdx = pathname.indexOf('/private/');
          if (prIdx >= 0) addCandidate(pathname.slice(prIdx + 1));
        } catch {
          // Ignore URL parse errors; other candidates still apply.
        }
      }

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return fs.readFileSync(candidate);
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to read stored buffer:', storagePath, (error as Error).message);
      return null;
    }
  }

  async handleRequest(files, req, query, org, user): Promise<TApiResponse> {
    const {
      strategy,
      isPrivate,
      source,
      caption,
      propertyId,
      skipWatermark,
      fitAspect,
      watermarkPosition,
      watermarkScale,
    } = query;

    // define the path
    let uploadPath;
    if (isPrivate) {
      uploadPath = 'private';
    } else {
      uploadPath = 'public';
    }

    //decide upload strategy
    // if (strategy.toLowerCase() == FILE_UPLOAD_STRATEGY.CHUNKS.toLowerCase()) {
    //   // return await this.chunkFileUpload(req, query, files, org);
    // } else {
    if (files.length === 1) {
      return await this.singleFileUpload(
        files[0],
        uploadPath,
        org,
        isPrivate,
        user,
        source,
        caption,
        propertyId,
        skipWatermark,
        fitAspect,
        watermarkPosition,
        watermarkScale
      );
    } else {
      return await this.multipartFileUpload(
        files,
        uploadPath,
        org,
        isPrivate,
        user,
        source,
        caption,
        propertyId,
        skipWatermark,
        fitAspect,
        watermarkPosition,
        watermarkScale
      );
    }
    // }
  }
  async multipartFileUpload(
    files,
    uploadPath: string,
    org: string,
    isPrivate: boolean,
    user: TCurrentUserType,
    source?: string,
    caption?: string,
    propertyId?: string,
    skipWatermark?: boolean,
    fitAspect?: string,
    watermarkPosition?: WatermarkPosition,
    watermarkScale?: number
  ) {
    try {
      const fileData = [];
      for (const file of files) {
        const response = await this.singleFileUpload(
          file,
          uploadPath,
          org,
          isPrivate,
          user,
          source,
          caption,
          propertyId,
          skipWatermark,
          fitAspect,
          watermarkPosition,
          watermarkScale
        );
        fileData.push(response.data);
      }
      return {
        message: 'Files uploaded successfully',
        data: fileData,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error While uploading file to Locally ',
        error.message
      );
    }
  }
  async singleFileUpload(
    file,
    uploadPath: string,
    org: string,
    isPrivate: boolean,
    user: TCurrentUserType,
    source?: string,
    caption?: string,
    propertyId?: string,
    skipWatermark?: boolean,
    fitAspect?: string,
    watermarkPosition?: WatermarkPosition,
    watermarkScale?: number
  ) {
    try {
      //create folder path
      const fileType = getFileType(file.mimetype ? file.mimetype : file.type);
      const privateUrlPath = uploadPath + `/${org}` + `/${fileType}/`;
      const folderPath = privateUrlPath + getFolderStructure() + '/' + Date.now();
      const fileName = cleanFileName(file.originalname ? file.originalname : file.name);
      const filePath = folderPath + '/' + fileName;
      const baseUrl = process.env.BASE_URL;
      const url = baseUrl + '/' + filePath;
      ensureDirectoryPath(folderPath);

      // Build the final buffer: aspect-fit (optional) → watermark (unless skipped) → write once.
      // When we apply a watermark we also persist the pre-watermark buffer as `${filePath}.orig`
      // so downstream operations (e.g. /files/refit) can start from a clean, non-watermarked
      // source and avoid the double-watermark bug.
      // Watermarking supports animated formats (GIF) via Sharp's animated mode;
      // aspect-fit / variants stay skipped for animated content.
      const isImage = !!(file.mimetype && file.mimetype.startsWith('image/'));
      const sourceFormat = isImage ? getImageFormat(file.mimetype) : null;
      const animated = !!sourceFormat && isAnimatedFormat(sourceFormat);
      let finalBuffer: Buffer = file.buffer;

      if (sourceFormat && !animated && fitAspect) {
        try {
          const { buffer: fittedBuffer } = await fitBufferToAspectWithBlur(
            finalBuffer,
            parseAspectRatio(fitAspect),
            sourceFormat
          );
          finalBuffer = fittedBuffer;
        } catch (fitError) {
          console.error('Aspect-fit failed, continuing with original image:', fitError.message);
        }
      }

      const preWatermarkBuffer = finalBuffer;

      if (sourceFormat && !skipWatermark) {
        try {
          finalBuffer = await applyWatermarkToBuffer(
            finalBuffer,
            sourceFormat,
            watermarkPosition,
            watermarkScale
          );
        } catch (watermarkError) {
          // applyWatermarkToBuffer already falls back to the input buffer on failure,
          // but keep a log for diagnosability.
          console.error('Failed to apply watermark:', watermarkError.message);
        }
      }

      fs.writeFileSync(filePath, new Uint8Array(finalBuffer));

      // Persist the clean pre-watermark copy when we applied a watermark, so refit
      // can later rebuild a single-watermark 16:9 version without compounding.
      if (sourceFormat && !skipWatermark && preWatermarkBuffer !== finalBuffer) {
        try {
          fs.writeFileSync(filePath + '.orig', new Uint8Array(preWatermarkBuffer));
        } catch (origError) {
          console.error('Failed to persist .orig copy:', (origError as Error).message);
        }
      }

      // Generate image size variants (with watermarks)
      let sizesMetadata: {
        [key: string]: {
          file: string;
          width: number;
          height: number;
          filesize: number;
          source_url: string;
        };
      } = {};

      if (isImage) {
        try {
          // Get metadata for original image
          const imageMetadata = await sharp(filePath).metadata();

          // Store original image metadata
          sizesMetadata.original = {
            file: fileName,
            width: imageMetadata.width || 0,
            height: imageMetadata.height || 0,
            filesize: file.size,
            source_url: url,
          };

          // Variants only for formats Sharp can resize without destroying content
          // (animated GIFs skip this path, only `original` is stored).
          if (!sourceFormat || animated) {
            console.log(`Skipping variant generation for format: ${file.mimetype}`);
          } else {
            // Generate all size variants (from already watermarked original)
            const sizesDir = path.join(folderPath, 'sizes');
            ensureDirectoryPath(sizesDir);

            const baseName = fileName.replace(/\.[^.]+$/, '');
            const variants = await generateImageVariants(
              filePath,
              sizesDir,
              baseName,
              sourceFormat
            );

            // Build sizes metadata object with full URLs
            variants.forEach((variant) => {
              const variantRelativePath = path.join(folderPath, 'sizes', variant.file);
              sizesMetadata[variant.name] = {
                file: variant.file,
                width: variant.width,
                height: variant.height,
                filesize: variant.filesize,
                source_url: `${baseUrl}/${variantRelativePath}`,
              };
            });

            console.log(`Generated ${variants.length} image variants for: ${fileName}`);
          }
        } catch (variantError) {
          console.error('Failed to generate image variants:', variantError.message);
          // Continue with original only if variant generation fails
          sizesMetadata = {
            original: {
              file: fileName,
              width: 0,
              height: 0,
              filesize: file.size,
              source_url: url,
            },
          };
        }
      } else {
        // For non-image files, only store original
        sizesMetadata = {
          original: {
            file: fileName,
            width: 0,
            height: 0,
            filesize: file.size,
            source_url: url,
          },
        };
      }

      const createdBy = {
        userId: user.sub,
        userName: user.name,
      };

      const organization = user.organizationId
        ? await this._organizationService.findOne(user.organizationId)
        : null;

      // Property is optional - only fetch if propertyId is provided
      let propertyData: { id: string; name: string; domain: string } | undefined;
      if (propertyId) {
        const property = await this._propertyService.getById(propertyId);
        propertyData = {
          id: property._id.toString(),
          name: property.name,
          domain: property.domain,
        };
      }

      const organizationData = organization
        ? {
            id: organization._id.toString(),
            name: organization.organization_name,
            slug: organization.organization_name,
            domain: organization.domain,
          }
        : undefined;

      //save to db
      const fileUploadObj: IFile = {
        fileName,
        url,
        folderPath,
        mimeType: file.mimetype,
        organization: organizationData,
        property: propertyData,
        path: filePath,
        size: file.size,
        source,
        caption,
        sizes: sizesMetadata,
        isPrivate: isPrivate ? isPrivate : false,
        createdBy,
      };
      return await this._fileUploadService.saveFileToDB(fileUploadObj);
    } catch (error) {
      throw new InternalServerErrorException(
        'Error While uploading files to Locally ',
        error.message
      );
    }
  }

  //@TODO chunk upload
  async chunkFileUpload(req, query, files, org) {
    //   try {
    //     const response = await this._fileUploadService.chunkUpload(
    //       req,
    //       query,
    //       files,
    //     );
    //     console.log(response);
    //     if (response.status === true) {
    //       const fileData = await this._fileUploadService.saveFileToDB(response);
    //       return fileData;
    //     }
    //   } catch (error) {
    //     throw new InternalServerErrorException(
    //       'Error While uploading file to Locally in chunks ',
    //       error.message,
    //     );
    //   }
  }
}
