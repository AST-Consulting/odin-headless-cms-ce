import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { format, transports } from 'winston';
import 'winston-daily-rotate-file';

@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        new transports.DailyRotateFile({
          datePattern: 'YYYY-MM-DD',
          filename: 'logs/error/%DATE%-error.log',
          format: format.combine(
            format.timestamp(),
            format.errors({ stack: true }),
            format.json({ space: 2 }),
            format.printf((info) => {
              return JSON.stringify({
                timestamp: info.timestamp,
                level: info.level,
                message: info.message,
                context: info.context,
                stack: info.stack ? info.stack : undefined,
              });
            })
          ),
          json: true,
          level: 'error',
          maxFiles: '30d',
          zippedArchive: true,
        }),
        new transports.DailyRotateFile({
          datePattern: 'YYYY-MM-DD',
          filename: 'logs/combined/%DATE%-combined.log',
          format: format.combine(
            format.timestamp(),
            format.errors({ stack: true }),
            format.json({ space: 2 }),
            format.printf((info) => {
              return JSON.stringify({
                timestamp: info.timestamp,
                level: info.level,
                message: info.message,
                context: info.context,
                stack: info.stack ? info.stack : undefined,
              });
            })
          ),
          json: true,
          maxFiles: '7d',
          zippedArchive: true,
        }),
        new transports.DailyRotateFile({
          datePattern: 'YYYY-MM-DD',
          filename: 'logs/debug/%DATE%-debug.log',
          format: format.combine(
            format.timestamp(),
            format.json({ space: 2 }),
            format.printf((info) => {
              return JSON.stringify({
                timestamp: info.timestamp,
                level: info.level,
                message: info.message,
                context: info.context,
                stack: info.stack ? info.stack : undefined,
              });
            })
          ),
          json: true,
          level: 'debug',
          maxFiles: '7d',
          zippedArchive: true,
        }),
        new transports.Console({
          format: format.combine(
            format((info) => ({
              ...info,
              level: info.level.toUpperCase(),
            }))(),
            format.cli(),
            format.align(),
            format.splat(),
            format.colorize({ all: true }),
            format.prettyPrint({ colorize: true }),
            format.timestamp(),
            format.json({ space: 2 }),
            format.printf(({ timestamp, context, level, message, trace }) => {
              return `${timestamp} [${context}] ${level}: ${message}${trace ? `\n${trace}` : ''}`;
            })
          ),
          level: process.env.LOG_LEVEL_TERMINAL || 'info',
        }),
      ],
    }),
  ],
  providers: [], // No need to import services here
})
export class WinstonLogModule {}
