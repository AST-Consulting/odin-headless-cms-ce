export interface IFile {
  fileName: string;
  mimeType: string;
  size?: number;
  source?: string;
  caption?: string;
  sizes?: {
    [key: string]: {
      file: string;
      width: number;
      height: number;
      filesize: number;
      source_url: string;
    };
  };
  url: string;
  path: string;
  folderPath: string;
  isPrivate: boolean;
  createdBy: {
    userId: string;
    userName: string;
  };
  organization: {
    id: string,
    name?: string,
    slug?: string,
    domain?: string
  };
  property?: {
    id: string,
    name?: string,
    domain?: string
  };
  wpId?: number;
  _id?: string;
}
