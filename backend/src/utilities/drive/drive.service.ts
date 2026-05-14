import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { drive_v3 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import {
  IDriveService,
  DriveUploadResult,
  DriveConnectionStatus,
} from './interfaces/drive.interface';

@Injectable()
export class DriveService implements IDriveService {
  private readonly logger = new Logger(DriveService.name);
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ];

  constructor(private readonly userService: UserService) { }

  /**
   * Get OAuth2 client for Google Drive
   */
  private getOAuth2Client(): OAuth2Client {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );
  }

  /**
   * Get Google Drive API instance
   */
  private getDriveAPI(auth: OAuth2Client): drive_v3.Drive {
    return google.drive({ version: 'v3', auth });
  }

  /**
   * Generate OAuth2 authorization URL
   */
  async getAuthUrl(userId: string): Promise<string> {
    const oauth2Client = this.getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent',
      state: userId, // Pass userId in state for security
    });

    return authUrl;
  }

  /**
   * Handle OAuth2 callback and save tokens
   */
  async handleAuthCallback(code: string, state: string): Promise<any> {
    try {
      const oauth2Client = this.getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);

      // Update user with Google Drive tokens using UserService
      const user = await this.userService.findByIdAndUpdate(state, {
        $set: {
          'accountLinked.google_drive': {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            scope: tokens.scope,
            tokenType: tokens.token_type,
            expiresOn: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            lastSynced: new Date(),
          },
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      return {
        success: true,
        message: 'Google Drive connected successfully',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      };
    } catch (error) {
      this.logger.error('Error handling Google Drive auth callback:', error);
      throw new InternalServerErrorException('Failed to connect Google Drive');
    }
  }

  /**
   * Check if user has Google Drive connected
   */
  async isDriveConnected(userId: string): Promise<boolean> {
    const user = await this.userService.findById(userId);
    return !!(user as any)?.accountLinked?.google_drive?.accessToken;
  }

  /**
   * Refresh access token if expired
   */
  private async refreshTokenIfNeeded(userId: string): Promise<OAuth2Client> {
    const user = await this.userService.findById(userId);
    if (!(user as any)?.accountLinked?.google_drive) {
      throw new BadRequestException('Google Drive not connected');
    }

    const driveConfig = (user as any).accountLinked.google_drive;
    const oauth2Client = this.getOAuth2Client();

    oauth2Client.setCredentials({
      access_token: driveConfig.accessToken,
      refresh_token: driveConfig.refreshToken,
      scope: driveConfig.scope,
      token_type: driveConfig.tokenType,
    });

    // Check if token is expired
    if (driveConfig.expiresOn && new Date() >= driveConfig.expiresOn) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update user with new tokens using UserService
        await this.userService.findByIdAndUpdate(userId, {
          $set: {
            'accountLinked.google_drive.accessToken': credentials.access_token,
            'accountLinked.google_drive.expiresOn': credentials.expiry_date
              ? new Date(credentials.expiry_date)
              : null,
            'accountLinked.google_drive.lastSynced': new Date(),
          },
        });

        oauth2Client.setCredentials(credentials);
      } catch (error) {
        this.logger.error('Error refreshing Google Drive token:', error);
        throw new BadRequestException('Failed to refresh Google Drive access');
      }
    }

    return oauth2Client;
  }

  /**
   * Create or get folder for uploads
   */
  private async getOrCreateFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentFolderId?: string
  ): Promise<string> {
    try {
      let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
      }

      // First, check if folder already exists
      const existingFolders = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
      });

      if (existingFolders.data.files && existingFolders.data.files.length > 0) {
        return existingFolders.data.files[0].id;
      }

      // Create new folder if it doesn't exist
      const folderMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentFolderId) {
        folderMetadata.parents = [parentFolderId];
      }

      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
      });

      return folder.data.id;
    } catch (error) {
      this.logger.error('Error creating/getting folder:', error);
      throw new InternalServerErrorException('Failed to create folder');
    }
  }

  /**
   * Upload any file to Google Drive with flexible folder structure
   */
  async uploadFile(
    userId: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
    folderPath?: string,
    metadata?: Record<string, any>
  ): Promise<DriveUploadResult> {
    try {
      const oauth2Client = await this.refreshTokenIfNeeded(userId);
      const drive = this.getDriveAPI(oauth2Client);

      let finalFolderId = 'root'; // Default to root folder

      // Create folder structure if provided
      if (folderPath) {
        const folderNames = folderPath.split('/').filter((name) => name.trim());
        for (const folderName of folderNames) {
          finalFolderId = await this.getOrCreateFolder(drive, folderName, finalFolderId);
        }
      }

      // Create file metadata
      const fileMetadata: any = {
        name: fileName,
        parents: [finalFolderId],
      };

      // Add custom metadata if provided
      if (metadata) {
        fileMetadata.properties = metadata;
      }

      // Create temporary file for upload
      const tempFilePath = path.join(process.cwd(), 'temp', `${Date.now()}_${fileName}`);
      const tempDir = path.dirname(tempFilePath);

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, new Uint8Array(fileBuffer));

      try {
        const media = {
          mimeType: mimeType,
          body: fs.createReadStream(tempFilePath),
        };

        const file = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, name, webViewLink, createdTime',
        });

        this.logger.log(`File uploaded successfully: ${fileName}`);

        return {
          success: true,
          message: 'File uploaded to Google Drive successfully',
          file: {
            id: file.data.id,
            name: file.data.name,
            webViewLink: file.data.webViewLink,
            createdTime: file.data.createdTime,
            folderPath: folderPath || 'root',
          },
        };
      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    } catch (error) {
      this.logger.error('Error uploading file to Google Drive:', error);
      throw new InternalServerErrorException('Failed to upload file to Google Drive');
    }
  }

  /**
   * Upload blog file to Google Drive with day-wise organization
   */
  async uploadBlogFile(
    userId: string,
    blogTitle: string,
    htmlContent: string,
    authorName?: string,
    siteSlug?: string
  ): Promise<DriveUploadResult> {
    try {
      // Convert HTML to DOCX
      const docxBuffer = await this.convertHtmlToDocx(htmlContent);

      // Create day-wise folder structure
      const today = new Date();
      const dateFolder = format(today, 'yyyy-MM-dd');
      const blogFolderName = `Blogs_${dateFolder}`;

      // Build folder path
      let folderPath = blogFolderName;
      if (siteSlug) {
        folderPath += `/Site_${siteSlug}`;
      }

      // Create safe filename
      const safeTitle = blogTitle.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
      const fileName = `${safeTitle}_${format(today, 'HH-mm')}.docx`;

      // Upload using the generic uploadFile method
      const result = await this.uploadFile(
        userId,
        fileName,
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        folderPath,
        {
          blogTitle,
          authorName,
          siteSlug,
          uploadDate: today.toISOString(),
        }
      );

      return result;
    } catch (error) {
      this.logger.error('Error uploading blog file to Google Drive:', error);
      throw new InternalServerErrorException('Failed to upload blog file to Google Drive');
    }
  }

  /**
   * Convert HTML content to DOCX format
   */
  private async convertHtmlToDocx(htmlContent: string): Promise<Buffer> {
    try {
      // Use the same library as utils.ts
      // Defer requiring to avoid affecting NestJS DI at import time
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const HTMLtoDOCX = require('html-to-docx');
      const html = htmlContent.includes('<html')
        ? htmlContent
        : `<!doctype html><html><head><meta charset="utf-8"></head><body>${htmlContent}</body></html>`;
      const buffer = await HTMLtoDOCX(html, null, {});
      return buffer as Buffer;
    } catch (error) {
      this.logger.error('Error converting HTML to DOCX:', error);
      throw new InternalServerErrorException('Failed to convert HTML to DOCX');
    }
  }

  /**
   * Get user's Google Drive connection status
   */
  async getConnectionStatus(userId: string): Promise<DriveConnectionStatus> {
    const user = await this.userService.findById(userId);
    const isConnected = !!(user as any)?.accountLinked?.google_drive?.accessToken;

    return {
      isConnected,
      lastSynced: (user as any)?.accountLinked?.google_drive?.lastSynced || null,
    };
  }

  /**
   * Upload multiple files to Google Drive
   */
  async uploadMultipleFiles(
    userId: string,
    files: Array<{
      fileName: string;
      fileBuffer: Buffer;
      mimeType: string;
      folderPath?: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<DriveUploadResult[]> {
    const results: DriveUploadResult[] = [];

    for (const file of files) {
      try {
        const result = await this.uploadFile(
          userId,
          file.fileName,
          file.fileBuffer,
          file.mimeType,
          file.folderPath,
          file.metadata
        );
        results.push(result);
      } catch (error) {
        this.logger.error(`Error uploading file ${file.fileName}: ${error.message}`);
        results.push({
          success: false,
          message: `Failed to upload ${file.fileName}: ${error.message}`,
        });
      }
    }

    return results;
  }

  /**
   * Disconnect Google Drive
   */
  async disconnectDrive(userId: string): Promise<any> {
    await this.userService.findByIdAndUpdate(userId, {
      $unset: { 'accountLinked.google_drive': 1 },
    });

    return {
      success: true,
      message: 'Google Drive disconnected successfully',
    };
  }
}
