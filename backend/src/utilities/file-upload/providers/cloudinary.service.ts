/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { FileUploadService } from '../fileUpload.service';
import { cleanFileName, createUniqueFileName } from '../utils/fileProcessing';
// import { ApiConfigService } from 'src/core/config/config.service';
// import { FILE_UPLOAD_STRATEGY } from 'src/core/constants/enum.constants';
// import { getFileType, slugify } from 'src/core/utils/utils';
import { FileUpload } from '../entities/fileUpload.schema';
// import { currentUserType } from 'src/core/types/user.type';

import { getFileType } from '../utils/fileProcessing';
import { FILE_UPLOAD_STRATEGY } from 'src/core/constants/enums.constants';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { OrganizationService } from '@organization/organization.service';
import { PropertyService } from '@property/property.service';
@Injectable()
export class CloudinaryService {
  private readonly _cloudinaryClient = cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
  });

  constructor(
    // private readonly _configService: ApiConfigService,
    private readonly _fileUploadService: FileUploadService,
    private readonly _organizationService: OrganizationService,
    private readonly _propertyService: PropertyService
  ) { }

  async handleRequest(files, req, query, org, user) {
    const { path, strategy, isPrivate, source, propertyId } = query;

    if (strategy && strategy.toLowerCase() === FILE_UPLOAD_STRATEGY.CHUNKS.toLowerCase()) {
      return await this.chunkFileUpload(req, query);
    } else {
      if (files.length === 1) {
        return await this.singleFileUpload(files[0], path, org, isPrivate, source, user, propertyId);
      } else {
        return await this.multipartFileUpload(files, path, org, isPrivate, source, user, propertyId);
      }
    }
  }

  async singleFileUpload(
    file,
    path,
    org: string,
    isPrivate: boolean,
    source: string,
    user: TCurrentUserType,
    propertyId?: string
  ): Promise<{
    message: string;
    data: any;
  }> {
    try {
      const fileType = getFileType(file.mimetype);
      const fileName = createUniqueFileName(file);
      const date = Date.now();

      const privateUrlPath = `${path}/${org}/${fileType}/${date}`;
      const folderPath = privateUrlPath;
      const fileNameClean = cleanFileName(fileName);
      const filePath = `${folderPath}/${fileNameClean}`;

      console.log(privateUrlPath);

      // Upload file to Cloudinary
      const result: UploadApiResponse = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              public_id: fileNameClean,
              folder: folderPath,
            },
            (error, result) => {
              if (error) {
                return reject(error);
              }
              resolve(result);
            }
          )
          .end(file.buffer);
      });

      if (!result) {
        throw new InternalServerErrorException('Cloudinary upload failed');
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

      console.log('Cloudinary response received:', result.public_id);
      // Save file details to MongoDB
      const fileUploadObj: FileUpload = {
        fileName: fileNameClean,
        url: result.secure_url, // Cloudinary's secure URL
        folderPath,
        mimeType: file.mimetype,
        organization: organizationData,
        property: propertyData,
        path: filePath,
        size: file.size,
        source,
        // sizes: { original: result.secure_url },
        isPrivate,
        createdBy,
      };

      const savedFile = await this._fileUploadService.saveFileToDB(fileUploadObj);

      return {
        message: 'File uploaded successfully to Cloudinary',
        data: savedFile,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error While uploading file to Cloudinary',
        error.message
      );
    }
  }

  async multipartFileUpload(files, path, org: string, isPrivate: boolean, source: string, user: TCurrentUserType, propertyId?: string) {
    try {
      const filesData = [];
      for (const file of files) {
        const response = await this.singleFileUpload(file, path, org, isPrivate, source, user, propertyId);
        filesData.push(response.data);
      }

      return {
        message: 'Files uploaded successfully',
        data: filesData,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error While uploading files to Cloudinary',
        error.message
      );
    }
  }

  async chunkFileUpload(req, query) { }
}
