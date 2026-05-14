import { User } from './src/user/entities/user.schema';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get(getModelToken(User.name));
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const user = await userModel.findOne({ email }).select('email hasCompletedOnboarding properties organization').lean();
  console.log('User Found:', JSON.stringify(user, null, 2));
  await app.close();
}
bootstrap();