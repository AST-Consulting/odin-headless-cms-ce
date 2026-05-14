/* eslint-disable @typescript-eslint/naming-convention */
export interface IEnvironmentConfig {
  dev: string;
  isProd: boolean;
  nodeEnv: string;
  port: number;
  prod: string;
  hosted_url: string;
}

export interface IJwtConfig {
  accessExpires: string;
  accessSecret: string;
  refreshExpires: string;
  refreshSecret: string;
}

export interface ICorsConfig {
  credentials: boolean;
  origin: (RegExp | string)[];
}

export interface ICorsConfig {
  credentials: boolean;
  origin: (RegExp | string)[];
}

export interface IMongoDbConfig {
  database: string;
  password?: string;
  uri: string;
  username?: string;
}

// export interface IGupshupConfig {
//   sessionUrl: string;
//   templateUrl: string;
//   optinUrl: string;
// }

export interface IApiConfig {
  retryCount: number;
  authApi: string;
}

// add the BRAND NAME

export interface IFileUploadConfig {
  uploadService: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsS3Region?: string;
  awsS3BucketName?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinarySecretKey?: string;
  sshServerChunkPath?: string;
  uploadStrategy?: string;
  chunkSize?: number;
  baseUrl: string;
  brandName: string;
}

export interface IRateLimitConfig {
  limit: number;
  ttl: number;
}

export interface IElasticSearchConfig {
  node: string;
  username: string;
  password: string;
}

export interface IRedisConfig {
  host: string;
  port: number;
}
export interface ISesConfig {
  accessKey: string;
  secretAccessKey: string;
  region: string;
}
export interface ISendGridConfig {
  apiKey: string;
}
export interface IMailgunConfig {
  username: string;
  key: string;
  domain: string;
}
export interface IMailchimpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}
export interface IProviderConfig {
  email: string;
  whatsapp: string;
  sms: string;
}
export interface ITwilioConfig {
  accountSid: string;
  authToken: string;
  smsSenderId: string;
  whatsappSource: string;
}
export interface IMetaConfig {
  accessToken: string;
}
export interface IGupshupConfig {
  apiKey: string;
  whatsappSource: string;
}
