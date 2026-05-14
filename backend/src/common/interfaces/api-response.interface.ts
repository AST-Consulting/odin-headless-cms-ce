export interface ApiResponse<T = any> {
  message: string;
  success: boolean;
  data?: T;
}

export interface ArticleApiResponse extends ApiResponse {
  message: string;
  success: boolean;
  data?: any;
}

export interface CategoriesApiResponse extends ApiResponse<any[]> {
  message: string;
  success: boolean;
  data?: any[];
}
