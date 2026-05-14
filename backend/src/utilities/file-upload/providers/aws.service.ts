/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Express, query } from 'express';
import { FileUploadService } from '../fileUpload.service';
import {
  cleanFileName,
  createUniqueFileName,
  getFolderStructureNew,
} from '../utils/fileProcessing';
// import { ApiConfigService } from 'src/core/config/config.service';
import { getFileType } from '../utils/fileProcessing';
import { FileUpload } from '../entities/fileUpload.schema';
import { FILE_UPLOAD_STRATEGY } from 'src/core/constants/enums.constants';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { OrganizationService } from '@organization/organization.service';
import { PropertyService } from '@property/property.service';
import { generateImageVariantBuffers } from '../utils/image-variant-generator';
import { applyWatermarkToBuffer, WatermarkPosition } from '../utils/watermark';
import { fitBufferToAspectWithBlur, parseAspectRatio } from '../utils/aspect-fit';
import { getImageFormat, getMimeForFormat, isAnimatedFormat } from '../utils/image-format';
import * as sharp from 'sharp';

@Injectable()
export class AWSService {
  private readonly _s3Client = new S3Client({
    region: process.env.AWS_S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });

  constructor(
    // private readonly _configService: ApiConfigService,
    private readonly _fileUploadService: FileUploadService,
    private readonly _organizationService: OrganizationService,
    private readonly _propertyService: PropertyService
  ) {}

  /**
   * Fetch an object's bytes straight from S3. Returns null if the object
   * doesn't exist — callers can use this to opportunistically fetch the
   * `.orig` (pre-watermark) sibling without an HTTP round-trip through CDN.
   */
  async readStoredBuffer(key: string): Promise<Buffer | null> {
    try {
      const bucketName = process.env.AWS_S3_BUCKET_NAME;
      const res = await this._s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
      const body = res.Body as NodeJS.ReadableStream | undefined;
      if (!body) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chunks: any[] = [];
      for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      const name = (error as { name?: string })?.name;
      // NoSuchKey / 404 is expected for legacy uploads — not an error worth logging noisily
      if (name !== 'NoSuchKey' && name !== 'NotFound') {
        console.error('Failed to read S3 object:', key, (error as Error).message);
      }
      return null;
    }
  }

  async handleRequest(files, req, query, org, user) {
    const {
      path,
      strategy,
      isPrivate,
      source,
      propertyId,
      skipWatermark,
      fitAspect,
      watermarkPosition,
      watermarkScale,
    } = query;

    //decide upload strategy
    if (strategy == FILE_UPLOAD_STRATEGY.CHUNKS) {
      // @TODO chunk upload
      // return await this.uploadChunkFile(req, query, path);
    } else {
      if (files.length === 1) {
        return await this.singleFileUpload(
          files[0],
          path,
          org,
          isPrivate,
          source,
          user,
          propertyId,
          skipWatermark,
          fitAspect,
          watermarkPosition,
          watermarkScale
        );
      } else {
        return await this.multipartFileUpload(
          files,
          path,
          org,
          isPrivate,
          source,
          user,
          propertyId,
          skipWatermark,
          fitAspect,
          watermarkPosition,
          watermarkScale
        );
      }
    }
  }

