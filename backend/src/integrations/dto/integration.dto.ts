import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationProvider } from '../schemas/integration.schema';

export class ConnectIntegrationDto {
    @ApiProperty({ description: 'Property ID to connect the integration to', required: true })
    @IsString()
    @IsNotEmpty()
    propertyId: string;

    @ApiProperty({ enum: IntegrationProvider, description: 'The provider to connect (e.g., google_analytics)', required: true })
    @IsEnum(IntegrationProvider)
    @IsNotEmpty()
    provider: IntegrationProvider;

    @ApiProperty({ description: 'Redirect URL after OAuth flow completes', required: true })
    @IsString()
    @IsNotEmpty()
    redirectUrl: string;
}

export class OAuthCallbackDto {
    @ApiProperty({ description: 'OAuth state parameter for security and context', required: true })
    @IsString()
    @IsNotEmpty()
    state: string;

    @ApiProperty({ description: 'Authorization code returned from the provider', required: true })
    @IsString()
    @IsNotEmpty()
    code: string;
}
