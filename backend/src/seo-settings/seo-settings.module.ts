import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeoSettingsController } from './seo-settings.controller';
import { SeoSettingsService } from './seo-settings.service';
import {
  SeoSettingsHistory,
  SeoSettingsHistorySchema,
} from './schemas/seo-settings-history.schema';
import { PropertyModule } from 'src/property/property.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SeoSettingsHistory.name, schema: SeoSettingsHistorySchema },
    ]),
    forwardRef(() => PropertyModule),
  ],
  controllers: [SeoSettingsController],
  providers: [SeoSettingsService],
  exports: [SeoSettingsService],
})
export class SeoSettingsModule {}
