import { Controller, Get, Put, Param, Body, BadRequestException, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { SeoSettingsService, SeoFileType, SEO_FILE_TYPES } from './seo-settings.service';
import { PermissionResource } from 'src/auth/common/decorators/permission-resource.decorator';
import { GetCurrentUser } from 'src/auth/common/decorators/get-current-user.decorator';
import { buildUserMetadata } from 'src/core/utils/utils';
import { PropertyService } from 'src/property/property.service';
import { PropertySub } from 'src/property/schema/property.sub-schema';

@PermissionResource('property')
@Controller('seo-settings')
export class SeoSettingsController {
  constructor(
    private readonly seoSettingsService: SeoSettingsService,
    private readonly propertyService: PropertyService
  ) {}

  @Get('/:fileType/history')
  async getHistory(@Param('fileType') fileType: string, @Req() req: Request) {
    this.validateFileType(fileType);
    const propertyId = req.query.propertyId as string;
    if (!propertyId) throw new BadRequestException('propertyId is required');

    return this.seoSettingsService.getHistory(propertyId, fileType as SeoFileType);
  }

  @Put('/:fileType/rollback')
  async rollback(
    @Param('fileType') fileType: string,
    @Body() body: { propertyId: string; version: string },
    @GetCurrentUser() user: any,
    @Res() res: Response
  ) {
    this.validateFileType(fileType);
    const { propertyId, version } = body;
    if (!propertyId || !version) throw new BadRequestException('propertyId and version are required');

    const { property, organization } = await this.resolveProperty(propertyId);

    await this.seoSettingsService.rollback(
      property,
      organization,
      fileType as SeoFileType,
      version,
      buildUserMetadata(user)
    );
    return res.status(200).json({ success: true, message: `Reverted to ${version} successfully` });
  }

  @Put('/:fileType/history/delete')
  async deleteVersion(
    @Param('fileType') fileType: string,
    @Body() body: { propertyId: string; version: string },
    @Res() res: Response
  ) {
    this.validateFileType(fileType);
    const { propertyId, version } = body;
    if (!propertyId || !version) throw new BadRequestException('propertyId and version are required');

    await this.seoSettingsService.deleteVersion(propertyId, fileType as SeoFileType, version);
    return res
      .status(200)
      .json({ success: true, message: `Version ${version} deleted successfully` });
  }

  @Put('/:fileType/:propertyId')
  async updateFile(
    @Param('fileType') fileType: string,
    @Param('propertyId') propertyId: string,
    @Body() body: { content: string },
    @GetCurrentUser() user: any,
    @Res() res: Response
  ) {
    this.validateFileType(fileType);

    const { property, organization } = await this.resolveProperty(propertyId);

    await this.seoSettingsService.update(
      property,
      organization,
      fileType as SeoFileType,
      body.content,
      buildUserMetadata(user)
    );
    return res.status(200).json({ success: true, message: `${fileType} updated successfully` });
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                              */
  /* ------------------------------------------------------------------ */

  private async resolveProperty(propertyId: string) {
    const doc = await this.propertyService.getById(propertyId);
    const property: PropertySub = {
      id: doc._id.toString(),
      name: doc.name,
      domain: doc.domain,
    };
    return { property, organization: doc.organization };
  }

  private validateFileType(fileType: string): asserts fileType is SeoFileType {
    if (!SEO_FILE_TYPES.includes(fileType as SeoFileType)) {
      throw new BadRequestException(
        `Invalid file type "${fileType}". Must be one of: ${SEO_FILE_TYPES.join(', ')}`
      );
    }
  }
}
