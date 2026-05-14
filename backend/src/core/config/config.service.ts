import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  IApiConfig,
  ICorsConfig,
  IEnvironmentConfig,
  IFileUploadConfig,
  IJwtConfig,
  IMongoDbConfig,
  IRateLimitConfig,
  IElasticSearchConfig,
  IRedisConfig,
  ISesConfig,
  ISendGridConfig,
  IMailgunConfig,
  IMailchimpConfig,
  IProviderConfig,
  ITwilioConfig,
  IMetaConfig,
  IGupshupConfig,
} from './env.interface';

@Injectable()
export class ApiConfigService {
  private _apiConfigs: IApiConfig;
  private _cors: Readonly<ICorsConfig>;
  private _environment: Readonly<IEnvironmentConfig>;
  private _jwt: Readonly<IJwtConfig>;
  private _mongoDB: Readonly<IMongoDbConfig>;
  private _gupshup: Readonly<IGupshupConfig>;
  private _version: string;
  private _webSiteUrl: string; // Add this line
  private _fileUpload: Readonly<IFileUploadConfig>;
  private _rateLimit: IRateLimitConfig;
  private _redis: Readonly<IRedisConfig>;
  private _elasticSearch: IElasticSearchConfig;
  private _ses: ISesConfig;
  private _sendGrid: ISendGridConfig;
  private _mailgun: IMailgunConfig;
  private _mailchimp: IMailchimpConfig;
  private _provider: IProviderConfig;
  private _twilio: ITwilioConfig;
  private _meta: IMetaConfig;
  private _brandName: string;
  constructor(private readonly _configService: ConfigService) {
    const origins = this._configService.get<string>('CORS_ORIGINS').split(',');
    const corsOrigins: (RegExp | string)[] = origins.map((origin) => {
      if (origin.startsWith('/') && origin.endsWith('/')) {
        const regexString = origin.slice(1, -1);
        return new RegExp(regexString);
      }
      return origin;
    });

    this._fileUpload = {
      uploadService: this._configService.get<string>('UPLOAD_SERVICE'),
      awsAccessKey: this._configService.get<string>('AWS_ACCESS_KEY'),
      awsSecretKey: this._configService.get<string>('AWS_SECRET_KEY'),
      awsS3Region: this._configService.get<string>('AWS_S3_REGION'),
      awsS3BucketName: this._configService.get<string>('AWS_S3_BUCKET_NAME'),
      cloudinaryCloudName: this._configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      cloudinaryApiKey: this._configService.get<string>('CLOUDINARY_API_KEY'),
      cloudinarySecretKey: this._configService.get<string>('CLOUDINARY_SECRET_KEY'),
      sshServerChunkPath: this._configService.get<string>('SSH_SERVER_CHUNK_PATH'),
      uploadStrategy: this._configService.get<string>('UPLOAD_STRATEGY'),
      chunkSize: this._configService.get<number>('CHUNK_SIZE', 10485760),
      baseUrl: this._configService.get<string>('BASE_URL'),
      brandName: this._configService.get<string>('BRAND_NAME'),
    };

    this._cors = {
      credentials: this._configService.get<boolean>('CORS_CREDENTIALS'),
      origin: corsOrigins,
    };

    this._apiConfigs = {
      retryCount: this._configService.get<number>('RETRY_COUNT', 3),
      authApi: this._configService.get<string>('AUTH_API'),
    };

    this._environment = {
      dev: this._configService.get<string>('DEV'),
      isProd:
        this._configService.get<string>('NODE_ENV') === this._configService.get<string>('PROD'),
      nodeEnv: this._configService.get<string>('NODE_ENV'),
      port: this._configService.get<number>('PORT', 3003),
      prod: this._configService.get<string>('PROD'),
      hosted_url: this._configService.get<string>('HOSTED_URL'),
    };

    this._version = this._configService.get<string>('VERSION');

    this._mongoDB = {
      database: this._configService.get<string>('MONGODB_DATABASE'),
      uri: this._configService.get<string>('DATABASE_URL'),
    };
    this._jwt = {
      accessExpires: this._configService.get<string>('JWT_EXPIRES'),
      accessSecret: this._configService.get<string>('JWT_SECRET'),
      refreshExpires: this._configService.get<string>('JWT_REFRESH_EXPIRES'),
      refreshSecret: this._configService.get<string>('JWT_REFRESH_SECRET'),
    };
    this._rateLimit = {
      limit: this._configService.get<number>('RATE_LIMIT', 10),
      ttl: this._configService.get<number>('RATE_LIMIT_TTL', 60),
    };
    this._elasticSearch = {
      node: this._configService.get<string>('ELASTICSEARCH_NODE', ''),
      username: this._configService.get<string>('ELASTICSEARCH_USERNAME', ''),
      password: this._configService.get<string>('ELASTICSEARCH_PASSWORD', ''),
    };
    // add redis config
    this._redis = {
      host: this._configService.get<string>('REDIS_HOST', 'localhost'),
      port: this._configService.get<number>('REDIS_PORT', 6379),
    };

    this._ses = {
      accessKey: this._configService.get<string>('ACCESS_KEY'),
      secretAccessKey: this._configService.get<string>('SECRET_ACCES_KEY'),
      region: this._configService.get<string>('REGION'),
    };
    this._ses = {
      accessKey: this._configService.get<string>('ACCESS_KEY'),
      secretAccessKey: this._configService.get<string>('SECRET_ACCES_KEY'),
      region: this._configService.get<string>('REGION'),
    };
    this._sendGrid = {
      apiKey: this._configService.get<string>('SENDGRID_API_KEY'),
    };
    this._mailgun = {
      username: this._configService.get<string>('MAILGUN_USERNAME'),
      key: this._configService.get<string>('MAILGUN_KEY'),
      domain: this._configService.get<string>('MAILGUN_DOMAIN'),
    };
    this._mailchimp = {
      host: this._configService.get<string>('MAILCHIMP_HOST'),
      port: this._configService.get<number>('MAILCHIMP_PORT'),
      user: this._configService.get<string>('MAILCHIMP_USER'),
      pass: this._configService.get<string>('MAILCHIMP_PASS'),
    };
    this._provider = {
      email: this._configService.get<string>('EMAIL_PROVIDER'),
      whatsapp: this._configService.get<string>('WHATSAPP_PROVIDER'),
      sms: this._configService.get<string>('SMS_PROVIDER'),
    };
    this._twilio = {
      accountSid: this._configService.get<string>('TWILIO_ACCOUNT_SID'),
      authToken: this._configService.get<string>('TWILIO_AUTH_TOKEN'),
      smsSenderId: this._configService.get<string>('TWILIO_SMS_SENDER_ID'),
      whatsappSource: this._configService.get<string>('TWILIO_WHATSAPP_SOURCE'),
    };
    this._meta = {
      accessToken: this._configService.get<string>('META_ACCESS_TOKEN'),
    };
    this._gupshup = {
      apiKey: this._configService.get<string>('GUPSHUP_API_KEY'),
      whatsappSource: this._configService.get<string>('GUPSHUP_WHATSAPP_SOURCE'),
    };
    this._brandName = this._configService.get<string>('BRAND_NAME');
  }

