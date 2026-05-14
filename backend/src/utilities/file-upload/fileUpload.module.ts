import { forwardRef, Module } from '@nestjs/common';
import { FileUploadController } from './fileUpload.controller';
import { FileUploadService } from './fileUpload.service';
import { FileUpload, fileUploadSchema } from './entities/fileUpload.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { AWSService } from './providers/aws.service';
import { LocalService } from './providers/local.service';
import { CloudinaryService } from './providers/cloudinary.service';
import { PrivateFileController } from './private.controller';
import { PublicFileController } from './public.controller';
import { ElasticModule } from '@core/elastic/elastic.module';
import { OrganizationModule } from '@organization/organization.module';
import { PropertyModule } from '@property/property.module';
// import { ApiConfigService } from 'src/core/config/config.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FileUpload.name, schema: fileUploadSchema }]),
    ElasticModule, forwardRef(() => OrganizationModule), forwardRef(() => PropertyModule),
  ],
  providers: [FileUploadService, LocalService, CloudinaryService, AWSService],
  controllers: [FileUploadController, PrivateFileController, PublicFileController],
  exports: [FileUploadService, LocalService, CloudinaryService, AWSService],
})
export class FileUploadModule {}
