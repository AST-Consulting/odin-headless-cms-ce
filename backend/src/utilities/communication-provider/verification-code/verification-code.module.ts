import { Module } from '@nestjs/common';
import { VerificationCodeService } from './verification-code.service';
import { MongooseModule } from '@nestjs/mongoose';
import { VerificationCode, VerificationCodeSchema } from './veification-code.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: VerificationCode.name, schema: VerificationCodeSchema }]),
  ],
  providers: [VerificationCodeService],
  exports: [VerificationCodeService],
})
export class VerificationCodeModule {}
