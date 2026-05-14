import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationProvider } from '../schemas/integration.schema';

export class SelectAccountDto {
    @ApiProperty({ description: 'CMS Property ID', required: true })
    @IsString()
    @IsNotEmpty()
    propertyId: string;

    @ApiProperty({ enum: IntegrationProvider, description: 'The provider to configure', required: true })
    @IsEnum(IntegrationProvider)
    @IsNotEmpty()
    provider: IntegrationProvider;

    @ApiProperty({ description: 'Selected account ID (GA4 property ID or GSC site URL)', required: true })
    @IsString()
    @IsNotEmpty()
    accountId: string;

    @ApiProperty({ description: 'Human-readable label for the selected account', required: false })
    @IsString()
    @IsOptional()
    accountLabel?: string;

    @ApiProperty({ description: 'Page Access Token required for Meta (Facebook/Instagram) publishing', required: false })
    @IsString()
    @IsOptional()
    pageAccessToken?: string;
}
