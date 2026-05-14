import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SystemSetupService } from './system-setup/system-setup.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ApiConfigService } from './core/config/config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Run System Setup
  const systemSetupService = app.get(SystemSetupService);
  await systemSetupService.onApplicationBootstrap();

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
          scriptSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    })
  );

  // const configService = app.get(ApiConfigService);
  // app.enableCors(configService.cors);
  const origins = process.env.CORS_ORIGINS;
  const whitelist = origins.split(',');

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || whitelist.includes(origin)) {
        // Allow requests with no origin (like same-origin or non-browser clients)
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  };

  app.enableCors(corsOptions);

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
  });
  app.enableVersioning({
    type: VersioningType.URI, // This will add version in the URI
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`\n✅ Application is running on: http://localhost:${port}`);
  console.log(`📁 Static files served from: /public/`);
}
bootstrap();
