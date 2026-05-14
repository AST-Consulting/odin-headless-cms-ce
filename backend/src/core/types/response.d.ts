/* eslint-disable @typescript-eslint/naming-convention */
export type TApiResponse = {
  data: IData;
  message: string;
  statusCode?: number;
  success?: boolean;
  // metadata?: IMetaData;
  firstPage?: 1; // The number of the first page (optional, as it's commonly assumed to be 1)
  lastId?: null | number | string; // The id of the last item on that page
  lastSortValues?: any[]; // The sort values of the last item on that page
  lastPage?: number; // The number of the last page
  limit?: number; // The maximum number of items returned per page
  nextPage?: null | number; // The number of the next page (optional)
  page?: number; // The current page number
  pageCount?: number; // The total number of pages
  prevPage?: null | number; // The number of the previous page (optional)
  total?: number; // The total count of items across all pages
  user?: ISanitizedUser;
};

interface IData {
  [key: string]: any;
}
interface IMetaData {
  firstPage?: 1; // The number of the first page (optional, as it's commonly assumed to be 1)
  lastId?: null | number | string; // The id of the last item on that page
  lastPage?: number; // The number of the last page
  limit: number; // The maximum number of items returned per page
  nextPage?: null | number; // The number of the next page (optional)
  page: number; // The current page number
  pageCount: number; // The total number of pages
  prevPage?: null | number; // The number of the previous page (optional)
  totalCount: number; // The total count of items across all pages
}

export type TApiResponseWithMetadata = {
  data: IData;
  message: string;
  statusCode?: number;
  success?: boolean;
  metadata?: IMetaData;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export type TResponse<Success> = TErrorResponse | Success;

export type TErrorResponse = {
  error?: string;
  errorCode?: number;
  extras?: {
    [key: string]: string;
  };
  message: string;
  path?: string;
  sql?: string;
  stack?: any | object | string;
  statusCode: number;
  success: false;
  timestamp: string;
  metadata?: IMetaData;
};

export type TSuccessResponse = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  metadata: IMetaData;
  data: any;
  message: string;
  path?: string;
  statusCode: number;
  success: true;
  timestamp: string;
};
export type MessageData<T> = {
  message: string;
  data?: T;
};
export class ApiResponse<T> {
  constructor(
    // public success: boolean,
    public message: string,
    public total?: number,
    public result?: number,
    public data?: T,
    public error?: string
  ) {}

  static success<T>(message: string, data?: T): ApiResponse<T> {
    return new ApiResponse<T>(message, undefined, undefined, data);
  }

  static error<T>(message: string, error?: string): ApiResponse<T> {
    return new ApiResponse<T>(error, undefined, undefined, undefined, message);
  }

  static paginated<T>(message: string, data: T, result: number, total: number): ApiResponse<T> {
    return new ApiResponse<T>(message, total, result, data, undefined);
  }
}
w;