  get apiConfigs(): IApiConfig {
    return this._apiConfigs;
  }

  get cors(): ICorsConfig {
    return this._cors;
  }

  get environment(): IEnvironmentConfig {
    return this._environment;
  }

  get jwt(): IJwtConfig {
    return this._jwt;
  }

  get mongoDB(): IMongoDbConfig {
    return this._mongoDB;
  }

  get version(): string {
    return this._version;
  }

  get webSiteUrl(): string {
    return this._webSiteUrl;
  }
  get fileUpload(): IFileUploadConfig {
    return this._fileUpload;
  }

  get rateLimit(): IRateLimitConfig {
    return this._rateLimit;
  }

  get elasticSearch(): IElasticSearchConfig {
    return this._elasticSearch;
  }

  get redis(): IRedisConfig {
    return this._redis;
  }

  get ses(): ISesConfig {
    return this._ses;
  }
  get sendGrid(): ISendGridConfig {
    return this._sendGrid;
  }
  get mailchimp(): IMailchimpConfig {
    return this._mailchimp;
  }
  get mailgun(): IMailgunConfig {
    return this._mailgun;
  }
  get provider(): IProviderConfig {
    return this._provider;
  }
  get twilio(): ITwilioConfig {
    return this._twilio;
  }
  get meta(): IMetaConfig {
    return this._meta;
  }
  get gupshup(): IGupshupConfig {
    return this._gupshup;
  }
  get brandName(): string {
    return this._brandName;
  }
}
