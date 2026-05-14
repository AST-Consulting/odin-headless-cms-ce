import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Integration, IntegrationSchema } from './schemas/integration.schema';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { GoogleServicesProvider } from './providers/google-services.provider';
import { GoogleAnalyticsProvider } from './providers/google-analytics.provider';
import { GoogleSearchConsoleProvider } from './providers/google-search-console.provider';
import { YouTubeProvider } from './providers/youtube.provider';
import { MetaAuthProvider } from './providers/meta-auth.provider';
import { FacebookProvider } from './providers/facebook.provider';
import { InstagramProvider } from './providers/instagram.provider';
import { TwitterAuthProvider } from './providers/twitter-auth.provider';
import { XProvider } from './providers/x.provider';
import { PropertyModule } from 'src/property/property.module';
import { UserModule } from 'src/user/user.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Integration.name, schema: IntegrationSchema }]),
        ConfigModule,
        HttpModule,
        PropertyModule,
        UserModule,
    ],
    controllers: [IntegrationsController],
    providers: [
        IntegrationsService,
        GoogleServicesProvider,
        GoogleAnalyticsProvider,
        GoogleSearchConsoleProvider,
        YouTubeProvider,
        MetaAuthProvider,
        FacebookProvider,
        InstagramProvider,
        TwitterAuthProvider,
        XProvider,
    ],
    exports: [
        IntegrationsService,
        GoogleServicesProvider,
        GoogleAnalyticsProvider,
        GoogleSearchConsoleProvider,
        YouTubeProvider,
        MetaAuthProvider,
        FacebookProvider,
        InstagramProvider,
        TwitterAuthProvider,
        XProvider,
    ],
})
export class IntegrationsModule { }
