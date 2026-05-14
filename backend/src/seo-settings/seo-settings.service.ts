import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import {
  SeoSettingsHistory,
  TSeoSettingsHistoryDocument,
} from './schemas/seo-settings-history.schema';
import { UserInfo } from 'src/core/utils/utilVars';
import { PropertySub } from 'src/property/schema/property.sub-schema';
import { OrganizationSub } from 'src/organization/entities/organization-sub.schema';

export type SeoFileType = 'robots' | 'ads' | 'llms';

export const SEO_FILE_TYPES: SeoFileType[] = ['robots', 'ads', 'llms'];

const FILE_PATH_ENV_KEYS: Record<SeoFileType, string> = {
  robots: 'ROBOTS_TXT_PATH',
  ads: 'ADS_TXT_PATH',
  llms: 'LLMS_TXT_PATH',
};

const SYSTEM_USER: UserInfo = {
  id: 'system',
  name: 'System',
  email: 'system',
  userType: 'system',
};

@Injectable()
export class SeoSettingsService {
  private readonly logger = new Logger(SeoSettingsService.name);

  constructor(
    @InjectModel(SeoSettingsHistory.name)
    private readonly historyModel: Model<TSeoSettingsHistoryDocument>
  ) {}

  /* ------------------------------------------------------------------ */
  /* Filesystem sync                                                      */
  /* ------------------------------------------------------------------ */

  private syncToFile(fileType: SeoFileType, content: string) {
    const filePath = process.env[FILE_PATH_ENV_KEYS[fileType]];
    if (!filePath) {
      this.logger.warn(`${FILE_PATH_ENV_KEYS[fileType]} not set — skipping file sync`);
      return;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    this.logger.log(`Synced ${fileType} to ${filePath}`);
  }

  /* ------------------------------------------------------------------ */
  /* MongoDB helpers                                                      */
  /* ------------------------------------------------------------------ */

  private async getNextVersion(propertyId: string, fileType: SeoFileType): Promise<string> {
    const latest = await this.historyModel
      .findOne({ 'property.id': propertyId, fileType })
      .sort({ createdAt: -1 })
      .select('version')
      .lean();

    if (!latest) return 'v1';
    const num = parseInt((latest.version as string).replace('v', ''), 10);
    return `v${num + 1}`;
  }

  private async saveHistoryEntry(
    property: PropertySub,
    organization: OrganizationSub | undefined,
    fileType: SeoFileType,
    {
      version,
      action,
      createdBy,
      content,
    }: { version: string; action: string; createdBy: UserInfo; content: string }
  ) {
    await this.historyModel.create({
      property,
      organization,
      fileType,
      version,
      action,
      createdBy,
      updatedBy: createdBy,
      content,
    });
  }

  /* ------------------------------------------------------------------ */
  /* Default content per file type                                        */
  /* ------------------------------------------------------------------ */

  private getDefaultContent(fileType: SeoFileType, domain?: string): string {
    switch (fileType) {
      case 'robots': {
        const normalizedDomain =
          domain && !domain.startsWith('http') ? `https://${domain}` : (domain ?? '');
        return ['User-agent: *', 'Allow: /', `Sitemap: ${normalizedDomain}/sitemap.xml`].join('\n');
      }
      case 'ads':
        return '# ads.txt\n# Add your authorized digital sellers entries below\n# Format: <domain>, <publisher-id>, <relationship>, [certification-authority-id]\n';
      case 'llms':
        return '# llms.txt\n# This file provides guidance to Large Language Models about this site\n\n> Site\n\nThis site is managed via a CMS. Content is subject to copyright.\n';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Core APIs                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Initialize all SEO files for a new entity (call on property creation)
   */
  async createDefaults(property: PropertySub, organization?: OrganizationSub) {
    for (const fileType of SEO_FILE_TYPES) {
      await this.createDefault(property, organization, fileType);
    }
  }

  /**
   * Initialize a single SEO file type for a property
   */
  async createDefault(
    property: PropertySub,
    organization: OrganizationSub | undefined,
    fileType: SeoFileType
  ) {
    const existing = await this.historyModel.exists({ 'property.id': property.id, fileType });
    if (existing) {
      this.logger.log(`Default ${fileType} already exists for property ${property.id}`);
      return;
    }

    const content = this.getDefaultContent(fileType, property.domain);

    await this.saveHistoryEntry(property, organization, fileType, {
      version: 'v1',
      action: 'auto-generated',
      createdBy: SYSTEM_USER,
      content,
    });

    this.syncToFile(fileType, content);
    this.logger.log(`Default ${fileType} created for property ${property.id}`);
  }

  /**
   * Manual update from CMS UI
   */
  async update(
    property: PropertySub,
    organization: OrganizationSub | undefined,
    fileType: SeoFileType,
    content: string,
    createdBy: UserInfo
  ) {
    const version = await this.getNextVersion(property.id, fileType);

    await this.saveHistoryEntry(property, organization, fileType, {
      version,
      action: 'manual-update',
      createdBy,
      content,
    });

    this.syncToFile(fileType, content);
    this.logger.log(`${fileType} updated for property ${property.id}`);
  }

  /**
   * View audit trail
   */
  async getHistory(propertyId: string, fileType: SeoFileType) {
    return this.historyModel
      .find({ 'property.id': propertyId, fileType })
      .sort({ createdAt: 1 })
      .lean();
  }

  /**
   * Rollback to a previous version
   */
  async rollback(
    property: PropertySub,
    organization: OrganizationSub | undefined,
    fileType: SeoFileType,
    targetVersion: string,
    createdBy: UserInfo
  ) {
    const target = await this.historyModel
      .findOne({ 'property.id': property.id, fileType, version: targetVersion })
      .lean();

    if (!target) throw new NotFoundException(`Version ${targetVersion} not found`);

    const version = await this.getNextVersion(property.id, fileType);

    await this.saveHistoryEntry(property, organization, fileType, {
      version,
      action: `rollback-from-${targetVersion}`,
      createdBy,
      content: target.content,
    });

    this.syncToFile(fileType, target.content);
    this.logger.log(`${fileType} rolled back to ${targetVersion} for property ${property.id}`);
  }

  /**
   * Delete a specific version from history
   */
  async deleteVersion(propertyId: string, fileType: SeoFileType, targetVersion: string) {
    const result = await this.historyModel.deleteOne({
      'property.id': propertyId,
      fileType,
      version: targetVersion,
    });

    if (result.deletedCount === 0)
      throw new NotFoundException(`Version ${targetVersion} not found`);

    this.logger.log(`${fileType} version ${targetVersion} deleted for property ${propertyId}`);
  }
}