  async singleFileUpload(
    file: Express.Multer.File,
    path: string,
    org: string,
    isPrivate: boolean,
    source: string,
    user: TCurrentUserType,
    propertyId?: string,
    skipWatermark?: boolean,
    fitAspect?: string,
    watermarkPosition?: WatermarkPosition,
    watermarkScale?: number
  ): Promise<{
    message: string;
    data: any;
  }> {
    try {
      const bucketName = process.env.AWS_S3_BUCKET_NAME;

      const tempFileName = createUniqueFileName(file);
      const fileType = getFileType(file.mimetype);
      const privateUrlPath = 'uploads';
      const folderPath = privateUrlPath + '/' + getFolderStructureNew();

      const fileName = cleanFileName(tempFileName);
      const filePath = folderPath + '/' + fileName;

      // Compress images with mozJPEG before uploading to S3
      const isImage = file.mimetype?.startsWith('image/');
      let uploadBuffer = file.buffer;
      let uploadSize = file.size;
      let originalWidth = 0;
      let originalHeight = 0;

      // When we apply a watermark we also upload the pre-watermark buffer as
      // `${filePath}.orig` so /files/refit can later start from a clean source
      // and produce a single-watermark 16:9 output without compounding.
      let preWatermarkBuffer: Buffer | undefined;

      // Watermarking supports animated formats (GIF) via Sharp's animated mode.
      // Aspect-fit / variants stay gated because they reshape content, which
      // doesn't make sense per-frame for animation.
      const sourceFormat = isImage ? getImageFormat(file.mimetype) : null;
      const animated = !!sourceFormat && isAnimatedFormat(sourceFormat);

      if (isImage) {
        try {
          const meta = await sharp(file.buffer).metadata();
          originalWidth = meta.width || 0;
          originalHeight = meta.height || 0;

          if (sourceFormat) {
            // 1) Aspect-fit: pad to target ratio with a blurred copy if caller requested it.
            // Skipped for animated content — reshaping per frame isn't something we do.
            let processedBuffer: Buffer = file.buffer;
            if (fitAspect && !animated) {
              try {
                const {
                  buffer: fittedBuffer,
                  wasModified,
                  width,
                  height,
                } = await fitBufferToAspectWithBlur(
                  file.buffer,
                  parseAspectRatio(fitAspect),
                  sourceFormat
                );
                processedBuffer = fittedBuffer;
                if (wasModified) {
                  originalWidth = width;
                  originalHeight = height;
                }
              } catch (fitError) {
                console.error(
                  'Aspect-fit failed, continuing with original image:',
                  (fitError as Error).message
                );
              }
            }

            // 2) Watermark unless the caller already has one baked in (crop/AI gen).
            // skipWatermark keeps whatever aspect-fit produced (already encoded in
            // source format) or the raw source bytes — no redundant transcode.
            if (skipWatermark) {
              uploadBuffer = processedBuffer;
            } else {
              preWatermarkBuffer = processedBuffer;
              uploadBuffer = await applyWatermarkToBuffer(
                processedBuffer,
                sourceFormat,
                watermarkPosition,
                watermarkScale
              );
            }
            uploadSize = uploadBuffer.length;
          }
          // Unknown image format: upload original bytes untouched.
        } catch {
          /* non-image or corrupt file — upload as-is */
        }
      }

      // Format is preserved end-to-end, so ContentType always matches the source
      // mimetype. Set it explicitly so S3 doesn't default to binary/octet-stream.
      const uploadContentType = file.mimetype || 'application/octet-stream';

      const res = await this._s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: filePath,
          Body: uploadBuffer,
          ACL: 'public-read',
          ContentType: uploadContentType,
        })
      );

      // Persist the clean pre-watermark copy (best-effort — failures are non-fatal).
      // Source format is preserved through aspect-fit, so ContentType matches file.mimetype.
      if (preWatermarkBuffer) {
        try {
          await this._s3Client.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: filePath + '.orig',
              Body: preWatermarkBuffer,
              ACL: 'public-read',
              ContentType: uploadContentType,
            })
          );
        } catch (origError) {
          console.error('Failed to persist .orig copy on S3:', (origError as Error).message);
        }
      }

      if (res.$metadata.httpStatusCode === 200) {
        const url = `${process.env.CDN_URL}/${filePath}`;

        const createdBy = { userId: user.sub, userName: user.name };
        const updatedBy = { userId: user.sub, userName: user.name };

        const organization = user.organizationId
          ? await this._organizationService.findOne(user.organizationId)
          : null;

        let propertyData = undefined;
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

        const sizesMetadata: Record<
          string,
          { file: string; width: number; height: number; filesize: number; source_url: string }
        > = {
          original: {
            file: fileName,
            width: originalWidth,
            height: originalHeight,
            filesize: uploadSize,
            source_url: url,
          },
        };

        // Generate and upload variants for image files. Animated formats are
        // skipped — per-frame resize would bloat file size and lose frame timing.
        if (isImage && sourceFormat && !animated) {
          const baseName = fileName.replace(/\.[^.]+$/, '');
          const variants = await generateImageVariantBuffers(file.buffer, baseName, sourceFormat);
          const variantContentType = getMimeForFormat(sourceFormat);

          await Promise.allSettled(
            variants.map(async (variant) => {
              const variantKey = `${folderPath}/sizes/${variant.fileName}`;
              const variantRes = await this._s3Client.send(
                new PutObjectCommand({
                  Bucket: bucketName,
                  Key: variantKey,
                  Body: variant.buffer,
                  ACL: 'public-read',
                  ContentType: variantContentType,
                })
              );
              if (variantRes.$metadata.httpStatusCode === 200) {
                const variantUrl = `${process.env.CDN_URL}/${variantKey}`;
                sizesMetadata[variant.name] = {
                  file: variant.fileName,
                  width: variant.width,
                  height: variant.height,
                  filesize: variant.filesize,
                  source_url: variantUrl,
                };
              }
            })
          );
        }

        const fileUploadObj: FileUpload = {
          fileName,
          url,
          folderPath,
          mimeType: file.mimetype,
          organization: organizationData,
          property: propertyData,
          path: filePath,
          size: file.size,
          source,
          sizes: sizesMetadata,
          isPrivate,
          createdBy,
          updatedBy,
        };

        return await this._fileUploadService.saveFileToDB(fileUploadObj);
      } else {
        throw new InternalServerErrorException('Error While uploading file to S3');
      }
    } catch (error) {
      throw new InternalServerErrorException('Error While uploading file to S3', error.message);
    }
  }

  async multipartFileUpload(
    files,
    path,
    org,
    isPrivate: boolean,
    source: string,
    user: TCurrentUserType,
    propertyId?: string,
    skipWatermark?: boolean,
    fitAspect?: string,
    watermarkPosition?: WatermarkPosition,
    watermarkScale?: number
  ) {
    try {
      if (!files) {
        throw new Error();
      }

      const filesData = [];

      for (const file of files) {
        const response = await this.singleFileUpload(
          file,
          path,
          org,
          isPrivate,
          source,
          user,
          propertyId,
          skipWatermark,
          fitAspect,
          watermarkPosition,
          watermarkScale
        );
        filesData.push(response.data);
      }

      return {
        message: 'Files uploaded successfully',
        data: filesData,
      };
    } catch (error) {
      return new InternalServerErrorException('Error While uploading files to S3', error.message);
    }
  }

  //@TODO chunk upload
  // async uploadChunkFile(req, query, path) {
  //   try {
  //     console.log('uploading chunk file');
  //     const bucketName = process.env.AWS_S3_BUCKET_NAME;
  //     // This assumes the chunkUpload function handles the local file chunking and returns metadata
  //     const response = await this._fileUploadService.chunkUpload(
  //       req,
  //       query,
  //       // this.orgSlug,
  //     );
  //     console.log('-------', response);
  //     return;
  //     if (response.status === true) {
  //       const fileName = response.fileName;
  //       const localPath = response.localPath; // Local storage path of the file chunks
  //       // Generate the folder structure consistent with singleFileUpload
  //       const fileType = getFileType(response.mimeType);
  //       const privateUrlPath = path + `/${this.orgSlug}` + `/${fileType}/`;
  //       const folderPath =
  //         privateUrlPath + getFolderStructure() + '/' + Date.now();
  //       const cleanedFileName = cleanFileName(fileName);
  //       const filePath = folderPath + '/' + cleanedFileName;
  //       // Upload the file in chunks to S3
  //       const upload = await new Upload({
  //         author: this._s3Client,
  //         params: {
  //           Bucket: bucketName,
  //           Key: filePath,
  //           Body: readFileSync(localPath + '/' + cleanedFileName),
  //         },
  //         partSize: 5 * 1024 * 1024, // 5 MB chunks
  //       }).done();
  //       // Clean up the local directory after upload
  //       removeDirectory(localPath);
  //       if (upload.$metadata.httpStatusCode === 200) {
  //         const url = `https://${bucketName}.s3-${this._configService.fileUpload.awsS3Region}.amazonaws.com/${filePath}`;
  //         // Create the FileUpload object similar to singleFileUpload
  //         const fileUploadObj: FileUpload = {
  //           fileName: cleanedFileName,
  //           url,
  //           folderPath,
  //           mimeType: response.mimeType,
  //           organization: this.org._id,
  //           path: filePath,
  //           size: response.size,
  //           sizes: { original: url },
  //         };
  //         // Save file metadata to the database
  //         const savedFile =
  //           await this._fileUploadService.saveFileToDB(fileUploadObj);
  //         return savedFile;
  //       } else {
  //         throw new InternalServerErrorException(
  //           'Error while uploading chunked file to S3',
  //         );
  //       }
  //     } else {
  //       throw new InternalServerErrorException(
  //         'Error processing chunk upload on server',
  //       );
  //     }
  //   } catch (error) {
  //     throw new InternalServerErrorException(
  //       'Error while uploading file chunks to S3',
  //       error.message,
  //     );
  //   }
  // }
}
