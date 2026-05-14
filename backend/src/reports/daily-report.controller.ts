import { Controller, Get, Param, Query, Res, HttpStatus, HttpException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { DailyReportService } from './daily-report';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('Reports')
@Controller('reports')
export class DailyReportController {
  constructor(private readonly dailyReportService: DailyReportService) {}

  // Security: Removed @Public() - reports require authentication
  @Get('generate-excel')
  @ApiOperation({ summary: 'Generate excel report for blogs by date and type' })
  @ApiQuery({ name: 'date', description: 'Date in YYYY-MM-DD format', required: true })
  @ApiQuery({
    name: 'type',
    description: 'Blog type (e.g., blog-a, blog-b, blog-c)',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async generateExcel(
    @Query('date') dateStr: string,
    @Query('type') type: string,
    @Res() res: Response
  ) {
    try {
      if (!dateStr || !type) {
        throw new HttpException('Date and type parameters are required', HttpStatus.BAD_REQUEST);
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new HttpException(
          'Invalid date format. Use YYYY-MM-DD for input date',
          HttpStatus.BAD_REQUEST
        );
      }

      // await this.dailyReportService.processBlogTypeAndGenerateExcel(date, type);

      // Convert to DD-MM-YYYY for display
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;

      return res.status(HttpStatus.OK).json({
        success: true,
        message: `Excel report for ${type} on ${formattedDate} generated successfully`,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to generate report: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Security: Removed @Public() - reports require authentication
  @Get('generate-all')
  @ApiOperation({ summary: "Generate excel reports for all blog types using previous day's date" })
  @ApiResponse({ status: 200, description: 'Reports generated successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async generateAllReports(@Res() res: Response) {
    try {
      await this.dailyReportService.sendDailyReport();

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'All reports generated successfully for the previous day',
      });
    } catch (error) {
      throw new HttpException(
        `Failed to generate reports: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('download/:type/:date')
  @ApiOperation({ summary: 'Download a generated excel report' })
  @ApiParam({ name: 'type', description: 'Blog type (e.g., custom-blog)', required: true })
  @ApiParam({ name: 'date', description: 'Date in DD-MM-YYYY format', required: true })
  @ApiResponse({ status: 200, description: 'Excel file' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Access denied - path traversal attempt' })
  async downloadExcel(
    @Param('type') type: string,
    @Param('date') dateStr: string,
    @Res() res: Response
  ) {
    try {
      // Security: Validate inputs to prevent path traversal
      const decodedType = decodeURIComponent(type);
      const decodedDate = decodeURIComponent(dateStr);

      // Whitelist validation for type (alphanumeric and hyphens only)
      if (!/^[a-zA-Z0-9-]+$/.test(decodedType)) {
        throw new ForbiddenException('Invalid type parameter');
      }

      // Whitelist validation for date (DD-MM-YYYY format only)
      if (!/^\d{2}-\d{2}-\d{4}$/.test(decodedDate)) {
        throw new HttpException('Invalid date format. Use DD-MM-YYYY', HttpStatus.BAD_REQUEST);
      }

      const publicDir = path.join(process.cwd(), 'public');
      const filePath = path.join(publicDir, decodedType, `${decodedDate}.xlsx`);

      // Security: Verify the resolved path is within the public directory
      const relativePath = path.relative(publicDir, filePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new ForbiddenException('Access denied');
      }

      if (!fs.existsSync(filePath)) {
        throw new HttpException('Report file not found', HttpStatus.NOT_FOUND);
      }

      return res.download(filePath);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to download report',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  @Get('list-reports')
  @ApiOperation({ summary: 'List all available reports' })
  @ApiResponse({ status: 200, description: 'List of reports' })
  async listReports(@Res() res: Response) {
    try {
      const publicDir = path.join(process.cwd(), 'public');
      const reports = [];

      if (!fs.existsSync(publicDir)) {
        return res.status(HttpStatus.OK).json({
          success: true,
          data: [],
        });
      }

      // Read all subdirectories (blog types)
      const typeDirectories = fs
        .readdirSync(publicDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      // For each blog type directory, get all Excel files
      for (const type of typeDirectories) {
        const typeDir = path.join(publicDir, type);

        const files = fs
          .readdirSync(typeDir)
          .filter((file) => file.endsWith('.xlsx'))
          .map((file) => {
            const date = file.replace('.xlsx', '');
            return {
              type,
              date,
              filename: file,
              url: `/reports/download/${type}/${date}`,
            };
          });

        reports.push(...files);
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      throw new HttpException(
        `Failed to list reports: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
