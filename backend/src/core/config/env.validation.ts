import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum TEnvironment {
  development = 'development',
  local = 'local',
  production = 'production',
}

enum TUploadService {
  aws = 'aws',
  cloudinary = 'cloudinary',
  local = 'local',
}

type TEnvironments = keyof typeof TEnvironment;

export class EnvironmentVariables {
  // CORS
  @IsBoolean()
  @IsNotEmpty()
  CORS_CREDENTIALS: boolean;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS: string;

  // DATABASE
  @IsString()
  @IsNotEmpty()
  MONGODB_DATABASE: string;

  @IsString()
  @IsNotEmpty()
  HOSTED_URL: string;

  @IsString()
  @IsOptional()
  MONGODB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  MONGODB_URI: string;

  @IsString()
  @IsOptional()
  MONGODB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(TEnvironment)
  NODE_ENV: TEnvironments;

  @IsNumber()
  @IsNotEmpty()
  PORT: number;

  // File Upload
  @IsString()
  @IsNotEmpty()
  @IsEnum(TUploadService)
  UPLOAD_SERVICE: TEnvironment;

  // AWS credentials - File Upload
  @ValidateIf((o) => o.UPLOAD_SERVICE === 'aws')
  @IsString()
  @IsNotEmpty()
  AWS_ACCESS_KEY: string;

  @ValidateIf((o) => o.UPLOAD_SERVICE === 'aws')
  @IsString()
  @IsNotEmpty()
  AWS_SECRET_KEY: string;

  @ValidateIf((o) => o.UPLOAD_SERVICE === 'aws')
  @IsString()
  @IsNotEmpty()
  AWS_S3_REGION: string;

  @ValidateIf((o) => o.UPLOAD_SERVICE === 'aws')
  @IsString()
  @IsNotEmpty()
  AWS_S3_BUCKET_NAME: string;

  // Cloudinary credentials - File Upload
  @ValidateIf((o) => o.UPLOAD_SERVICE === 'cloudinary')
  @IsString()
  @IsNotEmpty()
  CLOUDINARY_CLOUD_NAME: string;

  @ValidateIf((o) => o.UPLOAD_SERVICE === 'cloudinary')
  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_KEY: string;

  @ValidateIf((o) => o.UPLOAD_SERVICE === 'cloudinary')
  @IsString()
  @IsNotEmpty()
  CLOUDINARY_SECRET_KEY: string;

  // Local Storage credentials - File Upload
  @ValidateIf((o) => o.UPLOAD_SERVICE === 'local')
  @IsString()
  @IsNotEmpty()
  SSH_SERVER_CHUNK_PATH: string;

  @IsString()
  @IsNotEmpty()
  UPLOAD_STRATEGY: string;

  @IsNumber()
  @IsNotEmpty()
  CHUNK_SIZE: number;

  @IsString()
  @IsNotEmpty()
  BASE_URL: string;

  // add the Brandname
  @IsString()
  @IsNotEmpty()
  BRAND_NAME: string;

  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_NODE: string;

  // add the Brandname
  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_PASSWORD: string;

  // Rate Limit
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsNotEmpty()
  RATE_LIMIT: number;

  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsNotEmpty()
  RATE_LIMIT_TTL: number;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @IsNumber()
  @IsNotEmpty()
  REDIS_PORT: number;
}

export function validate(config: Record<string, unknown>): any {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
