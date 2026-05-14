export interface IDriveService {
  getAuthUrl(userId: string): Promise<string>;
  handleAuthCallback(code: string, state: string): Promise<any>;
  isDriveConnected(userId: string): Promise<boolean>;
  uploadFile(
    userId: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
    folderPath?: string,
    metadata?: Record<string, any>
  ): Promise<DriveUploadResult>;
  uploadMultipleFiles(
    userId: string,
    files: Array<{
      fileName: string;
      fileBuffer: Buffer;
      mimeType: string;
      folderPath?: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<DriveUploadResult[]>;
  uploadBlogFile(
    userId: string,
    blogTitle: string,
    htmlContent: string,
    authorName?: string,
    siteSlug?: string
  ): Promise<DriveUploadResult>;
  getConnectionStatus(userId: string): Promise<DriveConnectionStatus>;
  disconnectDrive(userId: string): Promise<any>;
}

export interface DriveUploadResult {
  success: boolean;
  message: string;
  file?: {
    id: string;
    name: string;
    webViewLink: string;
    createdTime: string;
    folderPath: string;
  };
}

export interface DriveConnectionStatus {
  isConnected: boolean;
  lastSynced: Date | null;
}
