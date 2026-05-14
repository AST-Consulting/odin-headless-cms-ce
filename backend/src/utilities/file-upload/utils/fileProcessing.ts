import * as fs from 'fs';
export const ensureDirectoryPath = (directory: string): void => {
  try {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  } catch (error) {
    console.error(`Error creating directory: ${directory}`, error);
    throw error;
  }
};

export const createUniqueFileName = (file: Express.Multer.File): string => {
  // Security: Extract just the filename part (remove any path components)
  const baseName = file.originalname.split(/[/\\]/).pop() || 'file';

  const fileNameArray = baseName.split('.');
  const extension = fileNameArray.pop() || '';
  const originalName = fileNameArray.join('');

  // Security: Sanitize the filename - remove dangerous characters
  // Allow only alphanumeric, underscore, hyphen, and dot
  const sanitizedName = originalName
    .replace(/\s+/g, '-')              // Replace spaces with hyphens
    .replace(/[^a-zA-Z0-9_.-]/g, '')  // Remove other dangerous chars
    .replace(/-+/g, '-')               // Replace multiple hyphens with one
    .replace(/\.{2,}/g, '.')           // Prevent directory traversal via ..
    .replace(/^\.+/, '')               // Remove leading dots
    .substring(0, 30)                  // Keep name short and readable
    .replace(/-+$/, '');               // Remove trailing hyphens after truncation

  // Sanitize extension
  const sanitizedExt = extension
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .substring(0, 10);

  // Short 6-char hex suffix for uniqueness
  const uniqueSuffix = Math.random().toString(16).slice(2, 8);

  const fileName = (sanitizedName || 'file') + '-' + uniqueSuffix + (sanitizedExt ? '.' + sanitizedExt : '');

  return fileName;
};

export const getFolderStructure = (): string => {
  const date = new Date();
  const month = convertToTwoDigits(date.getUTCMonth() + 1); //months from 1-12
  const day = convertToTwoDigits(date.getUTCDate());
  const year = date.getUTCFullYear();
  let folder = `${year}/${month}/${day}`;
  folder = folder.replace(/ /g, '_').toLowerCase();
  return folder;
};
export const getFolderStructureNew = (): string => {
  const date = new Date();
  const month = convertToTwoDigits(date.getUTCMonth() + 1);
  const day = convertToTwoDigits(date.getUTCDate());
  const year = date.getUTCFullYear();
  const timestamp = date.getTime();
  return `${year}/${month}/${day}/${timestamp}`;
};

function convertToTwoDigits(number): string {
  return number < 10 ? `0${number}` : number.toString();
}

export function removeDirectory(path: string): void {
  fs.rmSync(path, { recursive: true, force: true });
}

export function cleanFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'file';
  }
  // Security: Extract just the filename part (remove any path components)
  const baseName = fileName.split(/[/\\]/).pop() || 'file';
  // Replace spaces with hyphens, then remove other special characters
  return baseName
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .replace(/-+/g, '-')      // Prevent multiple consecutive hyphens
    .replace(/\.{2,}/g, '.')  // Prevent .. sequences
    .replace(/^\.+/, '')      // Remove leading dots
    .substring(0, 200);       // Limit total length
}

export function getFileType(mimeType: string): string {
  const mimeTypes = {
    // Audio
    'audio/aac': 'audio',
    'audio/midi': 'audio',
    'audio/x-midi': 'audio',
    'audio/mpeg': 'audio',
    'audio/ogg': 'audio',
    'audio/opus': 'audio',
    'audio/wav': 'audio',
    'audio/webm': 'audio',
    'audio/3gpp': 'audio',
    'audio/3gpp2': 'audio',

    // Video
    'video/x-msvideo': 'video',
    'video/mp4': 'video',
    'video/mpeg': 'video',
    'video/ogg': 'video',
    'video/webm': 'video',
    'video/3gpp': 'video',
    'video/3gpp2': 'video',

    // Image
    'image/bmp': 'image',
    'image/gif': 'image',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/svg+xml': 'image',
    'image/tiff': 'image',
    'image/webp': 'image',
    'image/x-icon': 'image',

    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
    'application/vnd.ms-excel': 'excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
    'text/csv': 'csv',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',

    // Archives
    'application/zip': 'archive',
    'application/x-7z-compressed': 'archive',
    'application/x-rar-compressed': 'archive',
    'application/x-tar': 'archive',
    'application/gzip': 'archive',

    // Text
    'text/plain': 'text',
    'text/html': 'html',
    'text/css': 'css',
    'application/javascript': 'js',
    'application/json': 'json',
    'application/xml': 'xml',

    // Other common types
    'application/octet-stream': 'binary',
    'application/x-shockwave-flash': 'flash',
    'application/x-silverlight-app': 'silverlight',
  };

  if (typeof mimeType !== 'string') {
    return 'others';
  }

  for (const [key, value] of Object.entries(mimeTypes)) {
    if (mimeType === key || mimeType.startsWith(key)) {
      return value;
    }
  }

  return 'others';
}
