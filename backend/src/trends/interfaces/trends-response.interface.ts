// Based on SerpApi Google Trends API response structure
// Ref: https://serpapi.com/google-trends-api

export interface TrendsResponse {
  search_metadata?: {
    id: string;
    status: string;
    created_at: string;
    processed_at: string;
    total_time_taken: number;
    [key: string]: any; // Allow additional metadata fields
  };
  search_parameters?: {
    engine: string;
    q: string;
    data_type?: string;
    geo?: string;
    date?: string;
    hl?: string;
    [key: string]: any; // Allow additional parameters
  };
  interest_over_time?: {
    timeline_data: Array<{
      date: string;
      timestamp: string;
      values: Array<{
        query: string;
        value: string;
        extracted_value: number;
      }>;
    }>;
    averages?: Array<{
      query: string;
      value: number;
    }>;
  };
  interest_by_region?: Array<{
    location: string;
    extracted_value: number;
    value: string;
    link: string;
  }>;
  related_topics?: {
    top?: Array<{
      query: string;
      value: number;
      link: string;
      topic_type: string;
      topic_mid?: string;
      topic_title?: string;
    }>;
    rising?: Array<{
      query: string;
      value: number;
      link: string;
      topic_type: string;
      topic_mid?: string;
      topic_title?: string;
    }>;
  };
  related_queries?: {
    top?: Array<{
      query: string;
      value: number;
      link: string;
    }>;
    rising?: Array<{
      query: string;
      value: number;
      link: string;
    }>;
  };
  error?: string; // In case SerpApi returns an error
  [key: string]: any; // Allow any additional fields SerpApi might add
}
